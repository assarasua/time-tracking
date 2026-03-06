import { randomUUID } from "node:crypto";

import { addDays, format } from "date-fns";
import { sql, type Insertable, type Selectable, type Updateable } from "kysely";

import { buildGoogleCalendarAuthorizationUrl, exchangeGoogleCodeForTokenSet } from "@/lib/auth/google";
import { getCaliforniaPublicHolidays } from "@/lib/california-holidays";
import { kysely } from "@/lib/db/kysely";
import type { Database } from "@/lib/db/schema";
import { decryptSecret, encryptSecret } from "@/lib/secret-box";
import { cleanEnv } from "@/lib/env-utils";
import type { TimeOffEntry } from "@/lib/time-off";

const PROVIDER = "google_calendar";
const STATUS_ACTIVE = "active";
const STATUS_RECONNECT = "reconnect_required";
const STATUS_REVOKED = "revoked";
const SYNC_PENDING = "pending";
const SYNC_SYNCED = "synced";
const SYNC_FAILED = "failed";
const SYNC_DELETED = "deleted";

const GOOGLE_CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_CALENDAR_OAUTH_STATE_COOKIE_NAME = "tt_google_calendar_oauth_state";
const RATE_LIMIT_BACKOFF_MS = [500, 1500, 3000] as const;

export { GOOGLE_CALENDAR_EVENTS_SCOPE, GOOGLE_CALENDAR_OAUTH_STATE_COOKIE_NAME };

type CalendarConnectionRow = Selectable<Database["CalendarConnection"]>;
type CalendarConnectionInsert = Insertable<Database["CalendarConnection"]>;
type CalendarConnectionUpdate = Updateable<Database["CalendarConnection"]>;
type SyncRow = Selectable<Database["TimeOffCalendarSync"]>;

function toDateOnly(value: string | Date) {
  if (typeof value === "string") {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10);
  }
  return format(value, "yyyy-MM-dd");
}

