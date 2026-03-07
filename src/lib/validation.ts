import { z } from "zod";

export const editSessionSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  reason: z.string().min(3).max(300)
});

export const createSessionSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date()
});

export const weekQuerySchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const monthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/)
});

export const invoiceMonthQuerySchema = monthQuerySchema;
export const quarterQuerySchema = z.object({
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/)
});

export const saveGoalsSchema = z.object({
  quarter: z.string().regex(/^\d{4}-Q[1-4]$/),
  membership_id: z.string().min(1),
  goals: z.array(z.object({
    title: z.string().trim().min(3).max(120),
    metric: z.string().trim().min(3).max(140),
    targetValue: z.coerce.number().finite().min(0),
    currentValue: z.coerce.number().finite().min(0),
    unit: z.string().trim().min(1).max(24)
  })).superRefine((goals, ctx) => {
    if (goals.length !== 0 && (goals.length < 3 || goals.length > 5)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Provide between 3 and 5 goals per quarter." });
    }
  })
});

export const saveGoalEvaluationSchema = z.object({
  status: z.enum(["in_progress", "completed"]),
  achievementStatus: z.enum(["achieved", "not_achieved"]).nullable(),
  actualValue: z.coerce.number().finite().min(0).nullable(),
  evaluationNote: z.string().trim().min(3).max(300).nullable().optional()
}).superRefine((value, ctx) => {
  if (value.status === "completed" && value.actualValue === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["actualValue"], message: "Actual value is required when completing a goal." });
  }
  if (value.status === "completed" && value.achievementStatus === null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["achievementStatus"], message: "Choose Achieved or Not achieved when completing a goal." });
  }
});

export const rangeQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const exportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  membership_id: z.string().min(1).optional()
});

export const timeOffQuerySchema = rangeQuerySchema;

export const createTimeOffSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  entries: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    type: z.enum(["vacation", "unpaid_leave", "not_working"])
  })).default([])
}).superRefine((value, ctx) => {
  if (value.entries.length === 0 && (!value.from || !value.to)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["entries"], message: "Provide from/to when saving an empty time off selection." });
  }
});
