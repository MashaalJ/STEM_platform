import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Ensure env vars are loaded even when this module is imported before server bootstrap.
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

export const hasSupabaseAdmin = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = hasSupabaseAdmin
  ? createClient(String(supabaseUrl), serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function jwtRole(key: string): string | null {
  try {
    const parts = key.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}

if (hasSupabaseAdmin && serviceRoleKey && jwtRole(serviceRoleKey) !== "service_role") {
  console.warn(
    "[stemverse] SUPABASE_SERVICE_ROLE_KEY does not look like a service_role JWT. " +
      "Database writes may fail RLS (e.g. students insert). Use the service_role key from Supabase → Settings → API.",
  );
}

