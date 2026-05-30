import fs from "fs";

let s = fs.readFileSync("server.ts", "utf8");

// Import serverQueries if missing
if (!s.includes('from "./lib/serverQueries"')) {
  s = s.replace(
    '} from "./lib/db";',
    `} from "./lib/db";
import * as SQ from "./lib/serverQueries";`,
  );
}

// Async helpers already in SQ - wire AI to SQ
s = s.replace(
  /const getAiUsageCountToday = async[\s\S]*?const checkAndLogAiQuota = async[\s\S]*?return \{ ok: true, message: "" \} as const;\s*\};/,
  `const getAiUsageCountToday = SQ.countAiUsageToday;
  const logAiUsage = SQ.insertAiUsage;
  const checkAndLogAiQuota = async (endpoint: "generate_quiz" | "recommendations", userId: string) => {
    const globalCount = await getAiUsageCountToday();
    if (globalCount >= AI_DAILY_GLOBAL_LIMIT) {
      await logAiUsage(endpoint, userId, 0, "global_limit");
      return { ok: false, message: "AI daily platform limit reached. Please try again tomorrow." } as const;
    }
    const perUserLimit = endpoint === "generate_quiz" ? AI_DAILY_QUIZ_LIMIT_PER_USER : AI_DAILY_RECOMMEND_LIMIT_PER_USER;
    const userCount = await getAiUsageCountToday(endpoint, userId);
    if (userCount >= perUserLimit) {
      await logAiUsage(endpoint, userId, 0, "user_limit");
      return { ok: false, message: \`Daily AI limit reached for this feature (\${perUserLimit}/day). Please try again tomorrow.\` } as const;
    }
    await logAiUsage(endpoint, userId, 1, "accepted");
    return { ok: true, message: "" } as const;
  };`,
);

// ensureClassAccess calls: Number -> string, await
s = s.replace(
  /if \(!ensureClassAccess\(req, res, (\w+)\)\.ok\) return;/g,
  "if (!(await ensureClassAccess(req, res, $1)).ok) return;",
);
s = s.replace(
  /if \(!ensureClassAccess\(req, res, classIdNum\)\.ok\) return;/g,
  "if (!(await ensureClassAccess(req, res, classId)).ok) return;",
);

// class id validation patterns
s = s.replace(
  /const classIdNum = Number\(classId\);\s*if \(!Number\.isInteger\(classIdNum\) \|\| classIdNum < 1\) return res\.status\(400\)\.json\(\{ success: false, error: "Invalid class id" \}\);\s*if \(!\(await ensureClassAccess\(req, res, classId\)\)\.ok\) return;/g,
  `if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;`,
);

s = s.replace(
  /const classId = Number\(req\.params\.id\);\s*if \(!Number\.isInteger\(classId\) \|\| classId < 1\) return res\.status\(400\)\.json\(\{ success: false, error: "Invalid class id" \}\);\s*if \(!\(await ensureClassAccess\(req, res, classId\)\)\.ok\) return;/g,
  `const classId = req.params.id;
    if (!isUuid(classId)) return res.status(400).json({ success: false, error: "Invalid class id" });
    if (!(await ensureClassAccess(req, res, classId)).ok) return;`,
);

fs.writeFileSync("server.ts", s);
console.log("patched");
