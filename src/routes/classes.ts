/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  db,
  selectOne,
  selectMany,
  insertOne,
  updateRow,
  deleteRows,
  countRows,
  insertIgnore,
  isUuid,
  optionalUuid,
  provisionRosterStudent,
  enrollStudentInClass,
  getStudentPublic,
  type DbRow,
} from "../../lib/db";
import * as Curriculum from "../../lib/curriculum";
import * as SQ from "../../lib/serverQueries";
import { xpToLevel } from "../../lib/xp.ts";
import { assertSchoolStudentCapacity } from "../../lib/schoolLimits.ts";
import { generateRosterPassword, type RosterCredentialRow } from "../../lib/rosterCredentials.ts";
import { findSectorByName } from "../../lib/db";
import { asyncRoute, V, getReqUser } from "./_middleware.ts";

export type ClassesRouterDeps = {
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  getReqUser: typeof getReqUser;
  isProduction: boolean;
  ensureUniqueJoinCode: () => Promise<string>;
  hashPassword: (plain: string) => string;
  ensureUniqueUsername: (raw: string) => Promise<string>;
  bumpLastActive: (userId: string) => Promise<void>;
  hasSupabaseAdmin: boolean;
  supabaseAdmin: SupabaseClient | null;
  findStudentByName: (name: string) => Promise<DbRow | null>;
};

export async function ensureClassAccess(
  req: express.Request,
  res: express.Response,
  classId: string,
): Promise<{ ok: boolean }> {
  const user = getReqUser(req);
  if (!user) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return { ok: false };
  }
  if (!isUuid(classId)) {
    res.status(400).json({ success: false, message: "Invalid class id" });
    return { ok: false };
  }
  const cls = await selectOne<{ id: string; teacher_id: string | null }>("classes", "id, teacher_id", { id: classId });
  if (!cls) {
    res.status(404).json({ success: false, message: "Class not found" });
    return { ok: false };
  }
  if (user.role === "admin" || cls.teacher_id === user.id) {
    return { ok: true };
  }
  res.status(403).json({ success: false, message: "Forbidden" });
  return { ok: false };
}

