import { supabase } from '../../lib/supabaseClient';
import { DESTINATION_KEY_MAP } from '../../lib/countries';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { passportCountry, destination, documents } = req.body;

  if (!passportCountry || !destination) {
    return res.status(400).json({ error: 'Missing passportCountry or destination' });
  }

  const destinationKey = DESTINATION_KEY_MAP[destination] || destination.toLowerCase();

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
      .map((doc) => ({ doc, rule: data.find((r) => r.secondary_doc_type === doc) }))
      .filter((m) => m.rule);

    const unlockMatch = matches.find((m) => m.rule.outcome_type === 'unlock');
    const excludeMatch = matches.find((m) => m.rule.outcome_type === 'exclude');

    let best = baseline;
    let unlockedBy = null;
    if (unlockMatch) { best = unlockMatch.rule; unlockedBy = unlockMatch.doc; }
    else if (excludeMatch) { best = excludeMatch.rule; unlockedBy = excludeMatch.doc; }

    return res.status(200).json({
      found: true,
      result: best,
      unlockedBy,
      usedBaseline: best === baseline,
      baselineExhaustive: baseline ? baseline.exhaustive : true,
      source: 'database',
    });
  }

  try {
    const liveResult = await liveSearch(passportCountry, destination, documents);

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
    });
  } catch (err) {
    return res.status(500).json({ error: 'Live search failed: ' + err.message });
  }
}

async function liveSearch(passportCountry, destination, documents) {
  const docsText = documents && documents.length > 0
    ? `They also hold: ${documents.join(', ')}.`
    : 'They hold no other visas or residency documents.';

  const prompt = `A traveler holds a ${passportCountry} passport and wants to visit ${destination}. ${docsText}
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
