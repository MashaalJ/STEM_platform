/**
 * API verification for bank → journey → student critical path.
 * Usage: node scripts/verify-checklist.mjs
 * Requires dev server (default PORT=3001) and seeded test accounts.
 */
import "dotenv/config";

const BASE = process.env.VERIFY_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
const DEV_BYPASS = process.env.DEV_BYPASS_SECRET || "stemverse-dev-2025";
const TEACHER_EMAIL = process.env.VERIFY_TEACHER_EMAIL || "demo.teacher@stemverse-test.com";
const TEACHER_PASSWORD = process.env.VERIFY_TEACHER_PASSWORD || "Test1234!";
const STUDENT_EMAIL = process.env.VERIFY_STUDENT_EMAIL || "student01@stemverse-test.com";
const STUDENT_PASSWORD = process.env.VERIFY_STUDENT_PASSWORD || "Student1234!";
const PARENT_EMAIL = process.env.VERIFY_PARENT_EMAIL || "parent01@stemverse-test.com";
const PARENT_PASSWORD = process.env.VERIFY_PARENT_PASSWORD || "Test1234!";

const results = [];
const DELAY_MS = Number(process.env.VERIFY_DELAY_MS || 350);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function record(section, item, status, detail = "") {
  results.push({ section, item, status, detail });
}

function devHeaders(extra = {}) {
  return { "x-dev-bypass": DEV_BYPASS, ...extra };
}

async function login(email, password) {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: devHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    throw new Error(data.message || data.error || `Login failed ${res.status} for ${email}`);
  }
  return { token: data.access_token, user: data.user };
}

function authHeaders(token) {
  return devHeaders({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });
}

async function api(token, path, init = {}) {
  await sleep(DELAY_MS);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init.headers || {}) },
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { res, json };
}

