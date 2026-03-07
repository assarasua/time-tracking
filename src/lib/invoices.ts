import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "kysely";

import { kysely } from "@/lib/db/kysely";

const INVOICE_MAX_BYTES = 10 * 1024 * 1024;
export { INVOICE_MAX_BYTES };

export type InvoiceRecord = {
  id: string;
  organizationId: string;
  organizationUserId: string;
  invoiceMonth: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type AdminInvoiceRecord = InvoiceRecord & {
  userName: string | null;
  userEmail: string;
  role: string;
};

function toMonthDate(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function toMonthKey(value: string | Date) {
  if (typeof value === "string") {
    return /^\d{4}-\d{2}$/.test(value) ? value : value.slice(0, 7);
  }

  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function mapInvoiceRow(row: any): InvoiceRecord {
  return {
    ...row,
    invoiceMonth: toMonthKey(row.invoiceMonth)
  };
}

export async function ensureInvoiceTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS "Invoice" (
      "id" text PRIMARY KEY,
      "organizationId" text NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
      "organizationUserId" text NOT NULL REFERENCES "OrganizationUser"("id") ON DELETE CASCADE,
      "invoiceMonth" date NOT NULL,
      "fileName" text NOT NULL,
      "mimeType" text NOT NULL,
      "fileSizeBytes" integer NOT NULL,
      "fileData" bytea NOT NULL,
      "uploadedByUserId" text NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "createdAt" timestamptz NOT NULL DEFAULT now(),
      "updatedAt" timestamptz NOT NULL DEFAULT now()
    )
  `.execute(kysely);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_orgUser_month_key"
    ON "Invoice" ("organizationUserId", "invoiceMonth")
  `.execute(kysely);

  await sql`
    CREATE INDEX IF NOT EXISTS "Invoice_org_month_idx"
    ON "Invoice" ("organizationId", "invoiceMonth")
  `.execute(kysely);
}

export async function getMembershipInvoiceForMonth({ organizationUserId, month }: { organizationUserId: string; month: string }) {
  await ensureInvoiceTable();

  const row = await kysely
    .selectFrom("Invoice")
    .selectAll()
    .where("organizationUserId", "=", organizationUserId)
    .where("invoiceMonth", "=", toMonthDate(month))
    .executeTakeFirst();

  return row ? mapInvoiceRow(row) : null;
}

export async function getMembershipInvoices({ organizationUserId }: { organizationUserId: string }) {
  await ensureInvoiceTable();

  const rows = await kysely
    .selectFrom("Invoice")
    .selectAll()
    .where("organizationUserId", "=", organizationUserId)
    .orderBy("invoiceMonth", "desc")
    .orderBy("updatedAt", "desc")
    .execute();

  return rows.map(mapInvoiceRow);
}

export async function upsertMembershipInvoice({
  organizationId,
  organizationUserId,
  uploadedByUserId,
  month,
  fileName,
  mimeType,
  fileSizeBytes,
  fileData
}: {
  organizationId: string;
  organizationUserId: string;
  uploadedByUserId: string;
  month: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  fileData: Uint8Array;
}) {
  await ensureInvoiceTable();

  const row = await kysely
    .insertInto("Invoice")
    .values({
      id: randomUUID().replace(/-/g, ""),
      organizationId,
      organizationUserId,
      invoiceMonth: toMonthDate(month),
      fileName,
      mimeType,
      fileSizeBytes,
      fileData,
      uploadedByUserId,
      createdAt: new Date(),
      updatedAt: new Date()
    })
    .onConflict((oc) =>
      oc.columns(["organizationUserId", "invoiceMonth"]).doUpdateSet({
        fileName,
        mimeType,
        fileSizeBytes,
        fileData,
        uploadedByUserId,
        updatedAt: new Date()
      })
    )
    .returningAll()
    .executeTakeFirstOrThrow();

  return mapInvoiceRow(row);
}

export async function getMembershipInvoiceBinary({ id, organizationUserId }: { id: string; organizationUserId: string }) {
  await ensureInvoiceTable();

  return (
    (await kysely
      .selectFrom("Invoice")
      .selectAll()
      .where("id", "=", id)
      .where("organizationUserId", "=", organizationUserId)
      .executeTakeFirst()) ?? null
  );
}

export async function getAdminInvoiceBinary({ id, organizationId }: { id: string; organizationId: string }) {
  await ensureInvoiceTable();

  return (
    (await kysely
      .selectFrom("Invoice")
      .selectAll()
      .where("id", "=", id)
      .where("organizationId", "=", organizationId)
      .executeTakeFirst()) ?? null
  );
}

export async function getAdminInvoicesForMonth({ organizationId, month }: { organizationId: string; month: string }) {
  await ensureInvoiceTable();

  const rows = await kysely
    .selectFrom("Invoice as i")
    .innerJoin("OrganizationUser as ou", "ou.id", "i.organizationUserId")
    .innerJoin("User as u", "u.id", "ou.userId")
    .select([
      "i.id as id",
      "i.organizationId as organizationId",
      "i.organizationUserId as organizationUserId",
      "i.invoiceMonth as invoiceMonth",
      "i.fileName as fileName",
      "i.mimeType as mimeType",
      "i.fileSizeBytes as fileSizeBytes",
      "i.uploadedByUserId as uploadedByUserId",
      "i.createdAt as createdAt",
      "i.updatedAt as updatedAt",
      "u.name as userName",
      "u.email as userEmail",
      "ou.role as role"
    ])
    .where("i.organizationId", "=", organizationId)
    .where("i.invoiceMonth", "=", toMonthDate(month))
    .orderBy("u.name", "asc")
    .orderBy("u.email", "asc")
    .execute();

  return rows.map((row) => ({
    ...row,
    invoiceMonth: toMonthKey(row.invoiceMonth)
  })) as AdminInvoiceRecord[];
}

export function normalizeInvoiceMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Malformed invoice month.");
  }
  return month;
}

export function validateInvoiceUpload(file: File | null) {
  if (!file) {
    throw new Error("Select a PDF invoice to upload.");
  }

  const looksLikePdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!looksLikePdf) {
    throw new Error("Only PDF invoices are allowed.");
  }

  if (file.size <= 0) {
    throw new Error("Invoice file is empty.");
  }

  if (file.size > INVOICE_MAX_BYTES) {
    throw new Error("Invoice file exceeds the 10 MB limit.");
  }
}
