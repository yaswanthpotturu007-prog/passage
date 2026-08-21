// This file creates one shared connection to your Supabase database.
// It reads the URL and key from environment variables (set in Vercel later)
// so we never write secret keys directly into the code.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
