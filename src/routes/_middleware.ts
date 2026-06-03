/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin, hasSupabaseAdmin } from "../../lib/supabaseAdmin";
import { getStudentRole, isUuid, selectOne, updateRow } from "../../lib/db";

export * as V from "../../lib/apiValidation.ts";

export type SessionUser = { id: string; name: string; role: string };

/** req.user = Supabase auth user; req.sessionUser = linked students row for handlers. */
export type AuthRequest = express.Request & { user?: User; sessionUser?: SessionUser };

export const asyncRoute =
  (fn: (req: express.Request, res: express.Response, next?: express.NextFunction) => Promise<unknown>) =>
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getReqUser = (req: express.Request): SessionUser | undefined =>
  (req as AuthRequest).sessionUser;

export const setSessionUser = (req: express.Request, user: SessionUser) => {
  (req as AuthRequest).sessionUser = user;
};

const schoolStatusCache = new Map<string, { status: string; cachedAt: number }>();

function getCachedSchoolStatus(schoolId: string): string | null {
  const cached = schoolStatusCache.get(schoolId);
  if (cached && Date.now() - cached.cachedAt < 60_000) {
    return cached.status;
  }
  return null;
}

async function getSchoolSubscriptionStatus(schoolId: string): Promise<string> {
  const cached = getCachedSchoolStatus(schoolId);
  if (cached) return cached;
  const school = await selectOne<{ subscription_status?: string }>(
    "schools",
    "subscription_status",
    { id: schoolId },
  );
  const status = String(school?.subscription_status || "").trim().toLowerCase();
  schoolStatusCache.set(schoolId, { status, cachedAt: Date.now() });
  return status;
}

function isSchoolSuspensionExempt(req: express.Request): boolean {
  const path = (req.originalUrl || req.url || "").split("?")[0];
  if (req.method === "POST" && (path === "/api/logout" || path === "/api/auth/logout")) return true;
  if (req.method === "GET" && path === "/api/auth/health") return true;
  if (req.method === "GET" && path === "/api/me") return true;
  return false;
}

async function enforceSchoolNotSuspended(
  req: express.Request,
  res: express.Response,
  sessionUser: SessionUser,
): Promise<boolean> {
  if (isSchoolSuspensionExempt(req)) return true;
  const row = await selectOne<{ school_id?: string }>("students", "school_id", { id: sessionUser.id });
  const schoolId = row?.school_id != null ? String(row.school_id) : "";
  if (!schoolId || !isUuid(schoolId)) return true;
  const status = await getSchoolSubscriptionStatus(schoolId);
  if (status !== "suspended") return true;
  res.status(403).json({
    error: "school_suspended",
    message:
      "Your school account has been suspended. Please contact your school administrator.",
  });
  return false;
}

const isAiRoutePath = (path: string) =>
  path.includes("/generate-quiz") || /\/recommendations$/.test(path) || path.includes("/chat/stembot");

export function createRateLimiters() {
  const isDev = process.env.NODE_ENV !== "production";
  const devBypassSecret = process.env.DEV_BYPASS_SECRET || "";
  const devBypass = (req: express.Request) =>
    isDev &&
    Boolean(devBypassSecret) &&
    req.headers["x-dev-bypass"] === devBypassSecret;

  const globalRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      if (devBypass(req)) return true;
      if (req.method === "POST" && (req.path === "/api/login" || req.path === "/api/signup")) return true;
      if (req.method === "POST" && req.path === "/api/parent/link-child") return true;
      if (isAiRoutePath(req.path)) return true;
      return false;
    },
    message: { success: false, message: "Too many requests. Please slow down." },
  });

  const rateLimitLogin = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => devBypass(req),
    message: { success: false, message: "Too many login attempts. Try again in 15 minutes." },
  });

  const rateLimitSignup = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => devBypass(req),
    message: { success: false, message: "Too many signup attempts. Try again later." },
  });

  const rateLimitLinkChild = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => devBypass(req),
    message: { success: false, message: "Too many link attempts. Try again later." },
  });

  const rateLimitAi = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => devBypass(req),
    keyGenerator: (req) => {
      const uid = getReqUser(req)?.id;
      if (uid) return uid;
      return ipKeyGenerator(req.ip ?? "127.0.0.1");
    },
    message: { success: false, message: "Too many AI requests this hour. Try again later." },
  });

  return { globalRateLimit, rateLimitLogin, rateLimitSignup, rateLimitLinkChild, rateLimitAi };
}

