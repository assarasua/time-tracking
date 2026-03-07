import "server-only";

import { randomUUID } from "node:crypto";
import { format } from "date-fns";

import { sql } from "kysely";

import { getAppBaseUrl } from "@/lib/app-config";
import { kysely } from "@/lib/db/kysely";
import { Role } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email";

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

type InvoiceAdminRecipient = {
  membershipId: string;
  email: string;
  name: string | null;
};

function toMonthDate(month: string) {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function toMonthKey(value: string | Date) {
  if (typeof value === "string") {
    return /^\d{4}-\d{2}$/.test(value) ? value : value.slice(0, 7);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
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

export async function getInvoiceAdminRecipients({ organizationId }: { organizationId: string }) {
  const admins = await kysely
    .selectFrom("OrganizationUser as ou")
    .innerJoin("User as u", "u.id", "ou.userId")
    .select([
      "ou.id as membershipId",
      "u.email as email",
      "u.name as name"
    ])
    .where("ou.organizationId", "=", organizationId)
    .where("ou.role", "=", Role.admin)
    .where("ou.active", "=", true)
    .where("u.status", "=", "active")
    .orderBy("u.email", "asc")
    .execute();

  return admins as InvoiceAdminRecipient[];
}

export async function sendInvoiceUploadNotifications({
  organizationId,
  uploaderName,
  uploaderEmail,
  membershipId,
  month,
  fileName,
  mimeType,
  fileData,
  uploadedAt,
  replaced
}: {
  organizationId: string;
  uploaderName: string | null;
  uploaderEmail: string;
  membershipId: string;
  month: string;
  fileName: string;
  mimeType: string;
  fileData: Uint8Array;
  uploadedAt: Date;
  replaced: boolean;
}) {
  const recipients = await getInvoiceAdminRecipients({ organizationId });
  if (!recipients.length) {
    console.info("invoice_admin_email_skipped_no_admins", {
      organizationId,
      membershipId,
      month
    });
    return { recipients: 0, sent: 0 };
  }

  const appUrl = getAppBaseUrl();
  const uploaderLabel = uploaderName?.trim() || uploaderEmail;
  const monthLabel = format(new Date(`${month}-01T12:00:00`), "MMMM yyyy");
  const uploadedAtLabel = format(uploadedAt, "MMM d, yyyy 'at' p");
  const subject = replaced
    ? `${uploaderLabel} replaced the invoice for ${monthLabel}`
    : `${uploaderLabel} uploaded an invoice for ${monthLabel}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937;max-width:640px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 16px;font-size:22px;color:#111827">${replaced ? "Invoice replaced" : "New invoice uploaded"}</h2>
      <p style="margin:0 0 16px">
        ${replaced ? "An existing monthly invoice has been replaced in HuTech Time Tracking." : "A new monthly invoice has been uploaded in HuTech Time Tracking."}
      </p>
      <div style="border:1px solid #d1d5db;border-radius:12px;padding:16px;background:#f9fafb;margin:0 0 20px">
        <p style="margin:0 0 8px"><strong>Employee:</strong> ${uploaderLabel}</p>
        <p style="margin:0 0 8px"><strong>Email:</strong> ${uploaderEmail}</p>
        <p style="margin:0 0 8px"><strong>Invoice month:</strong> ${monthLabel}</p>
        <p style="margin:0 0 8px"><strong>${replaced ? "Updated on" : "Uploaded on"}:</strong> ${uploadedAtLabel}</p>
        <p style="margin:0"><strong>File:</strong> ${fileName}</p>
      </div>
      <p style="margin:0 0 20px">
        You can review the invoice in the admin panel:
      </p>
      <p style="margin:0 0 24px">
        <a href="${appUrl}/admin" target="_blank" rel="noreferrer" style="display:inline-block;background:#375a21;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600">
          Open admin panel
        </a>
      </p>
      <p style="margin:0 0 8px;color:#6b7280;font-size:14px">
        The invoice PDF is attached to this email for quick review.
      </p>
      <p style="margin:0;color:#6b7280;font-size:14px">
        Sent automatically by HuTech Time Tracking.
      </p>
    </div>
  `;

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject,
        html,
        attachments: [
          {
            filename: fileName,
            content: Buffer.from(fileData),
            contentType: mimeType
          }
        ]
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      console.error("invoice_admin_email_recipient_failed", {
        organizationId,
        membershipId,
        month,
        recipient: recipient.email,
        error: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  if (failed > 0) {
    console.error("invoice_admin_email_partial_failure", {
      organizationId,
      membershipId,
      month,
      recipientCount: recipients.length,
      sent,
      failed
    });
  } else {
    console.info("invoice_admin_email_sent", {
      organizationId,
      membershipId,
      month,
      recipientCount: recipients.length
    });
  }

  return { recipients: recipients.length, sent };
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

export async function deleteMembershipInvoice({ id, organizationUserId }: { id: string; organizationUserId: string }) {
  await ensureInvoiceTable();

  return (
    (await kysely
      .deleteFrom("Invoice")
      .where("id", "=", id)
      .where("organizationUserId", "=", organizationUserId)
      .returningAll()
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