function nextDay(date: string) {
  return format(addDays(new Date(`${date}T12:00:00`), 1), "yyyy-MM-dd");
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function responseErrorText(response: Response) {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function isRateLimitedResponse(response: Response) {
  if (response.status !== 403 && response.status !== 429) {
    return false;
  }

  const text = await responseErrorText(response);
  return text.includes("rateLimitExceeded") || text.includes("userRateLimitExceeded") || response.status === 429;
}

function eventPayload(entry: TimeOffEntry) {
  return {
    summary: "Time off",
    description: `Source: Hutech Time Tracking\nType: ${entry.type}\nTimeOffEntry: ${entry.id}`,
    visibility: "private",
    transparency: "opaque",
    start: { date: entry.date },
    end: { date: nextDay(entry.date) },
    extendedProperties: {
      private: {
        source: "hutech-time-tracking",
        timeOffEntryId: entry.id,
        timeOffType: entry.type
      }
    }
  };
}

function publicHolidaySyncKey(userId: string, date: string) {
  return `holiday:${userId}:${date}`;
}

function publicHolidayEventPayload(date: string, name: string) {
  return {
    summary: name,
    description: `Source: Hutech Time Tracking\nType: public_holiday\nDate: ${date}`,
    visibility: "private",
    transparency: "opaque",
    start: { date },
    end: { date: nextDay(date) },
    extendedProperties: {
      private: {
        source: "hutech-time-tracking",
        holidayDate: date,
        holidayType: "public_holiday"
      }
    }
  };
}

export async function ensureGoogleCalendarTables() {
  await kysely.schema
    .createTable("CalendarConnection")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("userId", "text", (col) => col.notNull().references("User.id").onDelete("cascade"))
    .addColumn("provider", "text", (col) => col.notNull().defaultTo(PROVIDER))
    .addColumn("calendarId", "text", (col) => col.notNull().defaultTo("primary"))
    .addColumn("accessToken", "text")
    .addColumn("refreshToken", "text")
    .addColumn("scope", "text")
    .addColumn("tokenExpiresAt", "timestamptz")
    .addColumn("status", "text", (col) => col.notNull().defaultTo(STATUS_ACTIVE))
    .addColumn("lastError", "text")
    .addColumn("revokedAt", "timestamptz")
    .addColumn("createdAt", "timestamptz", (col) => col.notNull().defaultTo(kysely.fn("now", [])))
    .addColumn("updatedAt", "timestamptz", (col) => col.notNull().defaultTo(kysely.fn("now", [])))
    .execute();

  await kysely.schema
    .createTable("TimeOffCalendarSync")
    .ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("timeOffEntryId", "text", (col) => col.notNull())
    .addColumn("userId", "text", (col) => col.notNull().references("User.id").onDelete("cascade"))
    .addColumn("provider", "text", (col) => col.notNull().defaultTo(PROVIDER))
    .addColumn("calendarId", "text")
    .addColumn("externalEventId", "text")
    .addColumn("syncStatus", "text", (col) => col.notNull().defaultTo(SYNC_PENDING))
    .addColumn("lastSyncedAt", "timestamptz")
    .addColumn("lastError", "text")
    .addColumn("createdAt", "timestamptz", (col) => col.notNull().defaultTo(kysely.fn("now", [])))
    .addColumn("updatedAt", "timestamptz", (col) => col.notNull().defaultTo(kysely.fn("now", [])))
    .execute();

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "CalendarConnection_user_provider_key" ON "CalendarConnection" ("userId", "provider")`.execute(kysely);
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "TimeOffCalendarSync_entry_provider_key" ON "TimeOffCalendarSync" ("timeOffEntryId", "provider")`.execute(kysely);
  await sql`CREATE INDEX IF NOT EXISTS "TimeOffCalendarSync_user_status_idx" ON "TimeOffCalendarSync" ("userId", "syncStatus", "updatedAt")`.execute(kysely);
}

function id() {
  return randomUUID().replace(/-/g, "");
}

async function connectionByUserId(userId: string) {
  await ensureGoogleCalendarTables();
  return (
    (await kysely
      .selectFrom("CalendarConnection")
      .selectAll()
      .where("userId", "=", userId)
      .where("provider", "=", PROVIDER)
      .executeTakeFirst()) ?? null
  );
}

async function syncRowByEntryId(timeOffEntryId: string) {
  await ensureGoogleCalendarTables();
  return (
    (await kysely
      .selectFrom("TimeOffCalendarSync")
      .selectAll()
      .where("timeOffEntryId", "=", timeOffEntryId)
      .where("provider", "=", PROVIDER)
      .executeTakeFirst()) ?? null
  );
}

async function upsertSyncRow(params: {
  timeOffEntryId: string;
  userId: string;
  calendarId?: string | null;
  externalEventId?: string | null;
  syncStatus: string;
  lastError?: string | null;
  lastSyncedAt?: Date | null;
}) {
  await ensureGoogleCalendarTables();
  const existing = await syncRowByEntryId(params.timeOffEntryId);
  const values = {
    timeOffEntryId: params.timeOffEntryId,
    userId: params.userId,
    provider: PROVIDER,
    calendarId: params.calendarId ?? null,
    externalEventId: params.externalEventId ?? null,
    syncStatus: params.syncStatus,
    lastError: params.lastError ?? null,
    lastSyncedAt: params.lastSyncedAt ?? null,
    updatedAt: new Date()
  };

  if (existing) {
    return await kysely.updateTable("TimeOffCalendarSync").set(values).where("id", "=", existing.id).returningAll().executeTakeFirstOrThrow();
  }

  return await kysely
    .insertInto("TimeOffCalendarSync")
    .values({ id: id(), createdAt: new Date(), ...values })
    .returningAll()
    .executeTakeFirstOrThrow();
}

async function setConnectionState(userId: string, data: CalendarConnectionUpdate) {
  await ensureGoogleCalendarTables();
  const existing = await connectionByUserId(userId);
  if (existing) {
    return await kysely
      .updateTable("CalendarConnection")
      .set({ ...data, updatedAt: new Date() })
      .where("id", "=", existing.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  const values: CalendarConnectionInsert = {
    id: id(),
    userId,
    provider: PROVIDER,
    calendarId: "primary",
    status: STATUS_ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data
  };

  return await kysely
    .insertInto("CalendarConnection")
    .values(values)
    .returningAll()
    .executeTakeFirstOrThrow();
}

function tokenExpiry(expiresInSeconds?: number) {
  if (!expiresInSeconds) return null;
  return new Date(Date.now() + expiresInSeconds * 1000);
}

export async function saveGoogleCalendarConnection(params: {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
}) {
  const current = await connectionByUserId(params.userId);
  const refreshToken = params.refreshToken || (current?.refreshToken ? decryptSecret(current.refreshToken) : "");

  return await setConnectionState(params.userId, {
    calendarId: "primary",
    accessToken: encryptSecret(params.accessToken),
    refreshToken: refreshToken ? encryptSecret(refreshToken) : null,
    tokenExpiresAt: tokenExpiry(params.expiresIn),
    scope: params.scope ?? GOOGLE_CALENDAR_EVENTS_SCOPE,
    status: refreshToken ? STATUS_ACTIVE : STATUS_RECONNECT,
    lastError: refreshToken ? null : "Missing refresh token from Google OAuth callback",
    revokedAt: null
  });
}

export async function disconnectGoogleCalendar(userId: string) {
  const connection = await connectionByUserId(userId);
  if (!connection) return null;

  const syncedRows = await kysely
    .selectFrom("TimeOffCalendarSync")
    .selectAll()
    .where("userId", "=", userId)
    .where("provider", "=", PROVIDER)
    .where("syncStatus", "!=", SYNC_DELETED)
    .execute();

  for (const row of syncedRows) {
    if (!row.externalEventId) {
      continue;
    }

    try {
      await deleteEvent(connection, row.externalEventId);
      await upsertSyncRow({
        timeOffEntryId: row.timeOffEntryId,
        userId,
        calendarId: row.calendarId,
        externalEventId: row.externalEventId,
        syncStatus: SYNC_DELETED,
        lastSyncedAt: new Date(),
        lastError: null
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete Google Calendar event during disconnect";
      await upsertSyncRow({
        timeOffEntryId: row.timeOffEntryId,
        userId,
        calendarId: row.calendarId,
        externalEventId: row.externalEventId,
        syncStatus: SYNC_FAILED,
        lastSyncedAt: null,
        lastError: message
      });
    }

    await sleep(250);
  }

  await setConnectionState(userId, {
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    status: STATUS_REVOKED,
    lastError: null,
    revokedAt: new Date()
  });

  await kysely
    .updateTable("TimeOffCalendarSync")
    .set({ syncStatus: "disconnected", updatedAt: new Date(), lastError: "Calendar disconnected" })
    .where("userId", "=", userId)
    .where("provider", "=", PROVIDER)
    .where("syncStatus", "!=", SYNC_DELETED)
    .execute();

  return connection;
}

async function refreshAccessToken(connection: CalendarConnectionRow) {
  const refreshToken = decryptSecret(connection.refreshToken);
  const clientId = cleanEnv(process.env.GOOGLE_CLIENT_ID);
  const clientSecret = cleanEnv(process.env.GOOGLE_CLIENT_SECRET);

  if (!refreshToken || !clientId || !clientSecret) {
    await setConnectionState(connection.userId, {
      status: STATUS_RECONNECT,
      lastError: "Missing refresh token or Google credentials",
      accessToken: null,
      tokenExpiresAt: null
    });
    throw new Error("google_calendar_reconnect_required");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token"
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store"
  });

  const payload = (await response.json()) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };

  if (!response.ok || !payload.access_token) {
    const reconnect = payload.error === "invalid_grant";
    await setConnectionState(connection.userId, {
      status: reconnect ? STATUS_RECONNECT : STATUS_ACTIVE,
      lastError: payload.error_description ?? payload.error ?? "Unable to refresh Google Calendar token",
      accessToken: null,
      tokenExpiresAt: null,
      revokedAt: reconnect ? new Date() : null
    });
    throw new Error(reconnect ? "google_calendar_reconnect_required" : "google_calendar_refresh_failed");
  }

  await setConnectionState(connection.userId, {
    accessToken: encryptSecret(payload.access_token),
    tokenExpiresAt: tokenExpiry(payload.expires_in),
    status: STATUS_ACTIVE,
    lastError: null,
    revokedAt: null
  });

  return payload.access_token;
}

async function getValidAccessToken(connection: CalendarConnectionRow) {
  const token = decryptSecret(connection.accessToken);
  if (token && connection.tokenExpiresAt && connection.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return token;
  }
  return refreshAccessToken(connection);
}

async function calendarRequest(connection: CalendarConnectionRow, path: string, init: RequestInit) {
  let token = await getValidAccessToken(connection);

  for (let attempt = 0; attempt <= RATE_LIMIT_BACKOFF_MS.length; attempt += 1) {
    const response = await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {})
      },
      cache: "no-store"
    });

    if (response.status === 401) {
      token = await refreshAccessToken(connection);
      continue;
    }

    if (attempt < RATE_LIMIT_BACKOFF_MS.length && (await isRateLimitedResponse(response))) {
      await sleep(RATE_LIMIT_BACKOFF_MS[attempt]);
      continue;
    }

    return response;
  }

  return await fetch(`${GOOGLE_CALENDAR_API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {})
    },
    cache: "no-store"
  });
}

async function createEvent(connection: CalendarConnectionRow, entry: TimeOffEntry) {
  const response = await calendarRequest(
    connection,
    `/calendars/${encodeURIComponent(connection.calendarId)}/events`,
    { method: "POST", body: JSON.stringify(eventPayload(entry)) }
  );

  if (!response.ok) {
    throw new Error(`google_calendar_create_failed:${await response.text()}`);
  }

  return (await response.json()) as { id: string };
}

async function createGenericEvent(connection: CalendarConnectionRow, payload: Record<string, unknown>) {
  const response = await calendarRequest(
    connection,
    `/calendars/${encodeURIComponent(connection.calendarId)}/events`,
    { method: "POST", body: JSON.stringify(payload) }
  );

  if (!response.ok) {
    throw new Error(`google_calendar_create_failed:${await response.text()}`);
  }

  return (await response.json()) as { id: string };
}

async function updateEvent(connection: CalendarConnectionRow, eventId: string, entry: TimeOffEntry) {
  const response = await calendarRequest(
    connection,
    `/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(eventPayload(entry)) }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`google_calendar_update_failed:${await response.text()}`);
  }

  return (await response.json()) as { id: string };
}

