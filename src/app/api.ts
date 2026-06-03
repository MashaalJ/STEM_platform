/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase } from '../../lib/supabaseClient';

/** Resolve JWT for API calls: localStorage first, then valid Supabase session, then refresh. */
export async function getAccessToken(): Promise<string | null> {
  const stored = localStorage.getItem('stemverse_access_token')?.trim() || null;
  if (!supabase) return stored;

  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (session?.access_token) {
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (!expiresAt || expiresAt > Date.now() + 15_000) {
      return session.access_token;
    }
  }

  if (stored) return stored;

  try {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const token = refreshed.session?.access_token?.trim();
    if (token) {
      localStorage.setItem('stemverse_access_token', token);
      return token;
    }
  } catch {
    /* ignore */
  }

  return stored;
}

const devBypassHeader = (): Record<string, string> => {
  if (!import.meta.env.DEV) return {};
  const secret = import.meta.env.VITE_DEV_BYPASS_SECRET;
  return secret ? { 'x-dev-bypass': String(secret) } : {};
};

export const SCHOOL_SUSPENDED_BANNER_KEY = 'stemverse_school_suspended_banner';

const SCHOOL_SUSPENDED_DEFAULT =
  'Your school account has been suspended. Contact your school administrator.';

async function handleSchoolSuspendedResponse(res: Response): Promise<boolean> {
  if (res.status !== 403) return false;
  try {
    const body = await res.clone().json() as { error?: string; message?: string };
    if (body?.error !== 'school_suspended') return false;
    localStorage.removeItem('stemverse_access_token');
    sessionStorage.setItem(
      SCHOOL_SUSPENDED_BANNER_KEY,
      String(body.message || SCHOOL_SUSPENDED_DEFAULT).trim() || SCHOOL_SUSPENDED_DEFAULT,
    );
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.assign('/login');
    }
    return true;
  } catch {
    return false;
  }
}

/** Attach Bearer token. On 401, clear stale session — do not retry unauthenticated (causes "No token"). */
const fetchWithOptionalBearerRetry = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = await getAccessToken();
  const headers = new Headers(init?.headers || {});
  for (const [k, v] of Object.entries(devBypassHeader())) headers.set(k, v);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(input, { ...init, headers, credentials: init?.credentials ?? 'include' });
  if (res.status === 401) {
    localStorage.removeItem('stemverse_access_token');
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    }
  } else {
    await handleSchoolSuspendedResponse(res);
  }
  return res;
};

const safeFetch = async (url: string, options?: RequestInit) => {
  try {
    const res = await fetchWithOptionalBearerRetry(url, options);
    if (!res.ok) {
      if (res.status !== 429) {
        const text = await res.text();
        console.error(`Fetch error for ${url}: ${res.status} ${text}`);
      }
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`Network error for ${url}:`, err);
    return null;
  }
};

// Same as safeFetch, but returns the raw Response so callers can inspect `ok` / `status`.
const fetchWithAuth = (url: string, options?: RequestInit) => fetchWithOptionalBearerRetry(url, options);

const authFetch = (input: string, init?: RequestInit) => fetchWithOptionalBearerRetry(input, init);
export { fetchWithOptionalBearerRetry, safeFetch, fetchWithAuth, authFetch };
