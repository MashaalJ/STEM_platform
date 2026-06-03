/**
 * School accounts: principal dashboard, admin school management, activation.
 */
import express from "express";
import {
  db,
  selectOne,
  selectMany,
  insertOne,
  updateRow,
  deleteRows,
  countRows,
  isUuid,
  getStudentPublic,
  getStudentRole,
  type DbRow,
} from "../../lib/db";
import {
  generateUniqueActivationCode,
  generateUniqueTeacherInviteCode,
  findSchoolByActivationCode,
  findTeacherInviteByCode,
  findSchoolByTeacherJoinCode,
  findUsedTeacherInviteByCode,
  ensureSchoolTeacherJoinCode,
  generateUniqueTeacherJoinCode,
  normalizeActivationCode,
} from "../../lib/schoolCodes";
import { enrichUserWithSchool, getUserSchoolId } from "../../lib/schoolScope";
import { asyncRoute, getReqUser } from "./_middleware.ts";

export type SchoolsRouterDeps = {
  requireAuth: express.RequestHandler;
  requireRole: (roles: string[]) => express.RequestHandler;
  sanitizeUser: (user: Record<string, unknown> | null, viewerRole?: string) => Record<string, unknown> | null;
  bumpLastActive: (userId: string) => Promise<void>;
};

async function schoolStats(schoolId: string) {
  const teachers = await selectMany<{ id: string; name: string; email: string | null; last_active_at: string | null; created_at: string }>(
    "students",
    "id, name, email, last_active_at, created_at",
    { school_id: schoolId, role: "teacher" },
  );
  const students = await selectMany<{ id: string; username: string | null; name: string; level: number; xp: number; last_active_at: string | null; created_at: string }>(
    "students",
    "id, username, name, level, xp, last_active_at, created_at",
    { school_id: schoolId, role: "student" },
  );
  const classes = await selectMany<{ id: string; name: string; teacher_id: string | null }>(
    "classes",
    "id, name, teacher_id",
    { school_id: schoolId },
  );

  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const studentIds = students.map((s) => String(s.id));
  let completionsThisWeek = 0;
  if (studentIds.length) {
    const { count } = await db()
      .from("student_journey_progress")
      .select("node_id", { count: "exact", head: true })
      .gte("completed_at", weekAgo)
      .in("student_id", studentIds);
    completionsThisWeek = count ?? 0;
  }

  const dailyActive: { day: string; count: number }[] = [];
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dayStart = d.toISOString();
    const dEnd = new Date(d);
    dEnd.setHours(23, 59, 59, 999);
    const dayEnd = dEnd.toISOString();
    let count = 0;
    if (studentIds.length) {
      const { data: dayRows } = await db()
        .from("student_journey_progress")
        .select("student_id")
        .in("student_id", studentIds)
        .gte("completed_at", dayStart)
        .lte("completed_at", dayEnd);
      count = new Set((dayRows || []).map((r) => String((r as { student_id: string }).student_id))).size;
    }
    dailyActive.push({ day: dayStart.slice(0, 10), count });
  }

  const teacherRows = [];
  for (const t of teachers) {
    const classCount = await countRows("classes", { teacher_id: t.id, school_id: schoolId });
    const classIds = (await selectMany<{ id: string }>("classes", "id", { teacher_id: t.id, school_id: schoolId })).map(
      (c) => String(c.id),
    );
    let activeStudents = 0;
    for (const cid of classIds) {
      activeStudents += await countRows("class_students", { class_id: cid });
    }
    const last = t.last_active_at ? new Date(t.last_active_at).getTime() : 0;
    const inactive = !last || Date.now() - last > 7 * 86400000;
    teacherRows.push({
      id: t.id,
      name: t.name,
      email: t.email,
      class_count: classCount,
      active_students: activeStudents,
      last_active_at: t.last_active_at,
      status: inactive ? "Inactive" : "Active",
      joined_at: t.created_at,
    });
  }

  const school = await selectOne<{ max_teachers: number; max_students: number }>(
    "schools",
    "max_teachers, max_students",
    { id: schoolId },
  );

  return {
    totals: {
      teachers: teachers.length,
      students: students.length,
      classes: classes.length,
      completions_this_week: completionsThisWeek,
    },
    limits: {
      max_teachers: Number(school?.max_teachers ?? 2),
      max_students: Number(school?.max_students ?? 50),
    },
    daily_active_students: dailyActive,
    teachers: teacherRows,
    students,
    classes,
  };
}

