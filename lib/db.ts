import { supabaseAdmin } from "./supabaseAdmin";

export type DbRow = Record<string, unknown>;

export function db() {
  if (!supabaseAdmin) {
    throw new Error("Supabase is not configured (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)");
  }
  return supabaseAdmin;
}

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function optionalUuid(value: unknown): string | null {
  if (value == null || value === "" || value === 0) return null;
  const s = String(value).trim();
  return isUuid(s) ? s : null;
}

export function requireUuid(value: unknown, label = "id"): string | null {
  const s = optionalUuid(value);
  return s;
}

export async function selectOne<T = DbRow>(
  table: string,
  columns: string,
  match: Record<string, unknown>,
): Promise<T | null> {
  let q = db().from(table).select(columns);
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { data, error } = await q.maybeSingle();
  if (error) throw new Error(`${table} selectOne: ${error.message}`);
  return (data as T) ?? null;
}

export async function selectMany<T = DbRow>(
  table: string,
  columns = "*",
  match?: Record<string, unknown>,
  order?: { column: string; ascending?: boolean },
): Promise<T[]> {
  let q = db().from(table).select(columns);
  if (match) for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  if (order) q = q.order(order.column, { ascending: order.ascending ?? true });
  const { data, error } = await q;
  if (error) throw new Error(`${table} selectMany: ${error.message}`);
  return (data as T[]) ?? [];
}

export async function insertOne<T = DbRow>(table: string, row: DbRow, columns = "*"): Promise<T> {
  const { data, error } = await db().from(table).insert(row).select(columns).single();
  if (error) throw new Error(`${table} insert: ${error.message}`);
  return data as T;
}

export async function insertMany(table: string, rows: DbRow[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await db().from(table).insert(rows);
  if (error) throw new Error(`${table} insertMany: ${error.message}`);
}

export async function updateRow(
  table: string,
  match: Record<string, unknown>,
  patch: DbRow,
): Promise<void> {
  let q = db().from(table).update(patch);
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { error } = await q;
  if (error) throw new Error(`${table} update: ${error.message}`);
}

export async function deleteRows(table: string, match: Record<string, unknown>): Promise<void> {
  let q = db().from(table).delete();
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { error } = await q;
  if (error) throw new Error(`${table} delete: ${error.message}`);
}

export async function countRows(
  table: string,
  match?: Record<string, unknown>,
): Promise<number> {
  let q = db().from(table).select("*", { count: "exact", head: true });
  if (match) for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw new Error(`${table} count: ${error.message}`);
  return count ?? 0;
}

export async function upsertRow<T = DbRow>(
  table: string,
  row: DbRow,
  onConflict: string,
  columns = "*",
): Promise<T> {
  const { data, error } = await db().from(table).upsert(row, { onConflict }).select(columns).single();
  if (error) throw new Error(`${table} upsert: ${error.message}`);
  return data as T;
}

/** Case-insensitive name lookup (ilike). */
export async function findStudentByName(name: string): Promise<DbRow | null> {
  const trimmed = name.trim();
  const { data, error } = await db()
    .from("students")
    .select("id, name, role, username, email")
    .ilike("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findStudentByName: ${error.message}`);
  return data;
}

export async function findSectorByName(name: string): Promise<DbRow | null> {
  const { data, error } = await db()
    .from("sectors")
    .select("*")
    .ilike("name", name)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findSectorByName: ${error.message}`);
  return data;
}

export async function usernameExists(username: string): Promise<boolean> {
  const { data, error } = await db()
    .from("students")
    .select("id")
    .ilike("username", username)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`usernameExists: ${error.message}`);
  return Boolean(data);
}

export async function joinCodeExists(code: string): Promise<boolean> {
  const { data, error } = await db()
    .from("classes")
    .select("id")
    .eq("join_code", code)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`joinCodeExists: ${error.message}`);
  return Boolean(data);
}

export const STUDENT_SELECT_PUBLIC =
  "id, name, username, level, xp, avatar_url, role, age, grade, school, city, email, parent_email, contact_number, created_at, gender, country_code, region, timezone, subscription_status, subscription_plan, billing_provider, mrr_cents, ltv_cents, last_active_at";

export async function getStudentPublic(id: string): Promise<DbRow | null> {
  return selectOne("students", STUDENT_SELECT_PUBLIC, { id });
}

export async function getStudentRole(id: string): Promise<string | null> {
  const row = await selectOne<{ role: string }>("students", "role", { id });
  return row?.role ?? null;
}

export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function countRowsGte(
  table: string,
  timeColumn: string,
  sinceIso: string,
  match?: Record<string, unknown>,
): Promise<number> {
  let q = db().from(table).select("*", { count: "exact", head: true }).gte(timeColumn, sinceIso);
  if (match) for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const { count, error } = await q;
  if (error) throw new Error(`${table} countGte: ${error.message}`);
  return count ?? 0;
}

/** Insert junction row; ignore duplicate primary key. */
export async function insertIgnore(table: string, row: DbRow, onConflict: string): Promise<boolean> {
  const { error } = await db().from(table).upsert(row, { onConflict, ignoreDuplicates: true });
  if (error) throw new Error(`${table} insertIgnore: ${error.message}`);
  return true;
}

export async function findStudentByEmailOrUsername(identifier: string): Promise<DbRow | null> {
  const trimmed = identifier.trim();
  const { data, error } = await db()
    .from("students")
    .select("id, email, name, username")
    .or(`email.ilike.${trimmed},username.ilike.${trimmed},name.ilike.${trimmed}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findStudentByEmailOrUsername: ${error.message}`);
  return data;
}

export async function selectDistinctSchools(): Promise<string[]> {
  const { data, error } = await db()
    .from("students")
    .select("school")
    .not("school", "is", null)
    .neq("school", "");
  if (error) throw new Error(`selectDistinctSchools: ${error.message}`);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of data || []) {
    const s = String((row as { school?: string }).school || "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
