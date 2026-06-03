import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Ensure env vars are loaded even when this module is imported before server bootstrap.
dotenv.config();

export const resolvedSupabaseUrl = String(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
).trim();

const supabaseUrl = resolvedSupabaseUrl || undefined;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
export const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

export const hasSupabaseAdmin = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = hasSupabaseAdmin
  ? createClient(String(supabaseUrl), serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

function normalizeUrl(url: string): string {
  return url.trim().replace(/\/+$/, "").toLowerCase();
}

/** True when SUPABASE_URL and VITE_SUPABASE_URL both set but point at different projects. */
export function supabaseUrlsMisaligned(): boolean {
  const a = process.env.SUPABASE_URL?.trim();
  const b = process.env.VITE_SUPABASE_URL?.trim();
  if (!a || !b) return false;
  return normalizeUrl(a) !== normalizeUrl(b);
}

export type ServiceRoleKeyKind =
  | "missing"
  | "jwt_service_role"
  | "jwt_anon"
  | "sb_secret"
  | "sb_publishable"
  | "unrecognized";

export function classifyServiceRoleKey(key: string): ServiceRoleKeyKind {
  const k = key.trim();
  if (!k) return "missing";
  if (k.startsWith("sb_secret_")) return "sb_secret";
  if (k.startsWith("sb_publishable_")) return "sb_publishable";
  const role = jwtRole(k);
  if (role === "service_role") return "jwt_service_role";
  if (role === "anon") return "jwt_anon";
  return "unrecognized";
}

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

const serviceRoleKind = classifyServiceRoleKey(serviceRoleKey);
if (
  hasSupabaseAdmin &&
  serviceRoleKey &&
  serviceRoleKind !== "jwt_service_role" &&
  serviceRoleKind !== "sb_secret"
) {
  console.warn(
    `[stemverse] SUPABASE_SERVICE_ROLE_KEY looks like "${serviceRoleKind}", not a server secret. ` +
      "Use service_role (JWT) or sb_secret_… from Supabase → Settings → API.",
  );
}