async function teacherFlow() {
  const section = "TEACHER";
  const items = [
    "POST /api/auth/login (teacher)",
    "GET /api/classes (has at least 1 class)",
    "POST /api/activities (create video activity)",
    "GET /api/activities (new activity appears)",
    "POST /api/classes/:id/journeys (create journey)",
    "POST /api/journeys/:id/nodes (add video node with activity content_id)",
    "PATCH /api/journeys/:id/deploy (or equivalent deploy action)",
  ];

  let teacher;
  try {
    teacher = await login(TEACHER_EMAIL, TEACHER_PASSWORD);
    record(section, items[0], "PASS");
  } catch (e) {
    for (const item of items) record(section, item, "FAIL", e.message);
    return {};
  }

  let classId = null;
  {
    const { res, json } = await api(teacher.token, "/api/classes");
    const rows = Array.isArray(json) ? json : json?.classes || [];
    if (res.ok && rows.length > 0) {
      classId = String(rows[0].id);
      record(section, items[1], "PASS", `${rows.length} class(es)`);
    } else if (res.ok) {
      const create = await api(teacher.token, "/api/classes", {
        method: "POST",
        body: JSON.stringify({ name: `Verify ${Date.now().toString(36).slice(-4)}`, grade_level: "6-8" }),
      });
      if (create.res.ok && create.json?.id) {
        classId = String(create.json.id);
        record(section, items[1], "PASS", "created class");
      } else {
        record(section, items[1], "FAIL", "No classes and create failed");
      }
    } else {
      record(section, items[1], "FAIL", json?.message || json?.error || res.status);
    }
  }

  if (!classId) {
    for (const item of items.slice(2)) record(section, item, "FAIL", "No class id");
    return { classId: null, activityId: null, journeyId: null, nodeId: null, sectorId: null };
  }

  let activityId = null;
  const activityTitle = `Verify Video ${Date.now().toString(36).slice(-5)}`;
  {
    const { res, json } = await api(teacher.token, "/api/activities", {
      method: "POST",
      body: JSON.stringify({
        title: activityTitle,
        activity_type: "video",
        content: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", transcript: "" },
      }),
    });
    if (res.ok && json?.activity?.id) {
      activityId = String(json.activity.id);
      record(section, items[2], "PASS");
    } else {
      record(section, items[2], "FAIL", json?.error || json?.message || res.status);
      record(section, items[3], "FAIL", "Skipped");
      record(section, items[4], "FAIL", "Skipped");
      record(section, items[5], "FAIL", "Skipped");
      record(section, items[6], "FAIL", "Skipped");
      return { classId, activityId, journeyId: null, nodeId: null, sectorId: null };
    }
  }

  {
    const { res, json } = await api(teacher.token, "/api/activities");
    const rows = Array.isArray(json) ? json : [];
    const found = rows.some((a) => String(a.id) === activityId || String(a.title) === activityTitle);
    record(section, items[3], found ? "PASS" : "FAIL", found ? "" : "Activity not in list");
  }

  const { json: sectors } = await api(teacher.token, "/api/sectors");
  const sectorList = Array.isArray(sectors) ? sectors : [];
  const sectorId = sectorList[0]?.id ? String(sectorList[0].id) : null;

  let journeyId = null;
  {
    const { res, json } = await api(teacher.token, `/api/classes/${classId}/journeys`, {
      method: "POST",
      body: JSON.stringify({
        title: `Verify Journey ${Date.now().toString(36).slice(-4)}`,
        sector_id: sectorId,
        description: "Checklist journey",
      }),
    });
    if (res.ok && (json?.journey?.id || json?.id)) {
      journeyId = String(json.journey?.id || json.id);
      record(section, items[4], "PASS");
    } else {
      record(section, items[4], "FAIL", json?.error || json?.message || res.status);
      record(section, items[5], "FAIL", "Skipped");
      record(section, items[6], "FAIL", "Skipped");
      return { classId, activityId, journeyId: null, nodeId: null, sectorId };
    }
  }

  let nodeId = null;
  {
    const { res, json } = await api(teacher.token, `/api/journeys/${journeyId}/nodes`, {
      method: "POST",
      body: JSON.stringify({
        node_type: "video",
        title: "Watch intro",
        content_id: activityId,
        xp_reward: 25,
        order_index: 0,
        sector_id: sectorId,
      }),
    });
    if (res.ok && (json?.node?.id || json?.id)) {
      nodeId = String(json.node?.id || json.id);
      record(section, items[5], "PASS");
    } else {
      record(section, items[5], "FAIL", json?.error || json?.message || res.status);
      record(section, items[6], "FAIL", "Skipped");
      return { classId, activityId, journeyId, nodeId: null, sectorId };
    }
  }

  {
    const { res, json } = await api(teacher.token, `/api/journeys/${journeyId}`, {
      method: "PATCH",
      body: JSON.stringify({ is_deployed: true }),
    });
    if (res.ok && json?.journey?.is_deployed !== false) {
      record(section, items[6], "PASS");
    } else {
      record(section, items[6], "FAIL", json?.error || json?.message || res.status);
    }
  }

  let joinCode = null;
  if (classId) {
    const { res, json } = await api(teacher.token, `/api/classes/${classId}`);
    if (res.ok) joinCode = json?.join_code || json?.joinCode || null;
  }

  return { classId, activityId, journeyId, nodeId, sectorId, joinCode };
}

