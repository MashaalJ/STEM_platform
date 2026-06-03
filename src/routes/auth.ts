/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import { createClient } from "@supabase/supabase-js";
import {
  supabaseAdmin,
  hasSupabaseAdmin,
  supabaseAnonKey,
  resolvedSupabaseUrl,
  classifyServiceRoleKey,
  supabaseUrlsMisaligned,
} from "../../lib/supabaseAdmin";
import {
  selectOne,
  insertOne,
  updateRow,
  isUuid,
  getStudentPublic,
  findStudentByEmailOrUsername,
} from "../../lib/db";
import * as SQ from "../../lib/serverQueries";
import { enrichUserWithSchool } from "../../lib/schoolScope.ts";
import { asyncRoute, V, getReqUser, type SessionUser } from "./_middleware.ts";

type SignupProfilePayload = {
  name: string;
  role: string;
  age?: number | null;
  grade?: string | null;
  school?: string | null;
  city?: string | null;
  email?: string | null;
  parent_email?: string | null;
  contact_number?: string | null;
  gender?: string | null;
  country_code?: string | null;
  region?: string | null;
  timezone?: string | null;
};

export type AuthRouterDeps = {
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  rateLimitSignup: express.RequestHandler;
  rateLimitLogin: express.RequestHandler;
  rateLimitLinkChild: express.RequestHandler;
  linkSupabaseUserToLocalStudent: (
    sbUser: { id: string; email?: string | null },
    metadata: Record<string, unknown>,
  ) => Promise<SessionUser | undefined>;
  sanitizeUser: (user: Record<string, unknown> | null, viewerRole?: string) => Record<string, unknown> | null;
  hashPassword: (plain: string) => string;
  ensureStudentUsername: () => Promise<string>;
  enrollStudentInDefaultClass: (studentId: string) => Promise<void>;
  attachStudentToDefaultIndividualSchool: (studentId: string) => Promise<void>;
  bumpLastActive: (userId: string) => Promise<void>;
  normalizeGender: (raw: unknown) => string | null;
  normalizeCountryCode: (raw: unknown) => string | null;
  isProduction: boolean;
  ALLOW_LOCAL_AUTH_FALLBACK: boolean;
  ENABLE_TEST_ACCOUNTS: boolean;
};

