import type { Request, Response, NextFunction } from "express";
import { z } from "zod";

const uuid = z.string().uuid({ message: "Invalid UUID" });

export const loginSchema = z
  .object({
    email: z.string().email().optional(),
    username: z.string().min(1).max(64).optional(),
    name: z.string().min(1).max(128).optional(),
    password: z.string().min(6).max(256),
  })
  .refine((d) => Boolean(d.email || d.username || d.name), {
    message: "Email or username is required",
  });

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(256),
  name: z.string().min(1).max(128),
  role: z.enum(["student", "teacher", "parent", "school_admin"]),
});

export const completeSignupSchema = z.object({
  name: z.string().min(1).max(128),
  role: z.enum(["student", "teacher", "parent", "school_admin"]),
  age: z.number().int().min(0).max(120).nullable().optional(),
  grade: z.string().max(32).nullable().optional(),
  school: z.string().max(256).nullable().optional(),
  city: z.string().max(128).nullable().optional(),
  email: z.string().email().nullable().optional(),
  parent_email: z.string().email().nullable().optional(),
  contact_number: z.string().max(32).nullable().optional(),
  gender: z.string().max(32).nullable().optional(),
  country_code: z.string().max(8).nullable().optional(),
  region: z.string().max(128).nullable().optional(),
  timezone: z.string().max(64).nullable().optional(),
});

export const linkChildSchema = z.object({
  student_email: z.string().email(),
});

export const joinClassSchema = z.object({
  join_code: z.string().min(4).max(16),
});

export const createClassSchema = z.object({
  name: z.string().min(1).max(128),
  teacher_id: uuid.optional(),
  description: z.string().max(2000).optional(),
  curriculum_track: z.string().max(128).nullable().optional(),
});

export const patchClassCurriculumTrackSchema = z.object({
  curriculum_track: z.string().min(1).max(128),
});

export const patchClassCurriculumSchema = z.object({
  mission_id: uuid,
  is_enabled: z.boolean().optional(),
  custom_order: z.number().int().nullable().optional(),
  custom_title: z.string().max(256).nullable().optional(),
  custom_description: z.string().max(4000).nullable().optional(),
  unlock_after_mission_id: uuid.nullable().optional(),
});

export const classStudentSchema = z.object({
  student_id: uuid,
});

export const classMissionSchema = z.object({
  mission_id: uuid,
});

export const classQuizSchema = z.object({
  quiz_id: uuid,
});

export const classChallengeSchema = z.object({
  challenge_id: z.coerce.number().int().positive(),
});

export const bulkStudentsSchema = z.object({
  student_ids: z.array(uuid).min(1).max(500),
});

export const addStudentsByNamesSchema = z.object({
  names: z.array(z.string().min(1).max(128)).min(1).max(200),
  class_id: uuid.optional(),
});

export const createSectorSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(4000).optional(),
  theme_color: z.string().max(32).nullable().optional(),
  icon: z.string().max(16).nullable().optional(),
  level_lock: z.number().int().min(1).optional(),
  required_level: z.number().int().min(1).optional(),
  unlock_sector_id: uuid.nullable().optional(),
  unlock_mastery_percent: z.number().min(50).max(100).optional(),
  domain_ids: z.array(uuid).optional(),
  xp_reward: z.number().int().min(0).optional(),
  mastery_percent: z.number().min(0).max(100).optional(),
  status: z.enum(["active", "locked", "maintenance"]).optional(),
  image_url: z.string().max(2048).optional(),
});

export const patchSectorSchema = createSectorSchema.partial();

export const createDomainSchema = z.object({
  name: z.string().min(1).max(128),
  description: z.string().max(2000).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
  icon: z.string().max(16).nullable().optional(),
});

export const patchDomainSchema = createDomainSchema.partial();

const optionalUuidField = z.preprocess(
  (val) => {
    if (val == null || val === "" || val === 1 || val === "1" || val === 0) return undefined;
    if (typeof val === "number") return undefined;
    const s = String(val).trim();
    return s || undefined;
  },
  z.string().uuid().optional(),
);

export const createMissionSchema = z.object({
  title: z.string().min(1).max(256),
  description: z.string().max(8000).optional(),
  sector_id: optionalUuidField,
  difficulty: z.string().max(32).optional(),
  xp_reward: z.coerce.number().int().min(0).optional(),
  grade_level: z.string().max(32).nullable().optional(),
  status: z.enum(["available", "locked", "active", "draft"]).optional(),
  embed_code: z.string().max(500_000).nullable().optional(),
  embed_type: z.string().max(64).optional(),
  custom_embed_url: z.string().max(2048).optional(),
  embed_url: z.string().max(2048).optional(),
  embed_config: z.record(z.string(), z.any()).optional(),
  learning_outcomes: z.union([z.array(z.string()), z.string()]).optional(),
  domains: z.array(z.string().max(64)).optional(),
  prerequisite_mission_id: z.preprocess(
    (val) => {
      if (val == null || val === "" || val === 0 || val === "0") return null;
      if (typeof val === "number") return null;
      const s = String(val).trim();
      return s || null;
    },
    z.string().uuid().nullable().optional(),
  ),
});