export type LinkSupabaseUserFn = (
  sbUser: { id: string; email?: string | null },
  metadata: Record<string, unknown>,
) => Promise<SessionUser | undefined>;

export function createAuthMiddleware(linkSupabaseUserToLocalStudent: LinkSupabaseUserFn) {
  const tryAttachUserFromAuthorizationHeader = async (req: express.Request): Promise<boolean> => {
    if (!hasSupabaseAdmin || !supabaseAdmin) return false;
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) return false;
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return false;
    const authReq = req as AuthRequest;
    authReq.user = data.user;
    const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
    const sessionUser = await linkSupabaseUserToLocalStudent(data.user, meta);
    if (!sessionUser) return false;
    authReq.sessionUser = sessionUser;
    return true;
  };

  const requireAuth: express.RequestHandler = asyncRoute(async (req, res, next) => {
    if (!hasSupabaseAdmin || !supabaseAdmin) {
      return res.status(503).json({
        error: "Auth not configured",
        message: "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Render, then redeploy.",
      });
    }
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (!token) {
      return res.status(401).json({
        error: "No token",
        message: "Missing Authorization header. Sign in again.",
      });
    }
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid token" });
    const authReq = req as AuthRequest;
    authReq.user = data.user;
    const meta = (data.user.user_metadata || {}) as Record<string, unknown>;
    const sessionUser = await linkSupabaseUserToLocalStudent(data.user, meta);
    if (!sessionUser) return res.status(401).json({ error: "Invalid token" });
    authReq.sessionUser = sessionUser;
    if (!(await enforceSchoolNotSuspended(req, res, sessionUser))) return;
    next();
  });

  const optionalAuth: express.RequestHandler = asyncRoute(async (req, _res, next) => {
    await tryAttachUserFromAuthorizationHeader(req);
    next();
  });

  const requireRole = (roles: Array<SessionUser["role"]>): express.RequestHandler => {
    return asyncRoute(async (req, res, next) => {
      const authUser = (req as AuthRequest).user;
      if (!authUser) {
        return res.status(401).json({
          error: "No token",
          message: "Missing Authorization header. Sign in again.",
        });
      }
      let role = (await getStudentRole(authUser.id)) || getReqUser(req)?.role;
      if ((!role || !roles.includes(role)) && roles.includes("parent")) {
        const parentRow = await selectOne("parents", "id", { auth_id: authUser.id });
        if (parentRow) {
          role = "parent";
          const sessionUser = getReqUser(req);
          if (sessionUser?.role !== "parent") {
            try {
              await updateRow("students", { id: authUser.id }, { role: "parent" });
            } catch {
              /* ignore */
            }
            if (sessionUser) setSessionUser(req, { ...sessionUser, role: "parent" });
          }
        }
      }
      if (!role || !roles.includes(role)) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
      const sessionUser = getReqUser(req);
      if (sessionUser) setSessionUser(req, { ...sessionUser, role });
      next();
    });
  };

  const requireStudentAccess: express.RequestHandler = asyncRoute(async (req, res, next) => {
    const user = getReqUser(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    const studentId = req.params.id;
    if (!isUuid(studentId)) return res.status(400).json({ success: false, message: "Invalid id" });
    const role = (await getStudentRole(user.id)) || user.role;
    if (role === "student" && user.id !== studentId) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    next();
  });

  return {
    requireAuth,
    optionalAuth,
    requireRole,
    requireStudentAccess,
    tryAttachUserFromAuthorizationHeader,
  };
}
