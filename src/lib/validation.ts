import { z } from "zod";

export const invitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["employee", "admin"]).default("employee"),
  weeklyTargetMinute: z.number().int().min(60).max(10080).optional()
});

export const editSessionSchema = z.object({
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  reason: z.string().min(3).max(300)
});

export const weekQuerySchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const exportQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});
