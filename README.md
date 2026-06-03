<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# STEMverse

Galaxy-map STEM learning platform: teachers build **Activity Bank → Curriculum (journeys) → Deploy**; students follow journey nodes or legacy mission corridors.

## Run locally

**Prerequisites:** Node.js 18+, a [Supabase](https://supabase.com) project

1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and fill in values (see [Environment variables](#environment-variables)).
3. **Apply database migrations in Supabase SQL Editor before first start** — run every file below **in numeric order** (001 → 031). Skipping migrations causes login/schema errors.
4. Run the app: `npm run dev`

   Open **http://localhost:3000** (or the port printed in the terminal).

   If port 3000 is in use: `PORT=3001 npm run dev`

   Use **`npm run dev`** (Express + Vite). Do not use only `npm run preview` — API routes will 404.

5. Optional: seed test accounts — `npx tsx scripts/seed-test-data.ts`

6. Optional: API smoke checklist — `node scripts/verify-checklist.mjs` (with dev server running)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_URL` | Yes | Same URL for the browser client |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service role key (server only) |
| `VITE_SUPABASE_ANON_KEY` | Yes | Anon/public key |
| `PORT` | No | API/dev server port (default `3000`) |
| `VITE_API_PORT` | No | Vite proxy target if API is not on 3000 |
| `OPENAI_API_KEY` | No | AI quiz, STEMbot, recommendations |
| `OPENAI_MODEL` | No | Default `gpt-4o-mini` |
| `OPENAI_BASE_URL` | No | Default `https://api.openai.com/v1` |
| `AI_API_KEY` | No | Alias for OpenAI key |
| `AI_DAILY_GLOBAL_LIMIT` | No | Global AI calls per day |
| `AI_DAILY_QUIZ_LIMIT_PER_USER` | No | Per-user quiz generation limit |
| `AI_DAILY_RECOMMEND_LIMIT_PER_USER` | No | Per-user recommendations limit |
| `AI_DAILY_STEMBOT_LIMIT_PER_USER` | No | Per-user STEMbot limit |
| `DEV_BYPASS_SECRET` | No | Dev rate-limit bypass (server) |
| `VITE_DEV_BYPASS_SECRET` | No | Same for client dev headers |
| `NODE_ENV` | No | `production` in deploy |
| `FRONTEND_URL` | No | CORS / links in production |
| `ENABLE_TEST_ACCOUNTS` | No | Allow demo test logins when `true` |

## Database migrations (run in order)

Apply each file in **Supabase → SQL Editor** before starting the app.

| File | Description |
|------|-------------|
| `001_stemverse_schema.sql` | Core schema: students, sectors, missions, classes, RLS |
| `002_fix_rls_recursion.sql` | Fix RLS recursion on `class_students` and junction tables |
| `003_parents.sql` | Parent accounts and child linking |
| `004_sector_metadata.sql` | Sector sort order, starter flag, unlock rules |
| `005_student_sector_mastery.sql` | Per-student sector mastery progress |
| `006_curriculum.sql` | Class curriculum and default curriculum tables |
| `007_domains.sql` | Learning domains taxonomy |
| `008_usernames.sql` | Unique student usernames |
| `009_schema_patches.sql` | Misc column/index patches |
| `010_activity_log.sql` | Student activity logging |
| `011_fix_classes_rls.sql` | Classes RLS policy fixes |
| `012_class_missions_assigned_by.sql` | `assigned_by` on `class_missions` |
| `013_fix_classes_rls_v2.sql` | Classes/junction RLS v2 |
| `014_fix_profiles_missions_rls.sql` | Profiles and missions RLS |
| `015_provision_roster_student.sql` | Roster student provisioning RPC |
| `016_auth_trigger_and_students_rls.sql` | Auth trigger + students RLS |
| `017_class_challenges_rls.sql` | Class challenges policies |
| `018_sectors_read_and_ai_usage.sql` | Sector read policies, `ai_usage_logs` |
| `019_missions_created_by.sql` | Mission `created_by` column |
| `020_logs_service_insert.sql` | Service-role insert on logs |
| `021_challenges_created_by.sql` | Challenge `created_by` column |
| `022_parents_service_insert.sql` | Parent link service inserts |
| `023_journeys.sql` | Journeys, journey nodes, student progress |
| `024_journey_nodes_sector.sql` | `sector_id` on journey nodes |
| `025_curriculums.sql` | Curriculums publish workflow |
| `026_activity_bank.sql` | Activities table (canonical content) |
| `027_journeys_deploy_toggle.sql` | `is_deployed` on journeys |
| `028_student_onboarding.sql` | Student onboarding profiles |
| `029_schools.sql` | Schools, teacher invites, school scoping |
| `030_student_assigned_level.sql` | `assigned_level`, default journey targeting |
| `031_tutorial_completed.sql` | `tutorial_completed` on students |

## Deploy on Render

1. Connect this repo to a **Web Service** (or use `render.yaml` Blueprint).
2. **Build:** `npm install && npm run build` · **Start:** `npm start`
3. Set environment variables (see table above). `VITE_*` vars must be set at **build time** on Render.
4. Run Supabase migrations **001–031** before testing.
5. Set `FRONTEND_URL` to your Render URL (e.g. `https://stemverse.onrender.com`) for production links.

## Scripts

- `npm run dev` — development server
- `npm run build` — production frontend build
- `npm run lint` — TypeScript check
- `node scripts/verify-checklist.mjs` — API critical-path verification
