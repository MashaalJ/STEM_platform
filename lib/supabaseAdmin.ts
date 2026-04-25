import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Ensure env vars are loaded even when this module is imported before server bootstrap.
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const hasSupabaseAdmin = Boolean(supabaseUrl && serviceRoleKey);

export const supabaseAdmin = hasSupabaseAdmin
  ? createClient(String(supabaseUrl), serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