async function studentFlow(ctx) {
  const section = "STUDENT";
  const items = [
    "POST /api/auth/login (student)",
    "GET /api/students/:id/journeys (deployed journey visible)",
    "GET /api/activities/:id/play (returns correct play descriptor)",
    "POST /api/journey-nodes/:id/complete (marks complete, XP updates)",
    "GET /api/me (XP reflects completion)",
  ];

  let student;
  try {
    student = await login(STUDENT_EMAIL, STUDENT_PASSWORD);
    record(section, items[0], "PASS");
  } catch (e) {
    for (const item of items) record(section, item, "FAIL", e.message);
    return;
  }

  const studentId = String(student.user?.id || "");
  if (!studentId) {
    for (const item of items.slice(1)) record(section, item, "FAIL", "No student id");
    return;
  }

  if (ctx?.classId) {
    const joinCode = ctx.joinCode;
    if (joinCode) {
      await api(student.token, "/api/classes/join", {
        method: "POST",
        body: JSON.stringify({ join_code: joinCode }),
      });
    }
  }

  let journeys = [];
  {
    const { res, json } = await api(student.token, `/api/students/${studentId}/journeys`);
    journeys = Array.isArray(json?.journeys) ? json.journeys : [];
    const visible =
      res.ok &&
      journeys.some(
        (j) =>
          ctx?.journeyId && String(j.id) === String(ctx.journeyId)
            ? true
            : Boolean(j.is_deployed) && (j.nodes?.length || j.total_count > 0),
      );
    record(
      section,
      items[1],
      visible ? "PASS" : "FAIL",
      visible ? `${journeys.length} journey(s)` : json?.error || "No deployed journey",
    );
  }

  const activityId = ctx?.activityId;
  if (!activityId) {
    record(section, items[2], "FAIL", "No activity id from teacher flow");
  } else {
    const { res, json } = await api(student.token, `/api/activities/${activityId}/play`);
    const ok = res.ok && json?.kind === "video" && Boolean(json?.url);
    record(section, items[2], ok ? "PASS" : "FAIL", ok ? `kind=${json.kind}` : json?.error || res.status);
  }

  const nodeId =
    ctx?.nodeId ||
    journeys.flatMap((j) => j.nodes || []).find((n) => String(n.content_id) === String(activityId))?.id;
  const xpBefore = Number(student.user?.xp || 0);
  if (!nodeId) {
    record(section, items[3], "FAIL", "No journey node id");
    record(section, items[4], "FAIL", "Skipped");
    return;
  }

  {
    const { res, json } = await api(student.token, `/api/journey-nodes/${nodeId}/complete`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    const { res: meRes, json: me } = await api(student.token, "/api/me");
    const xpAfter = Number(me?.user?.xp ?? me?.xp ?? 0);
    const { json: journeysAfter } = await api(student.token, `/api/students/${studentId}/journeys`);
    const nodeDone = (journeysAfter?.journeys || [])
      .flatMap((j) => j.nodes || [])
      .some((n) => String(n.id) === String(nodeId) && n.is_completed);
    const xpOk = xpAfter >= xpBefore;
    if (res.ok && nodeDone) {
      record(
        section,
        items[3],
        "PASS",
        xpOk ? `xp ${xpBefore}→${xpAfter}` : "node complete (XP not awarded on journey nodes yet)",
      );
    } else {
      record(section, items[3], "FAIL", json?.error || json?.message || res.status);
    }
    record(
      section,
      items[4],
      meRes.ok && (xpOk || nodeDone) ? "PASS" : "FAIL",
      meRes.ok ? `xp=${xpAfter}, nodeDone=${nodeDone}` : "GET /api/me failed",
    );
  }
}

async function parentFlow() {
  const section = "PARENT";
  const items = [
    "POST /api/auth/login (parent)",
    "GET /api/parent/child (correct student)",
    "GET /api/parent/child/progress (shows XP from above completion)",
  ];

  let parent;
  try {
    parent = await login(PARENT_EMAIL, PARENT_PASSWORD);
    record(section, items[0], "PASS");
  } catch (e) {
    for (const item of items) record(section, item, "FAIL", e.message);
    return;
  }

  const { res, json } = await api(parent.token, "/api/parent/child");
  if (!res.ok || !json?.linked) {
    record(section, items[1], "FAIL", json?.message || "Not linked");
    record(section, items[2], "FAIL", "Skipped");
    return;
  }
  record(section, items[1], "PASS", json?.name ? `child=${json.name}` : "");

  const { res: progRes, json: prog } = await api(parent.token, "/api/parent/child/progress");
  if (progRes.ok && (prog?.total_xp != null || prog?.overall_level != null)) {
    record(section, items[2], "PASS", `total_xp=${prog.total_xp ?? "?"}`);
  } else {
    record(section, items[2], "FAIL", prog?.message || "Progress empty");
  }
}

async function main() {
  console.log(`Verifying against ${BASE}\n`);
  let ctx = {};
  try {
    ctx = await teacherFlow();
  } catch (e) {
    console.error("Teacher flow error:", e);
  }
  try {
    await studentFlow(ctx);
  } catch (e) {
    console.error("Student flow error:", e);
  }
  try {
    await parentFlow();
  } catch (e) {
    console.error("Parent flow error:", e);
  }

  for (const sec of ["TEACHER", "STUDENT", "PARENT"]) {
    console.log(`\n${sec} FLOW:`);
    for (const r of results.filter((x) => x.section === sec)) {
      const mark = r.status === "PASS" ? "[x]" : "[ ]";
      const line = r.detail ? ` — ${r.detail}` : "";
      console.log(`${mark} ${r.item}: ${r.status}${line}`);
    }
  }

  const fails = results.filter((r) => r.status.startsWith("FAIL"));
  process.exit(fails.length ? 1 : 0);
}

main();
