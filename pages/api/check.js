// This is the "brain" that runs on the server whenever someone clicks
// "Stamp my check" on the website. It receives the destination + list of
// documents the user holds, asks Supabase for matching rules, and picks
// the BEST outcome (a specific document match beats the baseline rule).

import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { passportCountry, destination, documents } = req.body;
  // documents is an array like: ["Canadian PR card", "US visa (B1/B2)"]

  if (!passportCountry || !destination) {
    return res.status(400).json({ error: 'Missing passportCountry or destination' });
  }

  // Fetch every rule for this passport + destination combo
  const { data, error } = await supabase
    .from('visa_rules')
    .select('*')
    .eq('passport_country', passportCountry)
    .eq('destination_country', destination);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  if (!data || data.length === 0) {
    // Nothing verified for this destination yet
    return res.status(200).json({
      found: false,
      message: "We haven't verified this destination yet.",
    });
  }

  // Start with the baseline rule (secondary_doc_type is null)
  const baseline = data.find((r) => r.secondary_doc_type === null);
  let best = baseline;
  let unlockedBy = null;

  // Check if any document the user holds has a specific override rule
  if (documents && documents.length > 0) {
    for (const doc of documents) {
      const match = data.find((r) => r.secondary_doc_type === doc);
      if (match) {
        best = match;
        unlockedBy = doc;
        break; // first match wins; could be refined later to compare multiple
      }
    }
  }

  return res.status(200).json({
    found: true,
    result: best,
    unlockedBy,
  });
}
