-- ============================================================
-- PASSAGE: Database setup script
-- ============================================================
-- HOW TO USE THIS FILE:
-- 1. Go to your Supabase project (supabase.com -> your project)
-- 2. On the left sidebar, click the icon that looks like ">_" 
--    called "SQL Editor"
-- 3. Click "New query"
-- 4. Copy this ENTIRE file and paste it into the box
-- 5. Click "Run" (bottom right, or press Ctrl+Enter)
-- 6. You should see "Success. No rows returned" - that's correct
-- ============================================================

-- This creates the table that stores every visa rule
create table if not exists visa_rules (
  id bigint generated always as identity primary key,
  passport_country text not null,
  secondary_doc_type text,              -- e.g. 'Canadian PR card', or NULL for baseline rule
  destination_country text not null,
  destination_label text not null,      -- e.g. 'United Arab Emirates'
  requirement text not null,            -- e.g. 'Visa on arrival'
  fee text,
  max_stay text,
  confidence text not null default 'verified',  -- 'verified' or 'auto'
  source_name text,
  source_url text,
  verified_date text,
  created_at timestamp with time zone default now()
);

-- Turn on Row Level Security (keeps data safe by default)
alter table visa_rules enable row level security;

-- Allow anyone to READ the visa rules (this is public information,
-- like a search engine result - no login needed to look it up)
create policy "Anyone can read visa rules"
  on visa_rules for select
  using (true);

-- ============================================================
-- Seed data: the rules we researched for UAE, UK, and Schengen
-- Each destination has a BASELINE row (secondary_doc_type = NULL)
-- and then override rows for specific documents that change the outcome
-- ============================================================

insert into visa_rules
(passport_country, secondary_doc_type, destination_country, destination_label, requirement, fee, max_stay, confidence, source_name, source_url, verified_date)
values
-- ---------- UAE ----------
('India', null, 'uae', 'United Arab Emirates', 'Apply for visa in advance', 'Varies by visa type', '—', 'verified', 'ICP / gov.ae', 'https://icp.gov.ae', '2026-08'),
('India', 'Canadian PR card', 'uae', 'United Arab Emirates', 'Visa on arrival', '~100–120 AED', '14 days', 'verified', 'ICP / gov.ae', 'https://icp.gov.ae', '2026-08'),
('India', 'Canadian visitor visa', 'uae', 'United Arab Emirates', 'Visa on arrival', '~100–120 AED', '14 days', 'verified', 'ICP / gov.ae', 'https://icp.gov.ae', '2026-08'),
('India', 'US visa (B1/B2)', 'uae', 'United Arab Emirates', 'Visa on arrival', '~100–120 AED', '14 days', 'verified', 'ICP / gov.ae', 'https://icp.gov.ae', '2026-08'),
('India', 'UK visa / residence permit', 'uae', 'United Arab Emirates', 'Visa on arrival', '~100–120 AED', '14 days', 'verified', 'ICP / gov.ae', 'https://icp.gov.ae', '2026-08'),
('India', 'Canadian work permit', 'uae', 'United Arab Emirates', 'Apply for visa in advance (work permit does not qualify)', 'Varies', '—', 'verified', 'ICP / gov.ae', 'https://icp.gov.ae', '2026-08'),

-- ---------- United Kingdom ----------
-- Note: UK goes by passport nationality only - secondary docs do NOT change the outcome
('India', null, 'uk', 'United Kingdom', 'Standard Visitor visa required', '£135 (6 months)', 'Up to 6 months', 'verified', 'gov.uk', 'https://www.gov.uk/standard-visitor-visa', '2026-08'),
('India', 'Canadian PR card', 'uk', 'United Kingdom', 'Standard Visitor visa still required — Canadian PR does not change this', '£135 (6 months)', 'Up to 6 months', 'verified', 'gov.uk', 'https://www.gov.uk/standard-visitor-visa', '2026-08'),
('India', 'Canadian work permit', 'uk', 'United Kingdom', 'Standard Visitor visa still required — status in Canada does not change this', '£135 (6 months)', 'Up to 6 months', 'verified', 'gov.uk', 'https://www.gov.uk/standard-visitor-visa', '2026-08'),

-- ---------- Schengen Area ----------
-- Note: same as UK - passport nationality decides, secondary docs do not exempt you
('India', null, 'schengen', 'Schengen Area', 'Schengen visa required', 'Visa fee + travel insurance (min €30,000 cover)', 'Up to 90 days in 180', 'verified', 'EU Visa Portal', 'https://home-affairs.ec.europa.eu', '2026-08'),
('India', 'Canadian PR card', 'schengen', 'Schengen Area', 'Schengen visa still required — Canadian PR does not exempt you, but PR card is used as proof of legal status in your application', 'Visa fee + travel insurance (min €30,000 cover)', 'Up to 90 days in 180', 'verified', 'EU Visa Portal', 'https://home-affairs.ec.europa.eu', '2026-08');

-- ============================================================
-- Done! Go check the "Table Editor" tab in Supabase sidebar
-- to see this data as a spreadsheet-style view.
-- ============================================================