export default function createAuthRouter(deps: AuthRouterDeps): express.Router {
  const {
    requireAuth,
    requireRole,
    rateLimitSignup,
    rateLimitLogin,
    rateLimitLinkChild,
    linkSupabaseUserToLocalStudent,
    sanitizeUser,
    hashPassword,
    ensureStudentUsername,
    enrollStudentInDefaultClass,
    attachStudentToDefaultIndividualSchool,
    bumpLastActive,
    normalizeGender,
    normalizeCountryCode,
    isProduction,
    ALLOW_LOCAL_AUTH_FALLBACK,
    ENABLE_TEST_ACCOUNTS,
  } = deps;

  const getSupabasePublicClient = () => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  };

  const publicUserForClient = async (userId: string, viewerRole?: string) => {
    const user = await getStudentPublic(userId);
    if (!user) return null;
    const enriched = await enrichUserWithSchool(user);
    return sanitizeUser(enriched, viewerRole);
  };

  const syncLocalStudentProfile = async (
    supabaseUserId: string,
    profile: SignupProfilePayload,
  ): Promise<{ user: Record<string, unknown>; username: string } | null> => {
    const {
      name,
      role,
      age,
      grade,
      school,
      city,
      email,
      parent_email,
      contact_number,
      gender: genderRaw,
      country_code: countryRaw,
      region: regionRaw,
      timezone: timezoneRaw,
    } = profile;
    if (!name || !role || !["student", "teacher", "parent", "school_admin"].includes(role)) return null;

    const gender = genderRaw != null ? normalizeGender(genderRaw) : null;
    const country_code = countryRaw != null ? normalizeCountryCode(countryRaw) : null;
    const region = regionRaw != null ? String(regionRaw).trim() || null : null;
    const timezone = timezoneRaw != null ? String(timezoneRaw).trim() || null : null;
    const normalizedSchool = String(school || "").trim();
    const avatarSeed = encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, "-"));
    const avatar_url = `https://picsum.photos/seed/${avatarSeed}/200`;
    const username = role === "student" ? await ensureStudentUsername() : null;

    const user = await SQ.upsertStudentProfile(
      supabaseUserId,
      {
        name,
        role,
        username,
        avatar_url,
        age: age ?? null,
        grade: grade ?? null,
        school: normalizedSchool || null,
        city: city ?? null,
        email: email ?? null,
        parent_email: parent_email ?? null,
        contact_number: contact_number ?? null,
        gender,
        country_code,
        region,
        timezone,
      },
      hashPassword(String(Math.random())),
    );
    if (!user) return null;
    await bumpLastActive(supabaseUserId);
    if (role === "student") {
      await attachStudentToDefaultIndividualSchool(supabaseUserId);
      await enrollStudentInDefaultClass(supabaseUserId);
    }
    // school_admin and teacher link to school via activation / invite codes after signup
    return { user, username: String((user as { username?: string }).username || username || "") };
  };

  const resolveEmailForLoginIdentifier = async (identifier: string): Promise<string | null> => {
    const trimmed = identifier.trim();
    if (!trimmed) return null;
    if (trimmed.includes("@")) return trimmed;
    const row = await findStudentByEmailOrUsername(trimmed);
    return String(row?.email || "").trim() || null;
  };

  const router = express.Router();

  router.get("/auth/health", (_req, res) => {
    const supabaseUrl = resolvedSupabaseUrl;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    let supabaseHost = "";
    try {
      if (supabaseUrl) supabaseHost = new URL(supabaseUrl).hostname;
    } catch {
      supabaseHost = "invalid_url";
    }
    res.json({
      success: true,
      auth: {
        mode: hasSupabaseAdmin ? "supabase_bearer" : "unconfigured",
        has_supabase_admin: hasSupabaseAdmin,
        has_supabase_url: Boolean(supabaseUrl),
        supabase_host: supabaseHost,
        supabase_urls_misaligned: supabaseUrlsMisaligned(),
        service_role_key_kind: classifyServiceRoleKey(serviceRoleKey),
        has_supabase_anon_key: Boolean(supabaseAnonKey),
        has_supabase_service_role_key: Boolean(serviceRoleKey),
        ...(isProduction
          ? {}
          : {
              allow_local_auth_fallback: ALLOW_LOCAL_AUTH_FALLBACK,
              enable_test_accounts: ENABLE_TEST_ACCOUNTS,
            }),
      },
    });
  });

  router.post(
    "/auth/resolve-email",
    requireAuth,
    requireRole(["parent", "teacher", "admin"]),
    rateLimitLinkChild,
    V.validateBody(V.resolveEmailSchema),
    asyncRoute(async (req, res) => {
      const identifier = String(req.body.identifier || "").trim();
      if (!identifier) {
        return res.status(400).json({ success: false, message: "identifier is required" });
      }
      const email = await resolveEmailForLoginIdentifier(identifier);
      if (!email) {
        return res.status(404).json({ success: false, message: "No account found for this identifier." });
      }
      res.json({ success: true, email });
    }),
  );

  router.post(
    "/auth/complete-signup",
    requireAuth,
    V.validateBody(V.completeSignupSchema),
    asyncRoute(async (req, res) => {
      const sessionUser = getReqUser(req)!;
      const authHeader = req.headers.authorization || "";
      const token = authHeader.match(/^Bearer\s+(.+)$/i)?.[1];
      if (!token || !hasSupabaseAdmin || !supabaseAdmin) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      const { data, error } = await supabaseAdmin.auth.getUser(token);
      if (error || !data?.user) {
        return res.status(401).json({ success: false, message: "Invalid session" });
      }
      const supabaseUserId = data.user.id;
      if (sessionUser.id !== supabaseUserId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }

      const {
        name,
        role,
        age,
        grade,
        school,
        city,
        email,
        parent_email,
        contact_number,
        gender: genderRaw,
        country_code: countryRaw,
        region: regionRaw,
        timezone: timezoneRaw,
      } = req.body;

      if (!name || !role) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }
      if (!["student", "teacher", "parent", "school_admin"].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }
      const gender = normalizeGender(genderRaw);
      if (genderRaw != null && String(genderRaw).trim() !== "" && gender === null) {
        return res.status(400).json({ success: false, message: "Invalid gender value" });
      }
      const country_code = normalizeCountryCode(countryRaw);
      if (countryRaw != null && String(countryRaw).trim() !== "" && country_code === null) {
        return res.status(400).json({ success: false, message: "country_code must be ISO 3166-1 alpha-2 (e.g. US)" });
      }
      const region = regionRaw != null ? String(regionRaw).trim() || null : null;
      const timezone = timezoneRaw != null ? String(timezoneRaw).trim() || null : null;
      const normalizedSchool = String(school || "").trim();

      const synced = await syncLocalStudentProfile(supabaseUserId, {
        name,
        role,
        age: age != null ? Number(age) : null,
        grade: grade || null,
        school: normalizedSchool || null,
        city: city || null,
        email: email || data.user.email || null,
        parent_email: parent_email || null,
        contact_number: contact_number || null,
        gender,
        country_code,
        region,
        timezone,
      });
      if (!synced) {
        return res.status(500).json({ success: false, message: "Could not create local profile" });
      }
      res.json({ success: true, username: synced.username, user: sanitizeUser(synced.user) });
    }),
  );

  router.post("/signup", rateLimitSignup, V.validateBody(V.signupSchema), asyncRoute(async (req, res) => {
    const { name, password, role, email } = req.body;

    if (!hasSupabaseAdmin || !supabaseAdmin) {
      return res.status(503).json({ success: false, message: "Supabase auth is not configured." });
    }

    const username = role === "student" ? await ensureStudentUsername() : null;
    const mappedRole =
      role === "teacher" ? "educator" : role === "parent" ? "parent" : role === "school_admin" ? "school_admin" : role;

    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: mappedRole,
        ...(username ? { username } : {}),
        display_name: name,
      },
    });

    if (created.error || !created.data.user) {
      const msg = String(created.error?.message || "Signup failed");
      if (/already|exists|registered/i.test(msg)) {
        const existingSignIn = await supabaseAdmin.auth.signInWithPassword({ email, password });
        if (!existingSignIn.error && existingSignIn.data.user && existingSignIn.data.session?.access_token) {
          const existingMeta = (existingSignIn.data.user.user_metadata || {}) as Record<string, unknown>;
          const linked = await linkSupabaseUserToLocalStudent(existingSignIn.data.user, existingMeta);
          if (linked) {
            await bumpLastActive(linked.id);
            const enrichedUser = await publicUserForClient(linked.id, String(linked.role || role));
            if (enrichedUser) {
              return res.json({
                success: true,
                already_exists: true,
                message: "Account already existed. You are now signed in.",
                access_token: existingSignIn.data.session.access_token,
                refresh_token: existingSignIn.data.session.refresh_token,
                user: enrichedUser,
              });
            }
          }
        }
        return res.status(409).json({ success: false, message: "User already exists. Please sign in instead." });
      }
      return res.status(400).json({ success: false, message: msg });
    }

    const sbNew = created.data.user;
    const synced = await syncLocalStudentProfile(sbNew.id, {
      name,
      role,
      email: email || sbNew.email || null,
    });
    if (!synced?.user) {
      return res.status(500).json({ success: false, message: "Could not create profile" });
    }

    if (role === "parent") {
      const existingParent = await selectOne("parents", "id", { auth_id: sbNew.id });
      if (!existingParent) {
        await insertOne("parents", {
          auth_id: sbNew.id,
          name,
          email,
          student_id: null,
        });
      }
    }

    const signIn = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.session?.access_token) {
      return res.json({
        success: true,
        needs_email_confirmation: true,
        access_token: null,
        username: synced.username,
        user: await publicUserForClient(sbNew.id, role),
        message: "Account created. Sign in with your email and password.",
      });
    }

    await bumpLastActive(sbNew.id);
    const signupUser = await publicUserForClient(sbNew.id, role);
    return res.json({
      success: true,
      access_token: signIn.data.session.access_token,
      refresh_token: signIn.data.session.refresh_token,
      username: synced.username,
      user: signupUser,
    });
  }));

  router.post("/login", rateLimitLogin, V.validateBody(V.loginSchema), asyncRoute(async (req, res) => {
    try {
      const { name, username, email, password } = req.body;
      const identifier = String(email || username || name || "").trim();

      if (!hasSupabaseAdmin || !supabaseAdmin) {
        return res.status(503).json({ success: false, message: "Supabase auth is not configured." });
      }
      if (!identifier || !password) {
        return res.status(400).json({ success: false, message: "Username/email and password are required." });
      }
      let emailForAuth = identifier.includes("@") ? identifier : "";
      if (!emailForAuth) {
        emailForAuth = (await resolveEmailForLoginIdentifier(identifier)) || "";
      }
      if (!emailForAuth) {
        return res.status(401).json({
          success: false,
          message: "No account found for this username. Try email login once.",
        });
      }
      const signIn = await supabaseAdmin.auth.signInWithPassword({ email: emailForAuth, password });
      if (signIn.error || !signIn.data.user || !signIn.data.session?.access_token) {
        const rawMsg = signIn.error?.message || "Invalid credentials";
        const message = /invalid api key/i.test(rawMsg)
          ? isProduction
            ? "Server Supabase credentials are wrong. In Render, set SUPABASE_URL to your project URL and SUPABASE_SERVICE_ROLE_KEY to the service_role or secret key from the same project (no extra spaces). Redeploy, then check /api/auth/health."
            : `${rawMsg} — check SUPABASE_URL matches SUPABASE_SERVICE_ROLE_KEY's project and use the service_role/secret key, not anon/publishable.`
          : rawMsg;
        return res.status(401).json({ success: false, message });
      }
      const sbUser = signIn.data.user;
      const meta = (sbUser.user_metadata || {}) as Record<string, unknown>;
      const linked = await linkSupabaseUserToLocalStudent(sbUser, meta);
      if (!linked) {
        return res.status(500).json({
          success: false,
          message:
            "Could not link account to local profile. Run supabase/migrations/001_stemverse_schema.sql in Supabase SQL Editor, then restart the server.",
        });
      }

      const displayName = String(
        meta.display_name || meta.full_name || meta.name || (sbUser.email ? sbUser.email.split("@")[0] : "User"),
      );
      const avatar = `https://picsum.photos/seed/${encodeURIComponent(displayName.toLowerCase().replace(/\s+/g, "-"))}/200`;

      try {
        await updateRow("students", { id: linked.id }, {
          name: displayName,
          avatar_url: avatar,
          email: sbUser.email || undefined,
        });
      } catch (profileErr) {
        console.warn("[stemverse] login profile patch:", profileErr);
      }

      const linkedRole = String(linked.role || meta.role || "student").toLowerCase();
      if (linkedRole === "student") {
        await attachStudentToDefaultIndividualSchool(linked.id);
        await enrollStudentInDefaultClass(linked.id);
      }

      const loginUser = await publicUserForClient(linked.id, linkedRole);
      if (!loginUser) {
        return res.status(500).json({ success: false, message: "Could not load user profile." });
      }

      await bumpLastActive(linked.id);
      return res.json({
        success: true,
        access_token: signIn.data.session.access_token,
        refresh_token: signIn.data.session.refresh_token,
        user: loginUser,
      });
    } catch (err) {
      console.error("[stemverse] /api/login:", err instanceof Error ? err.message : err);
      return res.status(500).json({
        success: false,
        message: isProduction
          ? "Login failed due to a server error."
          : err instanceof Error && /students|schema cache/i.test(err.message)
            ? "Database schema not set up. Run supabase/migrations/001_stemverse_schema.sql in Supabase, then restart."
            : "Login failed due to a server error.",
      });
    }
  }));

  router.get("/me", requireAuth, asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req);
    if (!sessionUser) return res.status(401).json({ authenticated: false });
    const user = await getStudentPublic(sessionUser.id);
    if (!user) {
      return res.status(401).json({ authenticated: false });
    }
    const enriched = await enrichUserWithSchool(user);
    await bumpLastActive(sessionUser.id);
    res.json({ authenticated: true, user: sanitizeUser(enriched, String(enriched.role || "")) });
  }));

  router.patch("/me", requireAuth, V.validateBody(V.patchMeSchema), asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const allowed = [
      "name",
      "avatar_url",
      "age",
      "grade",
      "school",
      "city",
      "email",
      "parent_email",
      "contact_number",
      "gender",
      "country_code",
      "region",
      "timezone",
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.gender !== undefined) {
      const g = normalizeGender(updates.gender);
      if (req.body.gender != null && String(req.body.gender).trim() !== "" && g === null) {
        return res.status(400).json({ success: false, message: "Invalid gender value" });
      }
      updates.gender = g;
    }
    if (updates.country_code !== undefined) {
      const cc = normalizeCountryCode(updates.country_code);
      if (req.body.country_code != null && String(req.body.country_code).trim() !== "" && cc === null) {
        return res.status(400).json({ success: false, message: "country_code must be ISO 3166-1 alpha-2 (e.g. US)" });
      }
      updates.country_code = cc;
    }
    if (updates.region !== undefined) {
      updates.region = String(updates.region || "").trim() || null;
    }
    if (updates.timezone !== undefined) {
      updates.timezone = String(updates.timezone || "").trim() || null;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }
    await updateRow("students", { id: sessionUser.id }, updates);
    const user = await getStudentPublic(sessionUser.id);
    res.json({ success: true, user: sanitizeUser(user) });
  }));

  router.post(
    "/me/change-password",
    requireAuth,
    V.validateBody(V.changePasswordSchema),
    asyncRoute(async (req, res) => {
      const sessionUser = getReqUser(req)!;
      const { current_password, new_password } = req.body;
      if (!current_password || !new_password) {
        return res.status(400).json({ success: false, message: "Current password and new password required" });
      }
      if (new_password.length < 6) {
        return res.status(400).json({ success: false, message: "New password must be at least 6 characters" });
      }
      const row = await selectOne<{ email?: string | null }>("students", "email", { id: sessionUser.id });
      const email = String(row?.email || "").trim();
      const supabaseUserId = sessionUser.id;
      if (!email || !isUuid(supabaseUserId) || !hasSupabaseAdmin || !supabaseAdmin) {
        return res.status(400).json({
          success: false,
          message: "Password change requires a Supabase-linked account with email.",
        });
      }
      const supabasePublic = getSupabasePublicClient();
      if (!supabasePublic) {
        return res.status(500).json({ success: false, message: "Supabase environment is not configured." });
      }
      const verify = await supabasePublic.auth.signInWithPassword({ email, password: current_password });
      if (verify.error) {
        return res.status(401).json({ success: false, message: "Current password is incorrect" });
      }
      const updated = await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, { password: new_password });
      if (updated.error) {
        return res.status(400).json({
          error: isProduction
            ? "Password update failed. Check your current password and try again."
            : updated.error.message,
        });
      }
      await updateRow("students", { id: sessionUser.id }, { password: hashPassword(new_password) });
      res.json({ success: true });
    }),
  );

  router.post("/logout", asyncRoute(async (req, res) => {
    const token = req.headers.authorization?.split("Bearer ")[1];
    if (token && supabaseAdmin) {
      try {
        const adminAuth = supabaseAdmin.auth.admin as {
          signOut: (idOrJwt: string, scope?: "global" | "local" | "others") => Promise<{ error: unknown }>;
        };
        await adminAuth.signOut(token, "global");
      } catch {
        const { data } = await supabaseAdmin.auth.getUser(token);
        if (data?.user) {
          await supabaseAdmin.auth.admin.signOut(data.user.id, "global");
        }
      }
    }
    res.json({ success: true });
  }));

  return router;
}
