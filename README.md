<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/32c471a0-6667-4831-9769-c551809e90f2

## Run Locally

**Prerequisites:** Node.js, a [Supabase](https://supabase.com) project

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in from **Supabase Dashboard → Settings → API**:
   - `SUPABASE_URL` and `VITE_SUPABASE_URL` — Project URL (e.g. `https://abcdefgh.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` — service role key (server only, never expose in the browser)
   - `VITE_SUPABASE_ANON_KEY` — anon/public key
3. Apply the database schema in Supabase **SQL Editor** (run in order):
   - `supabase/migrations/001_stemverse_schema.sql`
   - `supabase/migrations/002_fix_rls_recursion.sql`
4. Run the app: `npm run dev`

   Open **http://localhost:3000** (or the port printed in the terminal).

   If port 3000 is already in use (e.g. another Next.js app), run `PORT=3001 npm run dev` instead.

   Use **`npm run dev`** so the API is available. Do not use only `npm run preview`—that serves the built frontend only and API calls will return 404.

5. Optional AI features: set `OPENAI_API_KEY` in `.env`. The server calls an OpenAI-compatible chat completions API (`OPENAI_BASE_URL`, default `https://api.openai.com/v1`; optional `OPENAI_MODEL`, default `gpt-4o-mini`).
