import "server-only";

import { randomUUID } from "node:crypto";

import { format } from "date-fns";
import { sql } from "kysely";

import { getAppBaseUrl } from "@/lib/app-config";
import { formatUsd } from "@/lib/currency";
import { kysely } from "@/lib/db/kysely";
import { sendEmail } from "@/lib/email";

const EXPENSE_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXPENSE_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const ALLOWED_EXPENSE_EXTENSIONS = [".pdf", ".png", ".jpg", ".jpeg"];

export { EXPENSE_MAX_BYTES };

export type ExpenseRecord = {
  id: string;
  organizationId: string;
  organizationUserId: string;
  expenseMonth: string;
  expenseDate: string;
  reference: string;
  totalAmount: number;
  currency: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedByUserId: string;
  paidAt: Date | null;
  paidByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminExpenseRecord = ExpenseRecord & {
  userName: string | null;
  userEmail: string;
  role: string;
};

export type AdminExpenseArchiveRecord = ExpenseRecord & {
  userName: string | null;
  userEmail: string;
  fileData: Uint8Array | ArrayBuffer;
};

function toMonthDate(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber - 1, 1, 12, 0, 0, 0);
}

function toDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toMonthKey(value: string | Date) {
  if (typeof value === "string") {
    return /^\d{4}-\d{2}$/.test(value) ? value : value.slice(0, 7);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function toDateKey(value: string | Date) {
  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function mapExpenseRow(row: any): ExpenseRecord {
  return {
    ...row,
    expenseMonth: toMonthKey(row.expenseMonth),
    expenseDate: toDateKey(row.expenseDate),
    totalAmount: Number(row.totalAmount)
  };
}

export async function ensureExpenseTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS "Expense" (
      "id" text PRIMARY KEY,
      "organizationId" text NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
      "organizationUserId" text NOT NULL REFERENCES "OrganizationUser"("id") ON DELETE CASCADE,
      "expenseMonth" date NOT NULL,
      "expenseDate" date NOT NULL,
      "reference" text NOT NULL,
      "totalAmount" double precision NOT NULL,
      "currency" text NOT NULL DEFAULT 'USD',
      "fileName" text NOT NULL,
      "mimeType" text NOT NULL,
      "fileSizeBytes" integer NOT NULL,
      "fileData" bytea NOT NULL,
      "uploadedByUserId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "paidAt" timestamptz,
      "paidByUserId" text REFERENCES "User"("id") ON DELETE SET NULL,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `.execute(kysely);

  await sql`ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidAt" timestamptz`.execute(kysely);
  await sql`ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "paidByUserId" text REFERENCES "User"("id") ON DELETE SET NULL`.execute(kysely);

  await sql`
    CREATE INDEX IF NOT EXISTS "Expense_org_month_idx"
    ON "Expense" ("organizationId", "expenseMonth")
  `.execute(kysely);

  await sql`
    CREATE INDEX IF NOT EXISTS "Expense_orgUser_month_idx"
    ON "Expense" ("organizationUserId", "expenseMonth")
  `.execute(kysely);
}

export function normalizeExpenseMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Malformed expense month.");
  }
  return month;
}

export function normalizeExpenseDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Malformed expense date.");
  }
  return date;
}

export function validateExpenseDateInMonth({ month, expenseDate }: { month: string; expenseDate: string }) {
  if (!expenseDate.startsWith(`${month}-`)) {
    throw new Error("Expense date must fall inside the selected month.");
  }
}

export function parseExpenseAmount(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Expense amount must be greater than zero.");
  }

  return Math.round(amount * 100) / 100;
}

export function validateExpenseReference(reference: string) {
  const normalized = reference.trim();
  if (normalized.length < 2 || normalized.length > 180) {
    throw new Error("Expense reference must be between 2 and 180 characters.");
  }
  return normalized;
}

export function validateExpenseUpload(file: File | null) {
  if (!file) {
    throw new Error("Attach a receipt file.");
  }

  const lowerName = file.name.toLowerCase();
  const allowedByExtension = ALLOWED_EXPENSE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
  const allowedByMime = file.type ? ALLOWED_EXPENSE_MIME_TYPES.has(file.type) : false;
  if (!allowedByExtension && !allowedByMime) {
    throw new Error("Only PDF, PNG, JPG, and JPEG receipts are allowed.");
  }

  if (file.size <= 0) {
    throw new Error("Receipt file is empty.");
  }

  if (file.size > EXPENSE_MAX_BYTES) {
    throw new Error("Receipt file exceeds the 10 MB limit.");
  }
}