export default function createClassesRouter(deps: ClassesRouterDeps): express.Router {
  const {
    requireAuth,
    requireRole,
    isProduction,
    ensureUniqueJoinCode,
    hashPassword,
    ensureUniqueUsername,
    bumpLastActive,
    hasSupabaseAdmin,
    supabaseAdmin,
    findStudentByName,
  } = deps;

  const router = express.Router();

  const handleEnsureJoinCode = async (req: express.Request, res: express.Response) => {
    const id = req.params.id ?? req.body?.class_id;
    const classId = id != null ? String(id) : "";
    if (!isUuid(classId)) {
      return res.status(400).json({ error: "Class id required" });
    }
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const row = await selectOne<{ id: string; join_code: string | null }>("classes", "id, join_code", { id: classId });
    if (!row) return res.status(404).json({ error: "Class not found" });
    let code = row.join_code != null && String(row.join_code).trim() !== "" ? String(row.join_code).trim() : null;
    if (!code) {
      code = await ensureUniqueJoinCode();
      await updateRow("classes", { id: row.id }, { join_code: code });
    }
    res.json({ join_code: code });
  };

  const handleAddStudentsByNames = async (req: express.Request, res: express.Response) => {
    try {
      const id = req.params.id ?? req.body?.class_id;
      const classId = id != null ? String(id) : "";
      if (!isUuid(classId)) {
        return res.status(400).json({ success: false, error: "Invalid class id" });
      }
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const { names } = req.body;
      const rawNames = Array.isArray(names) ? names.map((n: unknown) => String(n).trim()).filter(Boolean) : [];
      const seen = new Set<string>();
      const uniqueNames = rawNames.filter((n) => {
        const key = n.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const credentials: RosterCredentialRow[] = [];
      const created: string[] = [];
      let added = 0;
      const sessionUser = getReqUser(req)!;
      const teacherSchool = await selectOne<{ school_id: string | null }>("students", "school_id", {
        id: sessionUser.id,
      });

      const makeSyntheticEmail = (username: string) =>
        `${username}.${Date.now()}.${Math.floor(Math.random() * 1_000_000)}@students.stemverse.local`;

      for (const name of uniqueNames) {
        let row = await findStudentByName(name);
        let plainPassword = "";
        let isNew = false;

        if (!row) {
          isNew = true;
          plainPassword = generateRosterPassword(10);
          const avatarSeed = encodeURIComponent(name.toLowerCase().replace(/\s+/g, "-"));
          const avatar_url = `https://picsum.photos/seed/${avatarSeed}/200`;
          const username = await ensureUniqueUsername(name);
          let generatedEmail: string | null = null;
          let authUserId: string | null = null;

          if (hasSupabaseAdmin && supabaseAdmin) {
            for (let i = 0; i < 3 && !authUserId; i += 1) {
              const syntheticEmail = makeSyntheticEmail(username);
              const authCreated = await supabaseAdmin.auth.admin.createUser({
                email: syntheticEmail,
                password: plainPassword,
                email_confirm: true,
                user_metadata: {
                  role: "student",
                  username,
                  display_name: name,
                  generated_from_teacher_roster: true,
                },
              });
              if (!authCreated.error && authCreated.data?.user?.id) {
                authUserId = authCreated.data.user.id;
                generatedEmail = syntheticEmail;
              }
            }
          }

          if (!authUserId) {
            continue;
          }

          await provisionRosterStudent({
            id: authUserId,
            name,
            username,
            password: hashPassword(plainPassword),
            avatar_url,
            email: generatedEmail,
          });
          if (teacherSchool?.school_id) {
            await updateRow("students", { id: authUserId }, { school_id: String(teacherSchool.school_id) });
          }
          row = { id: authUserId, username, name };
          created.push(name);
        } else {
          const existing = await selectOne<{ username?: string | null; name?: string }>(
            "students",
            "username, name",
            { id: String(row.id) },
          );
          plainPassword = "";
          credentials.push({
            name: String(existing?.name || name),
            username: String(existing?.username || "").trim() || "(no username)",
            password: "",
            is_new: false,
            student_id: String(row.id),
          });
        }

        const before = await countRows("class_students", { class_id: classId, student_id: String(row.id) });
        await enrollStudentInClass(classId, String(row.id));
        const after = await countRows("class_students", { class_id: classId, student_id: String(row.id) });
        if (after > before) added += 1;

        if (isNew) {
          const username = String((row as { username?: string }).username || "");
          credentials.push({
            name,
            username,
            password: plainPassword,
            is_new: true,
            student_id: String(row.id),
          });
        }
      }

      res.json({ success: true, created, added, credentials });
    } catch (e: unknown) {
      const err = e as Error;
      console.error("by-names error:", e);
      res.status(500).json({ success: false, error: err?.message || "Failed to add students" });
    }
  };

  router.post(
    "/classes/:id/challenges",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.classChallengeSchema),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const clsTrack = await selectOne<{ curriculum_track?: string | null }>("classes", "curriculum_track", { id: classId });
      if (!clsTrack) return res.status(404).json({ success: false, error: "Class not found" });
      if (!clsTrack.curriculum_track || !String(clsTrack.curriculum_track).trim()) {
        return res.status(400).json({ success: false, error: "Set curriculum track first before deploying challenges." });
      }
      const { challenge_id } = req.body;
      if (!isUuid(challenge_id)) return res.status(400).json({ error: "challenge_id required" });
      const before = await countRows("class_challenges", { class_id: classId, challenge_id });
      await insertIgnore("class_challenges", { class_id: classId, challenge_id }, "class_id,challenge_id");
      const after = await countRows("class_challenges", { class_id: classId, challenge_id });
      if (after > before) {
        const cls = await selectOne<{ name: string }>("classes", "name", { id: classId });
        const ch = await selectOne<{ title: string }>("challenges", "title", { id: challenge_id });
        const students = await selectMany<{ student_id: string }>("class_students", "student_id", { class_id: classId });
        const title = "New assignment posted";
        const message = `${ch?.title || "A new challenge"} was assigned in ${cls?.name || "your class"}.`;
        const link = `challenge:${challenge_id}`;
        for (const s of students) {
          await insertOne("notifications", {
            user_id: s.student_id,
            type: "challenge_assigned",
            title,
            message,
            link,
            is_read: false,
          });
        }
      }
      res.json({ success: true });
    }),
  );

  router.delete(
    "/classes/:id/challenges/:challengeId",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      await deleteRows("class_challenges", { class_id: classId, challenge_id: req.params.challengeId });
      res.json({ success: true });
    }),
  );

  router.get("/classes", requireAuth, requireRole(["teacher", "admin", "school_admin"]), asyncRoute(async (req, res) => {
    try {
      const sessionUser = getReqUser(req)!;
      const { getUserSchoolId } = await import("../../lib/schoolScope.ts");
      const schoolId =
        sessionUser.role === "admin" || sessionUser.role === "teacher"
          ? null
          : await getUserSchoolId(sessionUser.id);
      const classes = await SQ.listClassesWithMeta(
        sessionUser.role === "teacher" ? sessionUser.id : undefined,
        schoolId,
      );
      res.json(classes);
    } catch (err) {
      console.error("[stemverse] GET /api/classes:", err);
      res.status(500).json({ error: isProduction ? "Could not load classes." : err instanceof Error ? err.message : "Could not load classes." });
    }
  }));

  router.get("/classes/:id", requireAuth, requireRole(["teacher", "admin"]), asyncRoute(async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, id)).ok) return;
    const cls = await selectOne("classes", "*", { id });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    res.json(cls);
  }));

  router.patch(
    "/classes/:id/ensure-join-code",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(handleEnsureJoinCode),
  );

  router.post(
    "/classes",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.createClassSchema),
    asyncRoute(async (req, res) => {
      const { name, teacher_id, description, curriculum_track } = req.body;
      const sessionUser = getReqUser(req)!;
      const effectiveTeacherId = sessionUser.role === "teacher" ? sessionUser.id : String(teacher_id || "");

      const trimmedName = typeof name === "string" ? name.trim() : "";
      if (!trimmedName) {
        return res.status(400).json({ success: false, error: "Class name is required" });
      }
      if (!isUuid(effectiveTeacherId)) {
        return res.status(400).json({ success: false, error: "Invalid teacher" });
      }

      const join_code = await ensureUniqueJoinCode();
      const teacherRow = await selectOne<{ school_id: string | null }>("students", "school_id", { id: effectiveTeacherId });
      const created = await insertOne<{ id: string }>("classes", {
        name: trimmedName,
        teacher_id: effectiveTeacherId,
        description: description || "",
        join_code,
        curriculum_track: String(curriculum_track || "").trim() || null,
        school_id: teacherRow?.school_id ? String(teacherRow.school_id) : null,
      });
      const starterMissionId = await SQ.getStarterMissionId();
      if (starterMissionId) {
        await insertIgnore(
          "class_missions",
          { class_id: created.id, mission_id: starterMissionId, assigned_by: effectiveTeacherId },
          "class_id,mission_id",
        );
      }
      res.json({ success: true, id: created.id, join_code });
    }),
  );

  router.post(
    "/classes/add-students-by-names",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.addStudentsByNamesSchema),
    asyncRoute(handleAddStudentsByNames),
  );

  router.post(
    "/classes/ensure-join-code",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(handleEnsureJoinCode),
  );

  router.patch(
    "/classes/:id/curriculum-track",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.patchClassCurriculumTrackSchema),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const cls = await selectOne("classes", "id", { id: classId });
      if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
      const curriculumTrack = normalizeCurriculumTrack(String(req.body?.curriculum_track || ""));
      if (!curriculumTrack) return res.status(400).json({ success: false, error: "curriculum_track is required" });
      await updateRow("classes", { id: classId }, { curriculum_track: curriculumTrack });
      res.json({ success: true, curriculum_track: curriculumTrack });
    }),
  );

  router.get("/classes/:id/curriculum", requireAuth, requireRole(["teacher", "admin"]), asyncRoute(async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    try {
      const data = await Curriculum.buildCurriculumForClass(classId);
      res.json(data);
    } catch (err) {
      console.error("[stemverse] /api/classes/:id/curriculum:", err);
      res.status(500).json({ error: isProduction ? "Could not load curriculum" : err instanceof Error ? err.message : "Could not load curriculum" });
    }
  }));

  router.get(
    "/classes/:id/curriculum-diagnostics",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;

      const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
      const run = async (name: string, fn: () => Promise<void>) => {
        try {
          await fn();
          checks.push({ name, ok: true, detail: "ok" });
        } catch (err) {
          checks.push({
            name,
            ok: false,
            detail: err instanceof Error ? err.message : String(err),
          });
        }
      };

      await run("classes row", async () => {
        const row = await selectOne("classes", "id, curriculum_track", { id: classId });
        if (!row) throw new Error("Class not found");
      });
      await run("sectors query", async () => {
        await selectMany("sectors", "id, name");
      });
      await run("missions query", async () => {
        await selectMany("missions", "id, sector_id, title");
      });
      await run("class_curriculum query", async () => {
        await selectMany("class_curriculum", "mission_id, class_id, custom_order", { class_id: classId });
      });
      await run("default_curriculum query", async () => {
        await selectMany("default_curriculum", "mission_id, custom_order");
      });
      await run("curriculums query", async () => {
        await selectMany("curriculums", "id, class_id, title, is_published", { class_id: classId });
      });
      await run("journeys query", async () => {
        await selectMany("journeys", "id, class_id, curriculum_id, sector_id", { class_id: classId });
      });
      await run("journey_nodes query", async () => {
        const js = await selectMany<{ id: string }>("journeys", "id", { class_id: classId });
        const ids = js.map((j) => String(j.id));
        if (!ids.length) return;
        const { error } = await db().from("journey_nodes").select("id, journey_id, sector_id, node_type").in("journey_id", ids).limit(5);
        if (error) throw new Error(error.message);
      });

      const ok = checks.every((c) => c.ok);
      res.status(ok ? 200 : 500).json({ success: ok, checks });
    }),
  );

  router.patch(
    "/classes/:id/curriculum",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.patchClassCurriculumSchema),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const missionId = String(req.body?.mission_id || "").trim();
      if (!isUuid(missionId)) return res.status(400).json({ success: false, error: "mission_id is required" });
      const sessionUser = getReqUser(req)!;
      try {
        const row = await Curriculum.upsertClassCurriculumRow(
          classId,
          {
            mission_id: missionId,
            is_enabled: req.body?.is_enabled,
            custom_order: req.body?.custom_order ?? null,
            custom_title: req.body?.custom_title ?? null,
            custom_description: req.body?.custom_description ?? null,
            unlock_after_mission_id: optionalUuid(req.body?.unlock_after_mission_id),
          },
          sessionUser.id,
        );
        res.json({ success: true, row });
      } catch (err) {
        console.error("[stemverse] /api/classes/:id/curriculum PATCH:", err);
        res.status(500).json({ success: false, error: isProduction ? "Could not save curriculum" : err instanceof Error ? err.message : "Could not save curriculum" });
      }
    }),
  );

  router.get("/default-curriculum", requireAuth, requireRole(["teacher", "admin"]), asyncRoute(async (_req, res) => {
    try {
      const data = await Curriculum.buildDefaultCurriculumView();
      res.json(data);
    } catch (err) {
      console.error("[stemverse] /api/default-curriculum:", err);
      res.status(500).json({ error: isProduction ? "Could not load default curriculum" : err instanceof Error ? err.message : "Could not load default curriculum" });
    }
  }));

  router.get("/advanced-curriculum", requireAuth, requireRole(["teacher", "admin"]), asyncRoute(async (_req, res) => {
    try {
      const advClass = await Curriculum.findClassByName(Curriculum.STEMVERSE_ADVANCED_CLASS_NAME);
      if (!advClass?.id) return res.status(404).json({ error: "Advanced curriculum class not bootstrapped yet" });
      const data = await Curriculum.buildCurriculumForClass(String(advClass.id));
      res.json(data);
    } catch (err) {
      console.error("[stemverse] /api/advanced-curriculum:", err);
      res.status(500).json({ error: isProduction ? "Could not load advanced curriculum" : err instanceof Error ? err.message : "Could not load advanced curriculum" });
    }
  }));

  router.patch(
    "/default-curriculum",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.patchClassCurriculumSchema),
    asyncRoute(async (req, res) => {
      const missionId = String(req.body?.mission_id || "").trim();
      if (!isUuid(missionId)) return res.status(400).json({ success: false, error: "mission_id is required" });
      const sessionUser = getReqUser(req)!;
      const defaultClass = await Curriculum.findClassByName(Curriculum.STEMVERSE_DEFAULT_CLASS_NAME);
      if (!defaultClass) return res.status(404).json({ success: false, error: "Default class not bootstrapped yet" });
      try {
        const row = await Curriculum.upsertClassCurriculumRow(
          String(defaultClass.id),
          {
            mission_id: missionId,
            is_enabled: req.body?.is_enabled,
            custom_order: req.body?.custom_order ?? null,
            custom_title: req.body?.custom_title ?? null,
            custom_description: req.body?.custom_description ?? null,
            unlock_after_mission_id: optionalUuid(req.body?.unlock_after_mission_id),
          },
          sessionUser.id,
        );
        res.json({ success: true, row });
      } catch (err) {
        console.error("[stemverse] /api/default-curriculum PATCH:", err);
        res.status(500).json({ success: false, error: isProduction ? "Could not save default curriculum" : err instanceof Error ? err.message : "Could not save default curriculum" });
      }
    }),
  );

  router.patch(
    "/advanced-curriculum",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.patchClassCurriculumSchema),
    asyncRoute(async (req, res) => {
      const missionId = String(req.body?.mission_id || "").trim();
      if (!isUuid(missionId)) return res.status(400).json({ success: false, error: "mission_id is required" });
      const sessionUser = getReqUser(req)!;
      const advancedClass = await Curriculum.findClassByName(Curriculum.STEMVERSE_ADVANCED_CLASS_NAME);
      if (!advancedClass) return res.status(404).json({ success: false, error: "Advanced class not bootstrapped yet" });
      try {
        const row = await Curriculum.upsertClassCurriculumRow(
          String(advancedClass.id),
          {
            mission_id: missionId,
            is_enabled: req.body?.is_enabled,
            custom_order: req.body?.custom_order ?? null,
            custom_title: req.body?.custom_title ?? null,
            custom_description: req.body?.custom_description ?? null,
            unlock_after_mission_id: optionalUuid(req.body?.unlock_after_mission_id),
          },
          sessionUser.id,
        );
        res.json({ success: true, row });
      } catch (err) {
        console.error("[stemverse] /api/advanced-curriculum PATCH:", err);
        res.status(500).json({ success: false, error: isProduction ? "Could not save advanced curriculum" : err instanceof Error ? err.message : "Could not save advanced curriculum" });
      }
    }),
  );

  router.post(
    "/classes/join",
    requireAuth,
    requireRole(["student"]),
    V.validateBody(V.joinClassSchema),
    asyncRoute(async (req, res) => {
      const { join_code } = req.body;
      const sessionUser = getReqUser(req)!;
      const code = String(join_code).trim().toUpperCase();
      const cls = await selectOne<{ id: string; name: string; school_id: string | null }>("classes", "id, name, school_id", {
        join_code: code,
      });
      if (!cls) {
        return res.status(404).json({ error: "Invalid or expired class code" });
      }
      const existing = await selectOne("class_students", "class_id", { class_id: cls.id, student_id: sessionUser.id });
      if (existing) {
        return res.status(400).json({ error: "Already in this class" });
      }
      if (cls.school_id) {
        const school = await selectOne<{ max_students: number }>("schools", "max_students", { id: String(cls.school_id) });
        const cap = await assertSchoolStudentCapacity(String(cls.school_id), Number(school?.max_students ?? 50), 1);
        if (!cap.ok) return res.status(403).json({ error: cap.ok === false ? cap.error : "Student limit reached" });
      }
      await insertOne("class_students", { class_id: cls.id, student_id: sessionUser.id });
      if (cls.school_id) {
        await updateRow("students", { id: sessionUser.id }, { school_id: String(cls.school_id) });
      }
      await bumpLastActive(sessionUser.id);
      res.json({ success: true, class_id: cls.id, class_name: cls.name });
    }),
  );

  router.post(
    "/classes/:id/add-students-by-names",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.addStudentsByNamesSchema),
    asyncRoute(handleAddStudentsByNames),
  );

  router.get(
    "/classes/:id/students",
    requireAuth,
    requireRole(["teacher", "admin", "school_admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const members = await selectMany<{ student_id: string }>("class_students", "student_id", { class_id: classId });
      const out = [];
      for (const m of members) {
        const s = await getStudentPublic(String(m.student_id));
        if (s) out.push(s);
      }
      out.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      res.json(out);
    }),
  );

  /** Students in this teacher's other classes who are not yet in the selected class. */
  router.get(
    "/classes/:id/available-students",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const cls = await selectOne<{ teacher_id: string | null }>("classes", "teacher_id", { id: classId });
      if (!cls?.teacher_id) return res.json([]);
      const teacherId = String(cls.teacher_id);
      const teacherClasses = await selectMany<{ id: string }>("classes", "id", { teacher_id: teacherId });
      const otherClassIds = teacherClasses.map((c) => String(c.id)).filter((id) => id !== classId);
      if (!otherClassIds.length) return res.json([]);

      const { data: memberRows, error } = await db()
        .from("class_students")
        .select("student_id")
        .in("class_id", otherClassIds);
      if (error) return res.status(500).json({ success: false, error: error.message });

      const inThisClass = await selectMany<{ student_id: string }>("class_students", "student_id", {
        class_id: classId,
      });
      const inThisSet = new Set(inThisClass.map((m) => String(m.student_id)));

      const candidateIds = [...new Set((memberRows || []).map((r) => String((r as { student_id: string }).student_id)))].filter(
        (sid) => !inThisSet.has(sid),
      );

      const out = [];
      for (const sid of candidateIds) {
        const s = await getStudentPublic(sid);
        if (s && String(s.role || "") === "student") out.push(s);
      }
      out.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      res.json(out);
    }),
  );

  router.post(
    "/classes/:id/students/bulk",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.bulkStudentsSchema),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const { student_ids } = req.body;
      const ids = Array.isArray(student_ids)
        ? student_ids.map((x: unknown) => String(x)).filter((s) => isUuid(s))
        : [];
      let added = 0;
      for (const sid of ids) {
        const before = await countRows("class_students", { class_id: classId, student_id: sid });
        await insertIgnore("class_students", { class_id: classId, student_id: sid }, "class_id,student_id");
        const after = await countRows("class_students", { class_id: classId, student_id: sid });
        if (after > before) added += 1;
      }
      res.json({ success: true, added, total: ids.length });
    }),
  );

  router.post(
    "/classes/:id/students",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.classStudentSchema),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const { student_id } = req.body;
      if (!isUuid(student_id)) return res.status(400).json({ success: false, error: "Invalid student id" });
      const cls = await selectOne<{ school_id: string | null }>("classes", "school_id", { id: classId });
      if (cls?.school_id) {
        const schoolClassIds = (
          await selectMany<{ id: string }>("classes", "id", { school_id: String(cls.school_id) })
        ).map((c) => String(c.id));
        let alreadyInSchool = false;
        if (schoolClassIds.length) {
          const { data: memberships } = await db()
            .from("class_students")
            .select("class_id")
            .eq("student_id", student_id)
            .in("class_id", schoolClassIds)
            .limit(1);
          alreadyInSchool = Boolean(memberships?.length);
        }
        if (!alreadyInSchool) {
          const school = await selectOne<{ max_students: number }>("schools", "max_students", { id: String(cls.school_id) });
          const cap = await assertSchoolStudentCapacity(String(cls.school_id), Number(school?.max_students ?? 50), 1);
          if (!cap.ok) return res.status(403).json({ error: cap.ok === false ? cap.error : "Student limit reached" });
        }
      }
      await insertIgnore("class_students", { class_id: classId, student_id }, "class_id,student_id");
      res.json({ success: true });
    }),
  );

  router.post(
    "/classes/:id/missions",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.classMissionSchema),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const cls = await selectOne<{ curriculum_track?: string | null }>("classes", "curriculum_track", { id: classId });
      if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
      if (!cls.curriculum_track || !String(cls.curriculum_track).trim()) {
        return res.status(400).json({ success: false, error: "Set curriculum track first before deploying missions." });
      }
      const { mission_id } = req.body;
      if (!isUuid(mission_id)) return res.status(400).json({ success: false, error: "Invalid mission id" });
      const assignerId = getReqUser(req)!.id;
      console.warn("[deprecated] Writing to class_missions. Use journey nodes instead.");
      await insertIgnore(
        "class_missions",
        { class_id: classId, mission_id, assigned_by: assignerId },
        "class_id,mission_id",
      );
      res.json({ success: true });
    }),
  );

  router.post(
    "/classes/:id/quizzes",
    requireAuth,
    requireRole(["teacher", "admin"]),
    V.validateBody(V.classQuizSchema),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const cls = await selectOne<{ curriculum_track?: string | null }>("classes", "curriculum_track", { id: classId });
      if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
      if (!cls.curriculum_track || !String(cls.curriculum_track).trim()) {
        return res.status(400).json({ success: false, error: "Set curriculum track first before deploying quizzes." });
      }
      const { quiz_id } = req.body;
      if (!isUuid(quiz_id)) return res.status(400).json({ success: false, error: "Invalid quiz id" });
      console.warn("[deprecated] Writing to class_quizzes. Use journey nodes instead.");
      await insertIgnore("class_quizzes", { class_id: classId, quiz_id }, "class_id,quiz_id");
      res.json({ success: true });
    }),
  );

  router.get("/classes/:id/activity-feed", requireAuth, requireRole(["teacher", "admin"]), asyncRoute(async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;

    const { data: memberships } = await db().from("class_students").select("student_id").eq("class_id", classId);
    const studentIds = [
      ...new Set((memberships || []).map((m) => String((m as { student_id: string }).student_id))),
    ];
    if (!studentIds.length) return res.json([]);

    const { data: completionRows, error } = await db()
      .from("student_mission_completions")
      .select("student_id, mission_id, completed_at")
      .in("student_id", studentIds)
      .order("completed_at", { ascending: false })
      .limit(50);
    if (error) {
      console.warn("[stemverse] /api/classes/:id/activity-feed:", error.message);
      return res.json([]);
    }
    const rows = completionRows || [];
    if (!rows.length) return res.json([]);

    const uniqueStudentIds = [...new Set(rows.map((r) => String((r as { student_id: string }).student_id)))];
    const uniqueMissionIds = [...new Set(rows.map((r) => String((r as { mission_id: string }).mission_id)))];

    const studentsMap = new Map<string, { username?: string | null; name?: string }>();
    for (const sid of uniqueStudentIds) {
      const s = await selectOne<{ username?: string | null; name?: string }>("students", "username, name", { id: sid });
      if (s) studentsMap.set(sid, s);
    }

    const missionsMap = new Map<string, { title?: string; xp_reward?: number; sector_id?: string | null }>();
    const sectorIds = new Set<string>();
    for (const mid of uniqueMissionIds) {
      const m = await selectOne<{ title?: string; xp_reward?: number; sector_id?: string | null }>(
        "missions",
        "title, xp_reward, sector_id",
        { id: mid },
      );
      if (m) {
        missionsMap.set(mid, m);
        if (m.sector_id) sectorIds.add(String(m.sector_id));
      }
    }

    const sectorsMap = new Map<string, string>();
    for (const secId of sectorIds) {
      const sec = await selectOne<{ name: string }>("sectors", "name", { id: secId });
      if (sec?.name) sectorsMap.set(secId, sec.name);
    }

    const feed = rows.map((row) => {
      const r = row as { student_id: string; mission_id: string; completed_at: string };
      const student = studentsMap.get(String(r.student_id));
      const mission = missionsMap.get(String(r.mission_id));
      const sectorId = mission?.sector_id ? String(mission.sector_id) : "";
      const username = String(student?.username || "").trim() || String(student?.name || "student");
      return {
        username,
        mission_title: mission?.title ?? "Mission",
        sector_name: sectorsMap.get(sectorId) ?? null,
        completed_at: r.completed_at,
        xp_earned: Number(mission?.xp_reward ?? 0),
      };
    });

    res.json(feed);
  }));

  router.get("/classes/:id/content", requireAuth, requireRole(["teacher", "admin"]), asyncRoute(async (req, res) => {
    const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;
    const { data: cm } = await db().from("class_missions").select("mission_id").eq("class_id", classId);
    const missionIds = (cm || []).map((r) => (r as { mission_id: string }).mission_id);
    const { selectAllMissions } = await import("../../lib/db");
    const allMissions = await selectAllMissions("*");
    const missions = missionIds.length
      ? { data: allMissions.filter((m) => missionIds.includes(String(m.id))) }
      : { data: [] };
    const { data: cq } = await db().from("class_quizzes").select("quiz_id").eq("class_id", classId);
    const quizIds = (cq || []).map((r) => (r as { quiz_id: string }).quiz_id);
    const quizzes = quizIds.length ? await db().from("quizzes").select("*").in("id", quizIds) : { data: [] };
    const { data: cc } = await db().from("class_challenges").select("challenge_id").eq("class_id", classId);
    const challengeIds = (cc || []).map((r) => (r as { challenge_id: string }).challenge_id);
    const challenges = challengeIds.length
      ? await db().from("challenges").select("*").in("id", challengeIds)
      : { data: [] };
    res.json({ missions: missions.data || [], quizzes: quizzes.data || [], challenges: challenges.data || [] });
  }));

  router.delete(
    "/classes/:id/missions/:missionId",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      await deleteRows("class_missions", { class_id: classId, mission_id: req.params.missionId });
      res.json({ success: true });
    }),
  );

  router.delete(
    "/classes/:id/quizzes/:quizId",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      await deleteRows("class_quizzes", { class_id: classId, quiz_id: req.params.quizId });
      res.json({ success: true });
    }),
  );

  const journeyNodeTypes = new Set(["mission", "challenge", "video", "reading", "practice"]);

  const canAccessCurriculum = async (req: express.Request, res: express.Response, curriculumId: string) => {
    if (!isUuid(curriculumId)) {
      res.status(400).json({ success: false, error: "Invalid curriculum id" });
      return null;
    }
    const curriculum = await selectOne<{ id: string; class_id: string }>("curriculums", "id, class_id", { id: curriculumId });
    if (!curriculum) {
      res.status(404).json({ success: false, error: "Curriculum not found" });
      return null;
    }
    if (!(await ensureClassAccess(req, res, String(curriculum.class_id))).ok) return null;
    return curriculum;
  };

  const canAccessJourney = async (req: express.Request, res: express.Response, journeyId: string) => {
    if (!isUuid(journeyId)) {
      res.status(400).json({ success: false, error: "Invalid journey id" });
      return null;
    }
    const journey = await selectOne<{ id: string; class_id: string; curriculum_id?: string | null }>(
      "journeys",
      "id, class_id, curriculum_id",
      { id: journeyId },
    );
    if (!journey) {
      res.status(404).json({ success: false, error: "Journey not found" });
      return null;
    }
    if (!(await ensureClassAccess(req, res, String(journey.class_id))).ok) return null;
    return journey;
  };

  router.get(
    "/classes/:id/curriculums",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const rows = await selectMany("curriculums", "*", { class_id: classId }, { column: "order_index", ascending: true });
      res.json(rows);
    }),
  );

  router.post(
    "/classes/:id/curriculums",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const title = String(req.body?.title || "").trim();
      if (!title) return res.status(400).json({ success: false, error: "title is required" });
      const orderIndex = Number(req.body?.order_index);
      const row = await insertOne("curriculums", {
        class_id: classId,
        title,
        description: String(req.body?.description || "").trim() || null,
        order_index: Number.isFinite(orderIndex) ? orderIndex : await countRows("curriculums", { class_id: classId }),
        is_published: Boolean(req.body?.is_published),
        created_by: getReqUser(req)!.id,
      });
      res.json({ success: true, curriculum: row });
    }),
  );

  router.patch(
    "/curriculums/:id",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const curriculum = await canAccessCurriculum(req, res, req.params.id);
      if (!curriculum) return;
      const patch: DbRow = {};
      if (req.body?.title != null) patch.title = String(req.body.title).trim();
      if (req.body?.description !== undefined) patch.description = String(req.body.description || "").trim() || null;
      if (req.body?.order_index !== undefined) patch.order_index = Number(req.body.order_index) || 0;
      if (req.body?.is_published !== undefined) patch.is_published = Boolean(req.body.is_published);
      await updateRow("curriculums", { id: String(curriculum.id) }, patch);
      const updated = await selectOne("curriculums", "*", { id: String(curriculum.id) });
      res.json({ success: true, curriculum: updated });
    }),
  );

  router.delete(
    "/curriculums/:id",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const curriculum = await canAccessCurriculum(req, res, req.params.id);
      if (!curriculum) return;
      await deleteRows("curriculums", { id: String(curriculum.id) });
      res.json({ success: true });
    }),
  );

  router.get(
    "/classes/:id/journeys",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const curriculumId = optionalUuid(req.query?.curriculum_id);
      const where: Record<string, unknown> = { class_id: classId };
      if (req.query?.curriculum_id !== undefined) where.curriculum_id = curriculumId;
      const journeys = await selectMany<DbRow>("journeys", "*", where, { column: "order_index", ascending: true });
      const withCounts = await Promise.all(
        journeys.map(async (j) => {
          const node_count = await countRows("journey_nodes", { journey_id: String(j.id) });
          return { ...j, node_count };
        }),
      );
      res.json(withCounts);
    }),
  );

  router.post(
    "/classes/:id/journeys",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const classId = req.params.id;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      if (!(await ensureClassAccess(req, res, classId)).ok) return;
      const title = String(req.body?.title || "").trim();
      if (!title) return res.status(400).json({ success: false, error: "title is required" });
      const orderIndex = Number(req.body?.order_index);
      const row = await insertOne("journeys", {
        title,
        description: String(req.body?.description || "").trim() || null,
        class_id: classId,
        curriculum_id: optionalUuid(req.body?.curriculum_id),
        sector_id: optionalUuid(req.body?.sector_id),
        is_deployed: req.body?.is_deployed === undefined ? false : Boolean(req.body?.is_deployed),
        created_by: getReqUser(req)!.id,
        is_default: Boolean(req.body?.is_default),
        order_index: Number.isFinite(orderIndex) ? orderIndex : await countRows("journeys", { class_id: classId }),
      });
      res.json({ success: true, journey: row });
    }),
  );

  const publishCurriculumForClass = async (
    classId: string,
    curriculumId: string | null | undefined,
    actorId: string,
  ): Promise<DbRow> => {
    let curriculum: DbRow | null = null;
    const cid = curriculumId != null ? String(curriculumId) : "";
    if (cid && isUuid(cid)) {
      curriculum = await selectOne<DbRow>("curriculums", "*", { id: cid, class_id: classId });
    }
    if (!curriculum) {
      const rows = await selectMany<DbRow>(
        "curriculums",
        "*",
        { class_id: classId },
        { column: "order_index", ascending: true },
      );
      curriculum = rows[0] ?? null;
    }
    if (!curriculum) {
      curriculum = await insertOne("curriculums", {
        class_id: classId,
        title: "Class curriculum",
        description: null,
        order_index: 0,
        is_published: true,
        created_by: actorId,
      });
    } else if (!curriculum.is_published) {
      await updateRow("curriculums", { id: String(curriculum.id) }, { is_published: true });
      curriculum = { ...curriculum, is_published: true };
    }
    return curriculum;
  };

  router.patch(
    "/journeys/:id",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const journey = await canAccessJourney(req, res, req.params.id);
      if (!journey) return;
      const patch: DbRow = {};
      if (req.body?.title != null) patch.title = String(req.body.title).trim();
      if (req.body?.description !== undefined) patch.description = String(req.body.description || "").trim() || null;
      if (req.body?.sector_id !== undefined) patch.sector_id = optionalUuid(req.body.sector_id);
      if (req.body?.is_deployed !== undefined) patch.is_deployed = Boolean(req.body.is_deployed);
      if (req.body?.is_default !== undefined) patch.is_default = Boolean(req.body.is_default);
      if (req.body?.order_index !== undefined) patch.order_index = Number(req.body.order_index) || 0;
      await updateRow("journeys", { id: String(journey.id) }, patch);

      const deploying = req.body?.is_deployed === true;
      const classId = journey.class_id != null ? String(journey.class_id) : "";
      if (deploying && classId && isUuid(classId)) {
        await publishCurriculumForClass(
          classId,
          journey.curriculum_id != null ? String(journey.curriculum_id) : null,
          getReqUser(req)!.id,
        );
      }

      const updated = await selectOne("journeys", "*", { id: String(journey.id) });
      const classRow =
        classId && isUuid(classId)
          ? await selectOne<{ name?: string }>("classes", "name", { id: classId })
          : null;
      res.json({
        success: true,
        journey: updated,
        class_name: classRow?.name ?? null,
        curriculum_published: deploying,
      });
    }),
  );

  router.delete(
    "/journeys/:id",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const journey = await canAccessJourney(req, res, req.params.id);
      if (!journey) return;
      await deleteRows("journeys", { id: String(journey.id) });
      res.json({ success: true });
    }),
  );

  router.get(
    "/journeys/:id/nodes",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const journey = await canAccessJourney(req, res, req.params.id);
      if (!journey) return;
      const nodes = await selectMany("journey_nodes", "*", { journey_id: String(journey.id) }, { column: "order_index", ascending: true });
      res.json(nodes);
    }),
  );

  router.post(
    "/journeys/:id/nodes",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const journey = await canAccessJourney(req, res, req.params.id);
      if (!journey) return;
      const nodeType = String(req.body?.node_type || "").trim().toLowerCase();
      if (!journeyNodeTypes.has(nodeType)) {
        return res.status(400).json({ success: false, error: "Invalid node_type" });
      }
      const orderIndex = Number(req.body?.order_index);
      const row = await insertOne("journey_nodes", {
        journey_id: String(journey.id),
        sector_id: optionalUuid(req.body?.sector_id),
        node_type: nodeType,
        content_id: optionalUuid(req.body?.content_id),
        content_url: String(req.body?.content_url || "").trim() || null,
        title: String(req.body?.title || "").trim() || null,
        order_index: Number.isFinite(orderIndex) ? orderIndex : await countRows("journey_nodes", { journey_id: String(journey.id) }),
        prerequisite_node_id: optionalUuid(req.body?.prerequisite_node_id),
        xp_reward: Number(req.body?.xp_reward) || 0,
      });
      res.json({ success: true, node: row });
    }),
  );

  router.patch(
    "/journey-nodes/:id",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const nodeId = req.params.id;
      if (!isUuid(nodeId)) return res.status(400).json({ success: false, error: "Invalid node id" });
      const node = await selectOne<{ id: string; journey_id: string }>("journey_nodes", "id, journey_id", { id: nodeId });
      if (!node) return res.status(404).json({ success: false, error: "Node not found" });
      const journey = await canAccessJourney(req, res, String(node.journey_id));
      if (!journey) return;
      const patch: DbRow = {};
      if (req.body?.node_type != null) {
        const nodeType = String(req.body.node_type).trim().toLowerCase();
        if (!journeyNodeTypes.has(nodeType)) return res.status(400).json({ success: false, error: "Invalid node_type" });
        patch.node_type = nodeType;
      }
      if (req.body?.content_id !== undefined) patch.content_id = optionalUuid(req.body.content_id);
      if (req.body?.sector_id !== undefined) patch.sector_id = optionalUuid(req.body.sector_id);
      if (req.body?.content_url !== undefined) patch.content_url = String(req.body.content_url || "").trim() || null;
      if (req.body?.title !== undefined) patch.title = String(req.body.title || "").trim() || null;
      if (req.body?.order_index !== undefined) patch.order_index = Number(req.body.order_index) || 0;
      if (req.body?.prerequisite_node_id !== undefined) patch.prerequisite_node_id = optionalUuid(req.body.prerequisite_node_id);
      if (req.body?.xp_reward !== undefined) patch.xp_reward = Number(req.body.xp_reward) || 0;
      await updateRow("journey_nodes", { id: nodeId }, patch);
      const updated = await selectOne("journey_nodes", "*", { id: nodeId });
      res.json({ success: true, node: updated });
    }),
  );

  router.delete(
    "/journey-nodes/:id",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const nodeId = req.params.id;
      if (!isUuid(nodeId)) return res.status(400).json({ success: false, error: "Invalid node id" });
      const node = await selectOne<{ id: string; journey_id: string }>("journey_nodes", "id, journey_id", { id: nodeId });
      if (!node) return res.status(404).json({ success: false, error: "Node not found" });
      const journey = await canAccessJourney(req, res, String(node.journey_id));
      if (!journey) return;
      await deleteRows("journey_nodes", { id: nodeId });
      res.json({ success: true });
    }),
  );

  router.patch(
    "/journey-nodes/reorder",
    requireAuth,
    requireRole(["teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const items = Array.isArray(req.body?.nodes) ? req.body.nodes : [];
      if (!items.length) return res.status(400).json({ success: false, error: "nodes array is required" });
      const firstId = String(items[0]?.id || "");
      if (!isUuid(firstId)) return res.status(400).json({ success: false, error: "Invalid node id" });
      const firstNode = await selectOne<{ id: string; journey_id: string }>("journey_nodes", "id, journey_id", { id: firstId });
      if (!firstNode) return res.status(404).json({ success: false, error: "Node not found" });
      const journey = await canAccessJourney(req, res, String(firstNode.journey_id));
      if (!journey) return;
      for (const it of items) {
        const id = String(it?.id || "");
        if (!isUuid(id)) continue;
        const orderIndex = Number(it?.order_index);
        await updateRow("journey_nodes", { id }, { order_index: Number.isFinite(orderIndex) ? orderIndex : 0 });
      }
      res.json({ success: true });
    }),
  );

  router.post(
    "/journey-nodes/:id/complete",
    requireAuth,
    requireRole(["student", "teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const nodeId = req.params.id;
      if (!isUuid(nodeId)) return res.status(400).json({ success: false, error: "Invalid node id" });
      const sessionUser = getReqUser(req)!;
      const node = await selectOne<{
        id: string;
        journey_id: string;
        prerequisite_node_id?: string | null;
        xp_reward?: number;
      }>("journey_nodes", "id, journey_id, prerequisite_node_id, xp_reward", { id: nodeId });
      if (!node) return res.status(404).json({ success: false, error: "Node not found" });

      if (node.prerequisite_node_id) {
        const pre = await selectOne("student_journey_progress", "student_id", {
          student_id: sessionUser.id,
          node_id: String(node.prerequisite_node_id),
        });
        if (!pre) return res.status(400).json({ success: false, error: "Complete prerequisite node first" });
      }

      const prior = await selectOne("student_journey_progress", "student_id", {
        student_id: sessionUser.id,
        node_id: nodeId,
      });
      let xpEarned = 0;
      if (!prior) {
        xpEarned = Math.max(0, Number(node.xp_reward) || 0);
        if (xpEarned > 0) {
          const studentRow = await selectOne<{ xp?: number }>("students", "xp", { id: sessionUser.id });
          const newXp = (Number(studentRow?.xp) || 0) + xpEarned;
          await updateRow("students", { id: sessionUser.id }, { xp: newXp, level: xpToLevel(newXp) });
        }
      }

      await insertIgnore(
        "student_journey_progress",
        {
          student_id: sessionUser.id,
          journey_id: String(node.journey_id),
          node_id: nodeId,
          completed_at: new Date().toISOString(),
        },
        "student_id,node_id",
      );
      await bumpLastActive(sessionUser.id);
      res.json({ success: true, xp_earned: xpEarned });
    }),
  );

  router.get(
    "/students/:id/journeys",
    requireAuth,
    requireRole(["student", "teacher", "admin"]),
    asyncRoute(async (req, res) => {
      const studentId = req.params.id;
      const sessionUser = getReqUser(req)!;
      if (!isUuid(studentId)) return res.status(400).json({ success: false, error: "Invalid student id" });
      if (sessionUser.role === "student" && sessionUser.id !== studentId) {
        return res.status(403).json({ success: false, error: "Forbidden" });
      }

      const memberships = await selectMany<{ class_id: string }>("class_students", "class_id", { student_id: studentId });
      const classIds = [...new Set(memberships.map((m) => String(m.class_id)))];

      let journeyRows: DbRow[] = [];
      if (classIds.length) {
        let journeys = await db()
          .from("journeys")
          .select("*")
          .in("class_id", classIds)
          .eq("is_deployed", true)
          .order("order_index", { ascending: true });
        if (journeys.error && /is_deployed/i.test(journeys.error.message || "")) {
          journeys = await db().from("journeys").select("*").in("class_id", classIds).order("order_index", { ascending: true });
        }
        journeyRows = (journeys.data || []) as DbRow[];
      } else {
        const studentRow = await selectOne<{ assigned_level?: string | null }>("students", "assigned_level", {
          id: studentId,
        });
        const profile = await selectOne<{
          recommended_sector_ids?: unknown;
          assigned_level?: string | null;
          start_sector_id?: string | null;
        }>("student_onboarding_profiles", "recommended_sector_ids, assigned_level, start_sector_id", {
          student_id: studentId,
        });
        const level = String(studentRow?.assigned_level || profile?.assigned_level || "").trim() || null;
        let sectorIds: string[] = [];
        if (Array.isArray(profile?.recommended_sector_ids) && profile.recommended_sector_ids.length) {
          sectorIds = profile.recommended_sector_ids.map((x) => String(x)).filter(Boolean);
        } else {
          const dark = await findSectorByName("Dark City");
          if (dark?.id) sectorIds = [String(dark.id)];
          else if (profile?.start_sector_id) sectorIds = [String(profile.start_sector_id)];
        }

        let journeys = await db()
          .from("journeys")
          .select("*")
          .eq("is_default", true)
          .eq("is_deployed", true)
          .is("class_id", null)
          .order("order_index", { ascending: true });
        if (journeys.error && /is_deployed|is_default|assigned_level/i.test(journeys.error.message || "")) {
          journeys = await db()
            .from("journeys")
            .select("*")
            .eq("is_default", true)
            .is("class_id", null)
            .order("order_index", { ascending: true });
        }
        journeyRows = ((journeys.data || []) as DbRow[]).filter((j) => {
          const sid = String(j.sector_id || "");
          if (sectorIds.length && sid && !sectorIds.includes(sid)) return false;
          const jLevel = j.assigned_level != null ? String(j.assigned_level) : "";
          if (level && jLevel && jLevel !== level) return false;
          return true;
        });
      }

      if (!journeyRows.length) return res.json({ journeys: [] });
      const journeyIds = journeyRows.map((j) => String(j.id));
      const nodes = await db().from("journey_nodes").select("*").in("journey_id", journeyIds).order("order_index", { ascending: true });
      const nodeRows = (nodes.data || []) as DbRow[];
      const progress = await db()
        .from("student_journey_progress")
        .select("node_id, completed_at")
        .eq("student_id", studentId)
        .in("journey_id", journeyIds);
      const completed = new Map(
        ((progress.data || []) as Array<{ node_id: string; completed_at: string }>).map((p) => [String(p.node_id), p.completed_at]),
      );
      const out = journeyRows.map((j) => {
        const jNodes = nodeRows
          .filter((n) => String(n.journey_id) === String(j.id))
          .map((n) => ({
            ...n,
            completed_at: completed.get(String(n.id)) || null,
            is_completed: completed.has(String(n.id)),
          }));
        return {
          ...j,
          nodes: jNodes,
          completed_count: jNodes.filter((n) => n.is_completed).length,
          total_count: jNodes.length,
        };
      });
      res.json({ journeys: out });
    }),
  );

  return router;
}
