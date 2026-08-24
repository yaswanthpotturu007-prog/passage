// Handles ONE destination per call. The frontend calls this once per
// destination when the user searches multiple destinations at once.

import { supabase } from '../../lib/supabaseClient';
import { DESTINATION_KEY_MAP } from '../../lib/countries';

// Site-wide safety net: caps how many LIVE (uncached) AI searches can run
// across the whole site per day, so a traffic spike can't run up an
// unexpected bill. Verified destinations (UAE/UK/Schengen, non-transit)
// don't count against this since they're answered straight from the
// database with no AI call involved.
const DAILY_LIVE_SEARCH_CAP = 5;

function startOfTodayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

async function todaysLiveSearchCount() {
  const { count, error } = await supabase
    .from('search_log')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', startOfTodayUTC());
  if (error) {
    // If the log itself is unreachable, fail OPEN (allow the search) rather
    // than blocking the whole site over a logging problem.
    console.error('search_log count error:', error.message);
    return 0;
  }
  return count || 0;
}

async function logLiveSearch() {
  const { error } = await supabase.from('search_log').insert({});
  if (error) console.error('search_log insert error:', error.message);
}

const CAP_MESSAGE = "We've hit today's live-search limit. Please try again tomorrow.";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    passportCountry,
    passportExpiry,
    destination,
    documents,
    purpose,          // e.g. "Tourist", "Business", "Transit", "Family visit"
    entryCount,       // "Single entry" or "Multiple entry"
    travelDate,       // optional date string
    leavingAirport,   // "Yes" or "No" - only relevant when purpose is Transit
    layoverDuration,  // "Under 24 hours" or "24+ hours" - only relevant when purpose is Transit
    adminKey,         // optional - matches ADMIN_BYPASS_KEY env var, skips the daily cap
  } = req.body;

  if (!passportCountry || !destination) {
    return res.status(400).json({ error: 'Missing passportCountry or destination' });
  }

  // Private bypass for testing (you + friends): visiting the site with
  // ?key=yoursecret attaches that key to every search. If it matches the
  // ADMIN_BYPASS_KEY env var, that search skips the daily cap AND isn't
  // logged against it - so friends testing the site never eats into the
  // public 3-per-day budget.
  const isBypass = !!(adminKey && process.env.ADMIN_BYPASS_KEY && adminKey === process.env.ADMIN_BYPASS_KEY);

  const destinationKey = DESTINATION_KEY_MAP[destination] || destination.toLowerCase();

  // TRANSIT is a genuinely different question from entry rules - even our
  // "verified" UAE/UK/Schengen data has never been checked for transit
  // specifically. So transit ALWAYS goes to live search, never the verified
  // database, and its result is never cached as a general destination answer
  // (that would risk polluting the entry-rule cache with transit-only info).
  if (purpose === 'Transit') {
    if (!isBypass) {
      const todaysCount = await todaysLiveSearchCount();
      if (todaysCount >= DAILY_LIVE_SEARCH_CAP) {
        return res.status(200).json({ found: false, message: CAP_MESSAGE });
      }
    }
    try {
      const liveResult = await liveSearch(passportCountry, destination, documents, purpose, entryCount, leavingAirport, layoverDuration);
      if (!isBypass) await logLiveSearch();
      return res.status(200).json({
        found: true,
        result: {
          destination_label: destination,
          requirement: liveResult.requirement,
          fee: liveResult.fee,
          max_stay: liveResult.max_stay,
          source_name: liveResult.source_name,
          source_url: liveResult.source_url,
          confidence: 'auto',
          verified_date: new Date().toISOString().slice(0, 7),
        },
        unlockedBy: null,
        usedBaseline: true,
        baselineExhaustive: false,
        source: 'live_search',
        passportWarning: null,
        documentWarning: null,
        purposeWarning: "Transit rules are always shown as auto-researched, even for destinations we've otherwise verified - transit is a genuinely different rulebook from entry. Confirm with an official source before booking.",
        entryWarning: null,
        travelDateNote: null,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Live search failed: ' + err.message });
    }
  }

  function monthsUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const now = new Date();
    return (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  }

  let passportWarning = null;
  const passportMonths = monthsUntil(passportExpiry);
  if (passportMonths !== null && passportMonths < 6) {
    passportWarning = "Your passport has less than 6 months validity left. Many countries require 6+ months beyond your travel date - worth double-checking for this destination specifically.";
  }

  let travelDateNote = null;
  const travelMonthsOut = monthsUntil(travelDate);
  if (travelMonthsOut !== null && travelMonthsOut > 3) {
    travelDateNote = "Your trip is more than 3 months away. Visa rules can change (as they have for several countries in 2026) - worth re-checking closer to your travel date.";
  }

  // ---------- STEP 1: check the verified/cached database ----------
  const { data, error } = await supabase
    .from('visa_rules')
    .select('*')
    .eq('passport_country', passportCountry)
    .eq('destination_country', destinationKey);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (data && data.length > 0) {
    const baseline = data.find((r) => r.outcome_type === 'baseline');
    const matches = (documents || [])
      .map((doc) => ({ doc, rule: data.find((r) => r.secondary_doc_type === doc.name) }))
      .filter((m) => m.rule);

    let unlockMatch = matches.find((m) => m.rule.outcome_type === 'unlock');
    const excludeMatch = matches.find((m) => m.rule.outcome_type === 'exclude');

    let documentWarning = null;
    if (unlockMatch && destinationKey === 'uae' && unlockMatch.doc.expiry) {
      const docMonths = monthsUntil(unlockMatch.doc.expiry);
      if (docMonths !== null && docMonths < 6) {
        documentWarning = `Your ${unlockMatch.doc.name} has less than 6 months validity left. UAE visa-on-arrival requires 6+ months validity on the qualifying document, so this may not apply to you right now.`;
        unlockMatch = null;
      }
    }

    let best = baseline;
    let unlockedBy = null;
    if (unlockMatch) { best = unlockMatch.rule; unlockedBy = unlockMatch.doc.name; }
    else if (excludeMatch) { best = excludeMatch.rule; unlockedBy = excludeMatch.doc.name; }

    // Our verified UAE/UK/Schengen data assumes: tourist purpose, single entry.
    // If the user selected something else, flag it honestly rather than
    // silently applying tourist/single-entry rules to a different situation.
    let purposeWarning = null;
    if (purpose && purpose !== 'Tourist') {
      purposeWarning = `This answer is based on tourist travel. You selected "${purpose}" - business, transit, and family-visit trips can have different visa categories or requirements. Confirm the correct category with an official source.`;
    }
    let entryWarning = null;
    if (entryCount && entryCount !== 'Single entry') {
      entryWarning = "This answer assumes single entry. Multiple-entry requirements (if you're leaving and re-entering) haven't been verified for this destination yet.";
    }

    return res.status(200).json({
      found: true,
      result: best,
      unlockedBy,
      usedBaseline: best === baseline,
      baselineExhaustive: baseline ? baseline.exhaustive : true,
      source: 'database',
      passportWarning,
      documentWarning,
      purposeWarning,
      entryWarning,
      travelDateNote,
    });
  }

  // ---------- STEP 2: live search fallback ----------
  if (!isBypass) {
    const todaysCount = await todaysLiveSearchCount();
    if (todaysCount >= DAILY_LIVE_SEARCH_CAP) {
      return res.status(200).json({ found: false, message: CAP_MESSAGE });
    }
  }

  try {
    const liveResult = await liveSearch(passportCountry, destination, documents, purpose, entryCount);
    if (!isBypass) await logLiveSearch();

    await supabase.from('visa_rules').insert({
      passport_country: passportCountry,
      secondary_doc_type: null,
      destination_country: destinationKey,
      destination_label: destination,
      requirement: liveResult.requirement,
      fee: liveResult.fee,
      max_stay: liveResult.max_stay,
      confidence: 'auto',
      source_name: liveResult.source_name,
      source_url: liveResult.source_url,
      verified_date: new Date().toISOString().slice(0, 7),
      outcome_type: 'baseline',
      exhaustive: false,
    });

    return res.status(200).json({
      found: true,
      result: {
        destination_label: destination,
        requirement: liveResult.requirement,
        fee: liveResult.fee,
        max_stay: liveResult.max_stay,
        source_name: liveResult.source_name,
        source_url: liveResult.source_url,
        confidence: 'auto',
        verified_date: new Date().toISOString().slice(0, 7),
      },
      unlockedBy: null,
      usedBaseline: true,
      baselineExhaustive: false,
      source: 'live_search',
      passportWarning,
      documentWarning: null,
      purposeWarning: null,
      entryWarning: null,
      travelDateNote,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Live search failed: ' + err.message });
  }
}

async function liveSearch(passportCountry, destination, documents, purpose, entryCount, leavingAirport, layoverDuration) {
  const docNames = (documents || []).map((d) => d.name);
  const docsText = docNames.length > 0
    ? `They also hold: ${docNames.join(', ')}.`
    : 'They hold no other visas or residency documents.';
  const purposeText = purpose ? `Purpose of travel: ${purpose}.` : '';
  const entryText = entryCount ? `Entry type needed: ${entryCount}.` : '';
  const transitText = purpose === 'Transit'
    ? `This is a TRANSIT/LAYOVER, not a full entry. ${leavingAirport && leavingAirport.startsWith('Yes') ? 'They WILL leave the airport during the layover.' : 'They will stay airside and NOT leave the airport.'} Layover duration: ${layoverDuration || 'unspecified'}. Research transit-specific visa rules, which are often different from full entry rules (e.g. many countries allow visa-free airside transit under a certain number of hours even when a full entry visa would be required).`
    : '';

  const prompt = `A traveler holds a ${passportCountry} passport and wants to visit ${destination}. ${docsText} ${purposeText} ${entryText} ${transitText}
Research the current visa requirement for this exact situation using web search, prioritizing official government or embassy sources.
Reply with ONLY a JSON object, no other text, in this exact format:
{"requirement": "short description of what's required", "fee": "fee amount or 'Varies'", "max_stay": "e.g. 30 days", "source_name": "name of the source", "source_url": "URL of the source"}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    }),
  });

  const data = await response.json();
  const textBlocks = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text);
  const fullText = textBlocks.join('\n');

  const jsonMatch = fullText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse a result from the search');
  }
  return JSON.parse(jsonMatch[0]);
}
