# Passage — setup instructions (beginner-friendly)

Follow these steps in order. Each one builds on the last.

---

## STEP 1 — Create the database table

1. Go to supabase.com and open your project (the one named something like `passage-visa-checker`)
2. In the left sidebar, click the **SQL Editor** icon (looks like `>_`)
3. Click **New query**
4. Open the file `setup-database.sql` (in this same folder), select all the text, and copy it
5. Paste it into the Supabase SQL editor box
6. Click **Run** (bottom right)
7. You should see "Success. No rows returned" — that means it worked
8. Click **Table Editor** in the sidebar — you should now see a table called `visa_rules` with rows of data in it (UAE, UK, Schengen)

---

## STEP 2 — Get your Supabase keys

1. In Supabase, click the **gear/settings icon** in the left sidebar → **API**
2. You'll see two values you need:
   - **Project URL** (looks like `https://xxxxx.supabase.co`)
   - **anon public key** (a long string of letters/numbers)
3. Keep this tab open — you'll copy these into Vercel in Step 4

---

## STEP 3 — Upload this code to GitHub

You don't need to install anything on your computer for this — GitHub lets you upload files directly from your browser.

1. Go to github.com and log in
2. Click the **+** icon (top right) → **New repository**
3. Name it `passage`
4. Leave it **Public** (or Private, your choice — both work fine)
5. Do NOT check "Add a README" (we already have one)
6. Click **Create repository**
7. On the next page, click **"uploading an existing file"** (a link in the instructions)
8. Drag and drop ALL the files and folders from this project into the upload box
   - Make sure folder structure is kept: `pages/`, `pages/api/`, `lib/`
9. Scroll down, click **Commit changes**

Your code is now on GitHub.

---

## STEP 4 — Deploy on Vercel

1. Go to vercel.com → your dashboard
2. Click **Add New** → **Project**
3. Find your `passage` repository in the list and click **Import**
4. Before clicking deploy, look for **Environment Variables** section and add these two:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | (paste your Project URL from Step 2) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (paste your anon public key from Step 2) |

5. Click **Deploy**
6. Wait about a minute — Vercel will show a progress screen
7. When it's done, click **Visit** — this is your live website!

---

## STEP 5 — Test it

1. On your live site, leave the default document ("Canadian PR card") and destination ("United Arab Emirates")
2. Click **Stamp my check**
3. You should see: Visa on arrival, ~100–120 AED, 14 days
4. Try changing the document to "Canadian work permit" and check again — it should say visa still required in advance
5. Try switching destination to "United Kingdom" — it should say the visa is required either way, since the UK doesn't care about Canadian PR status

If all of that works, your site is live and pulling real answers from your database.

---

## What to do next

- Adding a new destination country = adding new rows in `visa_rules` via Supabase's Table Editor (no code changes needed)
- Any time you push new code changes to GitHub, Vercel automatically redeploys your site
- Come back and tell me once this is working, and we'll add the next destination together
