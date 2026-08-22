import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { passportCountry, destinationLabel, requirementText, vote } = req.body;

  if (!vote || (vote !== 'up' && vote !== 'down')) {
    return res.status(400).json({ error: 'vote must be "up" or "down"' });
  }

  const { error } = await supabase.from('feedback').insert({
    passport_country: passportCountry,
    destination_label: destinationLabel,
    requirement_text: requirementText,
    vote,
  });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
