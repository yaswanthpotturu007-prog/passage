import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { passportCountry, destination, documents } = req.body;

  if (!passportCountry || !destination) {
    return res.status(400).json({ error: 'Missing passportCountry or destination' });
  }

  const { data, error } = await supabase
    .from('visa_rules')
    .select('*')
    .eq('passport_country', passportCountry)
    .eq('destination_country', destination);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data || data.length === 0) {
    return res.status(200).json({
      found: false,
      message: "We haven't verified this destination yet.",
    });
  }

  const baseline = data.find((r) => r.outcome_type === 'baseline');

  const matches = (documents || [])
    .map((doc) => ({ doc, rule: data.find((r) => r.secondary_doc_type === doc) }))
    .filter((m) => m.rule);

  const unlockMatch = matches.find((m) => m.rule.outcome_type === 'unlock');
  const excludeMatch = matches.find((m) => m.rule.outcome_type === 'exclude');

  let best = baseline;
  let unlockedBy = null;

  if (unlockMatch) {
    best = unlockMatch.rule;
    unlockedBy = unlockMatch.doc;
  } else if (excludeMatch) {
    best = excludeMatch.rule;
    unlockedBy = excludeMatch.doc;
  }

  const usedBaseline = best === baseline;
  const baselineExhaustive = baseline ? baseline.exhaustive : true;

  return res.status(200).json({
    found: true,
    result: best,
    unlockedBy,
    usedBaseline,
    baselineExhaustive,
  });
}
