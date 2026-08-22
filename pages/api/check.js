import { supabase } from '../../lib/supabaseClient';
import { DESTINATION_KEY_MAP } from '../../lib/countries';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    passportCountry,
    passportExpiry,
    destination,
    documents,
    purpose,
    entryCount,
    travelDate,
    leavingAirport,
    layoverDuration,
  } = req.body;

  if (!passportCountry || !destination) {
    return res.status(400).json({ error: 'Missing passportCountry or destination' });
  }

  const destinationKey = DESTINATION_KEY_MAP[destination] || destination.toLowerCase();

  if (purpose === 'Transit') {
    try {
      const liveResult = await liveSearch(passportCountry, destination, documents, purpose, entryCount, leavingAirport, layoverDuration);
      return res.status(200).json({
        found: true,
        result: {
          destination_label: destination,
          requirement: liveResult.requirement,
          fee: liveResult.fee,
          max_stay: liveResult.max_stay,
          source_name: liveResult.source_name,
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

  try {
    const liveResult = await liveSearch(passportCountry, destination, documents, purpose, entryCount);

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
    ? `This is a TRANSIT/LAYOVER, not a full entry. ${leavingAirport === 'Yes' ? 'They WILL leave the airport during the layover.' : 'They will stay airside and NOT leave the airport.'} Layover duration: ${layoverDuration || 'unspecified'}. Research transit-specific visa rules, which are often different from full entry rules (e.g. many countries allow visa-free airside transit under a certain number of hours even when a full entry visa would be required).`
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
