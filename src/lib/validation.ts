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
  entries: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        type: z.enum(["vacation", "unpaid_leave", "not_working"])
      })
    )
    .min(1)
});