export default function createSchoolsRouter(deps: SchoolsRouterDeps): express.Router {
  const { requireAuth, requireRole, sanitizeUser, bumpLastActive } = deps;
  const router = express.Router();

  const requireSchoolAdmin = async (req: express.Request, res: express.Response) => {
    const user = getReqUser(req)!;
    if (user.role === "admin") return { ok: true as const, schoolId: optionalSchoolFromQuery(req) };
    if (user.role !== "school_admin") {
      res.status(403).json({ success: false, error: "Forbidden" });
      return { ok: false as const };
    }
    const schoolId = await getUserSchoolId(user.id);
    if (!schoolId) {
      res.status(403).json({ success: false, error: "Link your school with an activation code first." });
      return { ok: false as const };
    }
    return { ok: true as const, schoolId };
  };

  function optionalSchoolFromQuery(req: express.Request): string | null {
    const q = req.query.school_id;
    return typeof q === "string" && isUuid(q) ? q : null;
  }

  router.post(
    "/auth/activate-school",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const sessionUser = getReqUser(req)!;
      const code = normalizeActivationCode(String(req.body?.activation_code || ""));
      if (!code) return res.status(400).json({ success: false, error: "activation_code is required" });
      if (code.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Enter the full 8-character principal code from Admin → Schools (not a teacher invite code).",
        });
      }

      let role = (await getStudentRole(sessionUser.id)) || sessionUser.role;
      if (role !== "school_admin") {
        return res.status(403).json({
          success: false,
          error: "This account is not a Principal. Sign up with “I'm a Principal”, then enter the school code.",
        });
      }

      const school = await findSchoolByActivationCode(code);
      if (!school) {
        return res.status(404).json({
          success: false,
          error:
            "Invalid or already used code. Each code works once. In Admin → Schools, click Regenerate (↻) next to the school and copy the new code.",
        });
      }

      const existingAdmin = await selectOne("students", "id", {
        school_id: String(school.id),
        role: "school_admin",
      });
      if (existingAdmin && String(existingAdmin.id) !== sessionUser.id) {
        return res.status(400).json({ success: false, error: "This school already has a principal linked." });
      }

      await updateRow("students", { id: sessionUser.id }, { school_id: String(school.id), role: "school_admin" });
      const teacherJoinCode = await ensureSchoolTeacherJoinCode(String(school.id));
      await updateRow("schools", { id: String(school.id) }, { activation_code: null, teacher_join_code: teacherJoinCode });
      const user = await getStudentPublic(sessionUser.id);
      const enriched = user ? await enrichUserWithSchool(user) : null;
      res.json({ success: true, user: sanitizeUser(enriched, "school_admin") });
    }),
  );

  router.post(
    "/auth/activate-teacher-invite",
    requireAuth,
    requireRole(["teacher"]),
    asyncRoute(async (req, res) => {
      const sessionUser = getReqUser(req)!;
      const code = normalizeActivationCode(String(req.body?.code || req.body?.invite_code || ""));
      if (!code || code.length < 8) {
        return res.status(400).json({
          success: false,
          error: "Enter the full 8-character teacher invite code from your principal (not the principal school code).",
        });
      }

      const existingSchoolId = await getUserSchoolId(sessionUser.id);
      if (existingSchoolId) {
        const user = await getStudentPublic(sessionUser.id);
        const enriched = user ? await enrichUserWithSchool(user) : null;
        return res.json({ success: true, user: sanitizeUser(enriched, "teacher") });
      }

      let schoolId: string | null = null;
      const invite = await findTeacherInviteByCode(code);
      if (invite) {
        schoolId = String(invite.school_id);
      } else {
        const schoolByJoin = await findSchoolByTeacherJoinCode(code);
        if (schoolByJoin) {
          schoolId = String(schoolByJoin.id);
        } else if (await findUsedTeacherInviteByCode(code)) {
          return res.status(404).json({
            success: false,
            error:
              "That one-time invite was already used. Ask your principal for the shared school teacher code (Teachers tab) or click Invite teacher for a new single-use code.",
          });
        } else {
          return res.status(404).json({
            success: false,
            error:
              "Invalid code. Use the shared school teacher code or a one-time invite from your principal (not the principal school activation code).",
          });
        }
      }

      const school = await selectOne<{ max_teachers: number }>("schools", "max_teachers", { id: schoolId });
      const teacherCount = await countRows("students", { school_id: schoolId, role: "teacher" });
      if (school && teacherCount >= Number(school.max_teachers || 2)) {
        return res.status(400).json({ success: false, error: "This school has reached its teacher limit." });
      }

      await updateRow("students", { id: sessionUser.id }, { school_id: schoolId });
      if (invite) {
        await updateRow("teacher_invites", { id: String(invite.id) }, { used: true, used_by: sessionUser.id });
      }

      const user = await getStudentPublic(sessionUser.id);
      const enriched = user ? await enrichUserWithSchool(user) : null;
      res.json({ success: true, user: sanitizeUser(enriched, "teacher") });
    }),
  );

  router.get(
    "/school",
    requireAuth,
    requireRole(["school_admin", "teacher", "student"]),
    asyncRoute(async (req, res) => {
      const sessionUser = getReqUser(req)!;
      const schoolId = await getUserSchoolId(sessionUser.id);
      if (!schoolId) return res.status(404).json({ success: false, error: "No school linked" });
      const school = await selectOne("schools", "*", { id: schoolId });
      if (!school) return res.status(404).json({ success: false, error: "School not found" });
      if (sessionUser.role === "student") {
        return res.json({ id: school.id, name: school.name });
      }
      if (sessionUser.role === "school_admin") {
        const teacher_join_code = await ensureSchoolTeacherJoinCode(schoolId);
        return res.json({ ...school, teacher_join_code });
      }
      res.json(school);
    }),
  );

  router.patch(
    "/school",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const patch: DbRow = {};
      if (req.body?.name !== undefined) patch.name = String(req.body.name || "").trim();
      if (req.body?.city !== undefined) patch.city = String(req.body.city || "").trim() || null;
      if (req.body?.country !== undefined) patch.country = String(req.body.country || "").trim() || "Pakistan";
      if (!patch.name && "name" in patch) {
        return res.status(400).json({ success: false, error: "School name cannot be empty" });
      }
      await updateRow("schools", { id: access.schoolId }, patch);
      const school = await selectOne("schools", "*", { id: access.schoolId });
      res.json({ success: true, school });
    }),
  );

  router.get(
    "/school/stats",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      res.json(await schoolStats(access.schoolId));
    }),
  );

  router.get(
    "/school/teachers",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const stats = await schoolStats(access.schoolId);
      res.json(stats.teachers);
    }),
  );

  router.get(
    "/school/students",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const classId = optionalUuid(req.query.class_id);
      let students = (await schoolStats(access.schoolId)).students as DbRow[];
      if (classId) {
        const members = await selectMany<{ student_id: string }>("class_students", "student_id", { class_id: classId });
        const ids = new Set(members.map((m) => String(m.student_id)));
        students = students.filter((s) => ids.has(String(s.id)));
        const cls = await selectOne<{ name: string }>("classes", "name", { id: classId, school_id: access.schoolId });
        for (const s of students) {
          (s as DbRow).class_name = cls?.name || "—";
        }
      } else {
        for (const s of students) {
          const membership = await selectMany<{ class_id: string }>("class_students", "class_id", { student_id: String(s.id) });
          let className = "—";
          if (membership[0]) {
            const cls = await selectOne<{ name: string }>("classes", "name", { id: String(membership[0].class_id) });
            className = cls?.name || "—";
          }
          (s as DbRow).class_name = className;
        }
      }
      res.json(students);
    }),
  );

  router.get(
    "/school/classes",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const classes = await selectMany<DbRow>("classes", "*", { school_id: access.schoolId });
      const out = [];
      for (const c of classes) {
        const student_count = await countRows("class_students", { class_id: String(c.id) });
        const teacher = c.teacher_id
          ? await selectOne<{ name: string }>("students", "name", { id: String(c.teacher_id) })
          : null;
        const journeys = await selectMany<{ id: string; title: string; is_deployed?: boolean }>(
          "journeys",
          "id, title, is_deployed",
          { class_id: String(c.id) },
        );
        const deployed = journeys.filter((j) => j.is_deployed !== false);
        let completionRate = 0;
        const journeyId = deployed[0]?.id;
        if (journeyId) {
          const totalNodes = await countRows("journey_nodes", { journey_id: String(journeyId) });
          const members = await selectMany<{ student_id: string }>("class_students", "student_id", {
            class_id: String(c.id),
          });
          if (totalNodes > 0 && members.length) {
            let sumPct = 0;
            for (const m of members) {
              const done = await countRows("student_journey_progress", {
                student_id: String(m.student_id),
                journey_id: String(journeyId),
              });
              sumPct += Math.min(100, Math.round((done / totalNodes) * 100));
            }
            completionRate = Math.round(sumPct / members.length);
          }
        }
        out.push({
          ...c,
          student_count,
          teacher_name: teacher?.name || "Unassigned",
          active_journey: deployed[0]?.title || "—",
          completion_rate: completionRate,
          unassigned: !c.teacher_id,
        });
      }
      res.json(out);
    }),
  );

  router.get(
    "/school/classes/:classId/students",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const classId = req.params.classId;
      if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
      const cls = await selectOne("classes", "id", { id: classId, school_id: access.schoolId });
      if (!cls) return res.status(404).json({ success: false, error: "Class not found" });
      const members = await selectMany<{ student_id: string }>("class_students", "student_id", { class_id: classId });
      const out = [];
      for (const m of members) {
        const s = await getStudentPublic(String(m.student_id));
        if (!s) continue;
        const nodesDone = await countRows("student_journey_progress", { student_id: String(s.id) });
        out.push({ ...s, nodes_completed: nodesDone, progress_percent: Math.min(100, nodesDone * 10) });
      }
      res.json(out);
    }),
  );

  router.get(
    "/school/reports",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const classes = await selectMany<DbRow>("classes", "id, name", { school_id: access.schoolId });
      const byClass = [];
      for (const c of classes) {
        const student_count = await countRows("class_students", { class_id: String(c.id) });
        byClass.push({ class_id: c.id, class_name: c.name, student_count, completion_rate: 0 });
      }
      const topStudents = await selectMany<DbRow>(
        "students",
        "id, username, name, level, xp",
        { school_id: access.schoolId, role: "student" },
        { column: "xp", ascending: false },
      );
      res.json({
        completion_by_class: byClass,
        top_students: topStudents.slice(0, 10),
        engagement: { highest: "Journey nodes", lowest: "Optional bonus content" },
      });
    }),
  );

  router.post(
    "/school/invite-teacher",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const sessionUser = getReqUser(req)!;
      const school = await selectOne<{ max_teachers: number }>("schools", "max_teachers", { id: access.schoolId });
      const teacherCount = await countRows("students", { school_id: access.schoolId, role: "teacher" });
      if (school && teacherCount >= Number(school.max_teachers || 2)) {
        return res.status(403).json({
          error: "Teacher limit reached. Upgrade your subscription to add more teachers.",
        });
      }
      const code = await generateUniqueTeacherInviteCode();
      const row = await insertOne("teacher_invites", {
        school_id: access.schoolId,
        code,
        email: String(req.body?.email || "").trim() || null,
        used: false,
        created_by: sessionUser.id,
      });
      res.json({ success: true, invite: row });
    }),
  );

  router.get(
    "/school/invites",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const invites = await selectMany<DbRow>(
        "teacher_invites",
        "*",
        { school_id: access.schoolId, used: false },
        { column: "created_at", ascending: false },
      );
      res.json(invites);
    }),
  );

  router.delete(
    "/school/invites/:id",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const inviteId = req.params.id;
      if (!isUuid(inviteId)) return res.status(400).json({ success: false, error: "Invalid invite id" });
      const invite = await selectOne("teacher_invites", "id, school_id", { id: inviteId });
      if (!invite || String(invite.school_id) !== access.schoolId) {
        return res.status(404).json({ success: false, error: "Invite not found" });
      }
      await updateRow("teacher_invites", { id: inviteId }, { used: true });
      res.json({ success: true });
    }),
  );

  router.delete(
    "/school/teachers/:teacherId",
    requireAuth,
    requireRole(["school_admin"]),
    asyncRoute(async (req, res) => {
      const access = await requireSchoolAdmin(req, res);
      if (!access.ok) return;
      const teacherId = req.params.teacherId;
      if (!isUuid(teacherId)) return res.status(400).json({ success: false, error: "Invalid teacher id" });
      const teacher = await selectOne("students", "id, school_id, role", { id: teacherId });
      if (!teacher || String(teacher.school_id) !== access.schoolId || teacher.role !== "teacher") {
        return res.status(404).json({ success: false, error: "Teacher not found" });
      }
      await updateRow("students", { id: teacherId }, { school_id: null });
      await updateRow("classes", { teacher_id: teacherId, school_id: access.schoolId }, { teacher_id: null });
      res.json({ success: true });
    }),
  );

  // —— Admin school management ——
  router.get("/admin/schools", requireAuth, requireRole(["admin"]), asyncRoute(async (_req, res) => {
    const schools = await selectMany<DbRow>("schools", "*", undefined, { column: "created_at", ascending: false });
    const out = [];
    for (const s of schools) {
      const teachers = await countRows("students", { school_id: String(s.id), role: "teacher" });
      const students = await countRows("students", { school_id: String(s.id), role: "student" });
      const principal = await selectOne("students", "id", {
        school_id: String(s.id),
        role: "school_admin",
      });
      out.push({
        ...s,
        teacher_count: teachers,
        student_count: students,
        has_principal: Boolean(principal),
        principal_code_pending: Boolean(s.activation_code),
      });
    }
    res.json(out);
  }));

  router.post("/admin/schools", requireAuth, requireRole(["admin"]), asyncRoute(async (req, res) => {
    const sessionUser = getReqUser(req)!;
    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ success: false, error: "School name is required" });
    try {
      const activation_code = await generateUniqueActivationCode();
      const teacher_join_code = await generateUniqueTeacherJoinCode();
      const row = await insertOne("schools", {
        name,
        city: String(req.body?.city || "").trim() || null,
        country: String(req.body?.country || "Pakistan").trim() || "Pakistan",
        tier: String(req.body?.tier || "explorer").trim() || "explorer",
        subscription_status: String(req.body?.subscription_status || "trial").trim() || "trial",
        subscription_expires_at: req.body?.subscription_expires_at || null,
        max_teachers: Number.isFinite(Number(req.body?.max_teachers)) ? Number(req.body.max_teachers) : 2,
        max_students: Number.isFinite(Number(req.body?.max_students)) ? Number(req.body.max_students) : 50,
        activation_code,
        teacher_join_code,
        created_by: sessionUser.id,
      });
      res.json({ success: true, school: row, activation_code });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/schools|teacher_invites|relation.*does not exist|schema cache/i.test(msg)) {
        return res.status(503).json({
          success: false,
          error:
            "School tables are missing. In Supabase SQL Editor, run migrations 029_schools.sql (and 001–031 if needed), then try again.",
        });
      }
      throw err;
    }
  }));

  router.patch("/admin/schools/:id", requireAuth, requireRole(["admin"]), asyncRoute(async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, error: "Invalid school id" });
    const patch: DbRow = {};
    if (req.body?.name !== undefined) patch.name = String(req.body.name).trim();
    if (req.body?.city !== undefined) patch.city = String(req.body.city || "").trim() || null;
    if (req.body?.tier !== undefined) patch.tier = String(req.body.tier).trim();
    if (req.body?.subscription_status !== undefined) patch.subscription_status = String(req.body.subscription_status).trim();
    if (req.body?.subscription_expires_at !== undefined) patch.subscription_expires_at = req.body.subscription_expires_at;
    if (req.body?.max_teachers !== undefined) patch.max_teachers = Number(req.body.max_teachers);
    if (req.body?.max_students !== undefined) patch.max_students = Number(req.body.max_students);
    await updateRow("schools", { id }, patch);
    const school = await selectOne("schools", "*", { id });
    res.json({ success: true, school });
  }));

  router.post("/admin/schools/:id/regenerate-code", requireAuth, requireRole(["admin"]), asyncRoute(async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, error: "Invalid school id" });
    const school = await selectOne<DbRow>("schools", "id, name", { id });
    if (!school) return res.status(404).json({ success: false, error: "School not found" });
    const activation_code = await generateUniqueActivationCode();
    await updateRow("schools", { id }, { activation_code });
    res.json({
      success: true,
      activation_code,
      message: "New principal code generated. Old codes no longer work. Share this code once with your principal.",
    });
  }));

  router.post("/admin/schools/:id/suspend", requireAuth, requireRole(["admin"]), asyncRoute(async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, error: "Invalid school id" });
    await updateRow("schools", { id }, { subscription_status: "suspended" });
    res.json({ success: true });
  }));

  router.post("/admin/schools/:id/unsuspend", requireAuth, requireRole(["admin"]), asyncRoute(async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, error: "Invalid school id" });
    const status = String(req.body?.subscription_status || "trial").trim() || "trial";
    await updateRow("schools", { id }, { subscription_status: status });
    res.json({ success: true });
  }));

  router.delete("/admin/schools/:id", requireAuth, requireRole(["admin"]), asyncRoute(async (req, res) => {
    const id = req.params.id;
    if (!isUuid(id)) return res.status(400).json({ success: false, error: "Invalid school id" });
    const school = await selectOne("schools", "id", { id });
    if (!school) return res.status(404).json({ success: false, error: "School not found" });
    await updateRow("students", { school_id: id }, { school_id: null });
    await updateRow("classes", { school_id: id }, { school_id: null });
    await deleteRows("schools", { id });
    res.json({ success: true });
  }));

  return router;
}

function optionalUuid(value: unknown): string | null {
  if (value == null || value === "") return null;
  const s = String(value).trim();
  return isUuid(s) ? s : null;
}