export async function insertMembershipExpense({
  organizationId,
  organizationUserId,
  uploadedByUserId,
  month,
  expenseDate,
  reference,
  totalAmount,
  fileName,
  mimeType,
  fileSizeBytes,
  fileData
}: {
  organizationId: string;
  organizationUserId: string;
  uploadedByUserId: string;
  month: string;
  expenseDate: string;
  reference: string;
  totalAmount: number;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileData: Uint8Array;
}) {
  await ensureExpenseTable();

  const row = await kysely
    .insertInto("Expense")
    .values({
      id: randomUUID().replace(/-/g, ""),
      organizationId,
      organizationUserId,
      expenseMonth: toMonthDate(month),
      expenseDate: toDateOnly(expenseDate),
      reference,
      totalAmount,
      currency: "USD",
      fileName,
      mimeType,
      fileSizeBytes,
      fileData,
      uploadedByUserId,
      paidAt: null,
      paidByUserId: null,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .returningAll()
    .executeTakeFirstOrThrow();

  return mapExpenseRow(row);
}

export async function getMembershipExpensesForMonth({ organizationUserId, month }: { organizationUserId: string; month: string }) {
  await ensureExpenseTable();

  const rows = await kysely
    .selectFrom("Expense")
    .selectAll()
    .where("organizationUserId", "=", organizationUserId)
    .where("expenseMonth", "=", toMonthDate(month))
    .orderBy("expenseDate", "desc")
    .orderBy("updatedAt", "desc")
    .execute();

  return rows.map(mapExpenseRow);
}

export async function getMembershipExpenseBinary({ id, organizationUserId }: { id: string; organizationUserId: string }) {
  await ensureExpenseTable();

  return (
    (await kysely
      .selectFrom("Expense")
      .selectAll()
      .where("id", "=", id)
      .where("organizationUserId", "=", organizationUserId)
      .executeTakeFirst()) ?? null
  );
}

export async function deleteMembershipExpense({ id, organizationUserId }: { id: string; organizationUserId: string }) {
  await ensureExpenseTable();

  return (
    (await kysely
      .deleteFrom("Expense")
      .where("id", "=", id)
      .where("organizationUserId", "=", organizationUserId)
      .returningAll()
      .executeTakeFirst()) ?? null
  );
}

export async function getAdminExpensesForMonth({ organizationId, month }: { organizationId: string; month: string }) {
  await ensureExpenseTable();

  const rows = await kysely
    .selectFrom("Expense as e")
    .innerJoin("OrganizationUser as ou", "ou.id", "e.organizationUserId")
    .innerJoin("User as u", "u.id", "ou.userId")
    .select([
      "e.id as id",
      "e.organizationId as organizationId",
      "e.organizationUserId as organizationUserId",
      "e.expenseMonth as expenseMonth",
      "e.expenseDate as expenseDate",
      "e.reference as reference",
      "e.totalAmount as totalAmount",
      "e.currency as currency",
      "e.fileName as fileName",
      "e.mimeType as mimeType",
      "e.fileSizeBytes as fileSizeBytes",
      "e.uploadedByUserId as uploadedByUserId",
      "e.createdAt as createdAt",
      "e.updatedAt as updatedAt",
      "u.name as userName",
      "u.email as userEmail",
      "ou.role as role"
    ])
    .where("e.organizationId", "=", organizationId)
    .where("e.expenseMonth", "=", toMonthDate(month))
    .orderBy("u.name", "asc")
    .orderBy("u.email", "asc")
    .orderBy("e.expenseDate", "desc")
    .execute();

  return rows.map((row) => ({
    ...mapExpenseRow(row),
    userName: row.userName,
    userEmail: row.userEmail,
    role: row.role
  })) as AdminExpenseRecord[];
}

export async function getAdminExpenseBinary({ id, organizationId }: { id: string; organizationId: string }) {
  await ensureExpenseTable();

  return (
    (await kysely
      .selectFrom("Expense")
      .selectAll()
      .where("id", "=", id)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst()) ?? null
  );
}

export async function getAdminExpensesForMembershipMonth({
  organizationId,
  organizationUserId,
  month
}: {
  organizationId: string;
  organizationUserId: string;
  month: string;
}) {
  await ensureExpenseTable();

  const rows = await kysely
    .selectFrom("Expense as e")
    .innerJoin("OrganizationUser as ou", "ou.id", "e.organizationUserId")
    .innerJoin("User as u", "u.id", "ou.userId")
    .select([
      "e.id as id",
      "e.organizationId as organizationId",
      "e.organizationUserId as organizationUserId",
      "e.expenseMonth as expenseMonth",
      "e.expenseDate as expenseDate",
      "e.reference as reference",
      "e.totalAmount as totalAmount",
      "e.currency as currency",
      "e.fileName as fileName",
      "e.mimeType as mimeType",
      "e.fileSizeBytes as fileSizeBytes",
      "e.fileData as fileData",
      "e.uploadedByUserId as uploadedByUserId",
      "e.paidAt as paidAt",
      "e.paidByUserId as paidByUserId",
      "e.createdAt as createdAt",
      "e.updatedAt as updatedAt",
      "u.name as userName",
      "u.email as userEmail"
    ])
    .where("e.organizationId", "=", organizationId)
    .where("e.organizationUserId", "=", organizationUserId)
    .where("e.expenseMonth", "=", toMonthDate(month))
    .orderBy("e.expenseDate", "asc")
    .orderBy("e.updatedAt", "asc")
    .execute();

  return rows.map((row) => ({
    ...mapExpenseRow(row),
    userName: row.userName,
    userEmail: row.userEmail,
    fileData: row.fileData
  })) as AdminExpenseArchiveRecord[];
}

export async function markMembershipExpensesPaid({
  organizationId,
  organizationUserId,
  month,
  paidByUserId
}: {
  organizationId: string;
  organizationUserId: string;
  month: string;
  paidByUserId: string;
}) {
  await ensureExpenseTable();

  const paidAt = new Date();
  return await kysely
    .updateTable("Expense")
    .set({
      paidAt,
      paidByUserId,
      updatedAt: new Date()
    })
    .where("organizationId", "=", organizationId)
    .where("organizationUserId", "=", organizationUserId)
    .where("expenseMonth", "=", toMonthDate(month))
    .where("paidAt", "is", null)
    .returningAll()
    .execute();
}

type ExpensePaidRecipient = {
  name: string | null;
  email: string;
};

export async function getExpensePaidRecipient({
  organizationId,
  organizationUserId
}: {
  organizationId: string;
  organizationUserId: string;
}) {
  await ensureExpenseTable();

  const recipient = await kysely
    .selectFrom("OrganizationUser as ou")
    .innerJoin("User as u", "u.id", "ou.userId")
    .select(["u.name as name", "u.email as email"])
    .where("ou.organizationId", "=", organizationId)
    .where("ou.id", "=", organizationUserId)
    .executeTakeFirst();

  return (recipient ?? null) as ExpensePaidRecipient | null;
}

export async function sendExpensePaidNotification({
  organizationId,
  organizationUserId,
  month,
  paidAt,
  expenses
}: {
  organizationId: string;
  organizationUserId: string;
  month: string;
  paidAt: Date;
  expenses: Array<{ reference: string; totalAmount: number; expenseDate: string }>;
}) {
  if (!expenses.length) {
    return { sent: false, reason: "no_expenses" as const };
  }

  const recipient = await getExpensePaidRecipient({ organizationId, organizationUserId });
  if (!recipient?.email) {
    console.info("expense_paid_email_skipped_no_recipient", {
      organizationId,
      organizationUserId,
      month
    });
    return { sent: false, reason: "no_recipient" as const };
  }

  const appUrl = getAppBaseUrl();
  const userLabel = recipient.name?.trim() || recipient.email;
  const monthLabel = format(new Date(`${month}-01T12:00:00`), "MMMM yyyy");
  const paidAtLabel = format(paidAt, "MMM d, yyyy 'at' p");
  const totalAmount = expenses.reduce((sum, expense) => sum + expense.totalAmount, 0);
  const subject = `Your ${monthLabel} expenses have been marked as paid`;
  const expenseLines = expenses
    .map(
      (expense) => `
        <tr>
          <td style="padding:8px 0;border-top:1px solid #e5e7eb;color:#111827">${expense.expenseDate}</td>
          <td style="padding:8px 12px;border-top:1px solid #e5e7eb;color:#111827">${expense.reference}</td>
          <td style="padding:8px 0;border-top:1px solid #e5e7eb;color:#111827;text-align:right">${formatUsd(expense.totalAmount)}</td>
        </tr>
      `
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:640px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 16px;font-size:22px;color:#111827">Expenses marked as paid</h2>
      <p style="margin:0 0 16px">Your submitted expenses for <strong>${monthLabel}</strong> have been marked as paid.</p>
      <div style="border:1px solid #d1d5db;border-radius:12px;padding:16px;background:#f9fafb;margin:0 0 20px">
        <p style="margin:0 0 8px"><strong>User:</strong> ${userLabel}</p>
        <p style="margin:0 0 8px"><strong>Month:</strong> ${monthLabel}</p>
        <p style="margin:0 0 8px"><strong>Paid on:</strong> ${paidAtLabel}</p>
        <p style="margin:0"><strong>Total paid:</strong> ${formatUsd(totalAmount)}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;margin:0 0 20px">
        <thead>
          <tr>
            <th style="padding:0 0 8px;text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase">Date</th>
            <th style="padding:0 12px 8px;text-align:left;color:#6b7280;font-size:12px;text-transform:uppercase">Reference</th>
            <th style="padding:0 0 8px;text-align:right;color:#6b7280;font-size:12px;text-transform:uppercase">Amount</th>
          </tr>
        </thead>
        <tbody>${expenseLines}</tbody>
      </table>
      <p style="margin:0 0 20px">You can review the paid lines in the app:</p>
      <p style="margin:0 0 24px">
        <a href="${appUrl}/expenses" target="_blank" rel="noreferrer" style="display:inline-block;background:#375a21;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">
          Open expenses
        </a>
      </p>
      <p style="margin:0;color:#6b7280;font-size:14px">Sent automatically by Hutech HR Hub.</p>
    </div>
  `;

  await sendEmail({
    to: recipient.email,
    subject,
    html
  });

  return { sent: true, reason: null as null };
}