async function updateGenericEvent(connection: CalendarConnectionRow, eventId: string, payload: Record<string, unknown>) {
  const response = await calendarRequest(
    connection,
    `/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "PATCH", body: JSON.stringify(payload) }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`google_calendar_update_failed:${await response.text()}`);
  }

  return (await response.json()) as { id: string };
}

async function deleteEvent(connection: CalendarConnectionRow, eventId: string) {
  const response = await calendarRequest(
    connection,
    `/calendars/${encodeURIComponent(connection.calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" }
  );

  if (response.status === 404) return;
  if (!response.ok) {
    throw new Error(`google_calendar_delete_failed:${await response.text()}`);
  }
}

export async function getGoogleCalendarStatus(userId: string) {
  const connection = await connectionByUserId(userId);
  if (!connection || connection.status === STATUS_REVOKED || connection.revokedAt) {
    return { status: "not_connected" as const, lastError: null };
  }

  if (connection.status === STATUS_RECONNECT) {
    const failedSync = await kysely
      .selectFrom("TimeOffCalendarSync")
      .select(["lastError", "updatedAt"])
      .where("userId", "=", userId)
      .where("provider", "=", PROVIDER)
      .where("syncStatus", "=", SYNC_FAILED)
      .orderBy("updatedAt", "desc")
      .executeTakeFirst();
    return { status: "reconnect_required" as const, lastError: connection.lastError ?? failedSync?.lastError ?? null };
  }

  const failedSync = await kysely
    .selectFrom("TimeOffCalendarSync")
    .select(["lastError", "updatedAt"])
    .where("userId", "=", userId)
    .where("provider", "=", PROVIDER)
    .where("syncStatus", "=", SYNC_FAILED)
    .where("updatedAt", ">=", connection.updatedAt)
    .orderBy("updatedAt", "desc")
    .executeTakeFirst();

  if (failedSync?.lastError) {
    return { status: "sync_issue" as const, lastError: failedSync.lastError };
  }

  return { status: "connected" as const, lastError: null };
}

export function getGoogleCalendarStartUrl(state: string, redirectUri: string) {
  return buildGoogleCalendarAuthorizationUrl(state, redirectUri);
}

export async function completeGoogleCalendarConnection(params: { userId: string; code: string; redirectUri: string }) {
  const tokenSet = await exchangeGoogleCodeForTokenSet(params.code, params.redirectUri);
  return await saveGoogleCalendarConnection({
    userId: params.userId,
    accessToken: tokenSet.accessToken,
    refreshToken: tokenSet.refreshToken,
    expiresIn: tokenSet.expiresIn,
    scope: tokenSet.scope
  });
}

export async function syncCaliforniaPublicHolidaysToGoogleCalendar(params: {
  userId: string;
  from: string;
  to: string;
}) {
  await ensureGoogleCalendarTables();
  const connection = await connectionByUserId(params.userId);
  if (!connection || connection.status !== STATUS_ACTIVE || connection.revokedAt) {
    return [];
  }

  const holidays = getCaliforniaPublicHolidays(params.from, params.to);
  const results: Array<
    | { status: "synced"; date: string; eventId: string }
    | { status: "failed"; date: string; error: string }
  > = [];

  for (const holiday of holidays) {
      const syncKey = publicHolidaySyncKey(params.userId, holiday.date);
      const existing = await syncRowByEntryId(syncKey);

      try {
        const payload = publicHolidayEventPayload(holiday.date, holiday.name);
        const updated = existing?.externalEventId
          ? await updateGenericEvent(connection, existing.externalEventId, payload)
          : null;
        const created = updated ?? (await createGenericEvent(connection, payload));

        await upsertSyncRow({
          timeOffEntryId: syncKey,
          userId: params.userId,
          calendarId: connection.calendarId,
          externalEventId: created.id,
          syncStatus: SYNC_SYNCED,
          lastSyncedAt: new Date(),
          lastError: null
        });

        results.push({ status: "synced", date: holiday.date, eventId: created.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown Google Calendar holiday sync error";
        await upsertSyncRow({
          timeOffEntryId: syncKey,
          userId: params.userId,
          calendarId: connection.calendarId,
          externalEventId: existing?.externalEventId ?? null,
          syncStatus: SYNC_FAILED,
          lastSyncedAt: null,
          lastError: message
        });
        results.push({ status: "failed", date: holiday.date, error: message });
      }
      await sleep(250);
  }

  return results;
}

export async function syncTimeOffEntryToGoogleCalendar(params: { userId: string; entry: TimeOffEntry }) {
  await ensureGoogleCalendarTables();
  const connection = await connectionByUserId(params.userId);
  if (!connection || connection.status === STATUS_REVOKED || connection.revokedAt) {
    return { status: "not_connected" as const };
  }

  if (connection.status === STATUS_RECONNECT) {
    await upsertSyncRow({
      timeOffEntryId: params.entry.id,
      userId: params.userId,
      calendarId: connection.calendarId,
      syncStatus: SYNC_FAILED,
      lastError: connection.lastError ?? "Reconnect required"
    });
    return { status: "reconnect_required" as const };
  }

  const existing = await syncRowByEntryId(params.entry.id);

  try {
    const updated = existing?.externalEventId
      ? await updateEvent(connection, existing.externalEventId, params.entry)
      : null;
    const created = updated ?? (await createEvent(connection, params.entry));

    await upsertSyncRow({
      timeOffEntryId: params.entry.id,
      userId: params.userId,
      calendarId: connection.calendarId,
      externalEventId: created.id,
      syncStatus: SYNC_SYNCED,
      lastSyncedAt: new Date(),
      lastError: null
    });

    return { status: "synced" as const, externalEventId: created.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Calendar sync error";
    const reconnectRequired = message.includes("reconnect_required");
    await upsertSyncRow({
      timeOffEntryId: params.entry.id,
      userId: params.userId,
      calendarId: connection.calendarId,
      externalEventId: existing?.externalEventId ?? null,
      syncStatus: SYNC_FAILED,
      lastError: message,
      lastSyncedAt: reconnectRequired ? null : new Date()
    });
    return { status: reconnectRequired ? ("reconnect_required" as const) : ("failed" as const), error: message };
  }
}

export async function deleteTimeOffEntryFromGoogleCalendar(params: { userId: string; timeOffEntryId: string }) {
  await ensureGoogleCalendarTables();
  const syncRow = await syncRowByEntryId(params.timeOffEntryId);
  if (!syncRow?.externalEventId) {
    return { status: "not_synced" as const };
  }

  const connection = await connectionByUserId(params.userId);
  if (!connection || connection.status === STATUS_REVOKED || connection.revokedAt) {
    await upsertSyncRow({
      timeOffEntryId: params.timeOffEntryId,
      userId: params.userId,
      calendarId: syncRow.calendarId,
      externalEventId: syncRow.externalEventId,
      syncStatus: SYNC_FAILED,
      lastError: "Calendar disconnected"
    });
    return { status: "not_connected" as const };
  }

  try {
    await deleteEvent(connection, syncRow.externalEventId);
    await upsertSyncRow({
      timeOffEntryId: params.timeOffEntryId,
      userId: params.userId,
      calendarId: connection.calendarId,
      externalEventId: syncRow.externalEventId,
      syncStatus: SYNC_DELETED,
      lastSyncedAt: new Date(),
      lastError: null
    });
    return { status: "deleted" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Calendar delete error";
    await upsertSyncRow({
      timeOffEntryId: params.timeOffEntryId,
      userId: params.userId,
      calendarId: connection.calendarId,
      externalEventId: syncRow.externalEventId,
      syncStatus: SYNC_FAILED,
      lastError: message,
      lastSyncedAt: null
    });
    return { status: message.includes("reconnect_required") ? ("reconnect_required" as const) : ("failed" as const), error: message };
  }
}