export const patchMissionSchema = createMissionSchema.partial();

export const createSectorMissionSchema = createMissionSchema.omit({ sector_id: true });

export const studentInterestsSchema = z.object({
  interests: z.array(z.string().min(1).max(64)).min(1).max(20),
});

export const stembotChatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .max(20)
    .optional(),
});

export const studentQuizSubmitSchema = z.object({
  student_id: uuid,
  quiz_id: uuid,
  score: z.number().min(0).optional(),
  total_questions: z.number().int().min(0).optional(),
  auto_score: z.number().min(0).optional(),
  review_items: z
    .array(
      z.object({
        question_index: z.number().int().min(0).optional(),
        question_type: z.string().max(64).optional(),
        prompt: z.string().max(4000).optional(),
        response_text: z.string().max(8000).optional(),
        max_score: z.number().min(0).optional(),
      }),
    )
    .optional(),
});

export const quizReviewGradeSchema = z.object({
  awarded_score: z.number().min(0),
});

export const patchMeSchema = z
  .object({
    name: z.string().min(1).max(128).optional(),
    avatar_url: z.string().max(2048).optional(),
    age: z.number().int().min(0).max(120).nullable().optional(),
    grade: z.string().max(32).nullable().optional(),
    school: z.string().max(256).nullable().optional(),
    city: z.string().max(128).nullable().optional(),
    email: z.string().email().nullable().optional(),
    parent_email: z.string().email().nullable().optional(),
    contact_number: z.string().max(32).nullable().optional(),
    gender: z.string().max(32).nullable().optional(),
    country_code: z.string().max(8).nullable().optional(),
    region: z.string().max(128).nullable().optional(),
    timezone: z.string().max(64).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No valid fields to update" });

export const changePasswordSchema = z.object({
  current_password: z.string().min(6).max(256),
  new_password: z.string().min(6).max(256),
});

export const createChallengeSchema = z.object({
  title: z.string().min(1).max(256),
  type: z.string().min(1).max(64),
  world: z.string().max(128).nullable().optional(),
  zone: z.string().max(128).nullable().optional(),
  grade_level: z.string().max(32).nullable().optional(),
  xp_reward: z.number().int().min(0).optional(),
  xp_bonus_first_try: z.number().int().min(0).optional(),
  xp_retry_penalty: z.number().int().min(0).optional(),
  content_json: z.union([z.string(), z.record(z.string(), z.any()), z.array(z.any())]),
});

export const patchChallengeSchema = createChallengeSchema.partial();

export const challengeAttemptSchema = z.object({
  score: z.number().min(0).optional(),
  passed: z.boolean().optional(),
  response_json: z.union([z.string(), z.record(z.string(), z.any())]).optional(),
});

export const projectSaveSchema = z.object({
  id: uuid.optional(),
  mission_id: uuid.nullable().optional(),
  title: z.string().max(256).optional(),
  workspace_json: z.string().min(1).max(500_000),
  generated_code: z.string().max(500_000).optional(),
});

export const toolActivitySaveSchema = z.object({
  id: uuid.optional(),
  mission_id: uuid.nullable().optional(),
  title: z.string().max(256).optional(),
  workspace_json: z.string().min(1).max(500_000),
});

export const insertLogSchema = z.object({
  message: z.string().min(1).max(2000),
  type: z.string().max(64).optional(),
  xp_change: z.number().int().optional(),
});

export const activityLogSchema = z.object({
  event_type: z.string().min(1).max(128),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const resolveEmailSchema = z.object({
  identifier: z.string().min(1).max(256),
});

export const patchAdminStudentSchema = z
  .object({
    subscription_status: z.enum(["none", "free", "trial", "active", "past_due", "canceled"]).optional(),
    subscription_plan: z.string().max(64).optional(),
    billing_provider: z.enum(["none", "manual", "stripe"]).optional(),
    mrr_cents: z.number().int().min(0).optional(),
    ltv_cents: z.number().int().min(0).optional(),
    gender: z.string().max(32).nullable().optional(),
    country_code: z.string().max(8).nullable().optional(),
    region: z.string().max(128).nullable().optional(),
    timezone: z.string().max(64).nullable().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No valid fields" });

export const missionCompleteSchema = z.object({
  xp_earned: z.number().int().min(0).optional(),
});

export const emptyBodySchema = z.object({}).strict();

export function validationErrorMessage(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
}

export function validateBody<T extends z.ZodType>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        message: validationErrorMessage(result.error),
      });
    }
    req.body = result.data;
    next();
  };
}
