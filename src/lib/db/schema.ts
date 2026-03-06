import type { ColumnType } from "kysely";

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export type Role = "employee" | "admin";
export const Role = {
  employee: "employee",
  admin: "admin"
} as const;

export type UserStatus = "active" | "disabled";

export interface OrganizationTable {
  id: string;
  name: string;
  timezone: string;
  weekStartDay: number;
  createdAt: ColumnType<Date, Date | string | undefined, never>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export interface UserTable {
  id: string;
  email: string;
  googleSub: string;
  name: string | null;
  avatarUrl: string | null;
  status: UserStatus;
  createdAt: ColumnType<Date, Date | string | undefined, never>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export interface OrganizationUserTable {
  id: string;
  organizationId: string;
  userId: string;
  role: Role;
  weeklyTargetMinute: number;
  active: boolean;
  createdAt: ColumnType<Date, Date | string | undefined, never>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export interface TimeSessionTable {
  id: string;
  organizationUserId: string;
  userId: string;
  startAt: Date;
  endAt: Date | null;
  editedById: string | null;
  editReason: string | null;
  createdAt: ColumnType<Date, Date | string | undefined, never>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export interface WeekLockTable {
  id: string;
  organizationId: string;
  weekStart: Date;
  lockedAt: ColumnType<Date, Date | string | undefined, never>;
  lockedByUserId: string | null;
  autoLocked: boolean;
}

export interface AuditLogTable {
  id: string;
  actorUserId: string | null;
  entityType: string;
  entityId: string;
  action: string;
  beforeJson: JsonValue | null;
  afterJson: JsonValue | null;
  createdAt: ColumnType<Date, Date | string | undefined, never>;
}

export interface AppSessionTable {
  id: string;
  userId: string;
  organizationId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: ColumnType<Date, Date | string | undefined, never>;
  revokedAt: Date | null;
}

export interface UserPreferenceTable {
  id: string;
  userId: string;
  timezone: string;
  createdAt: ColumnType<Date, Date | string | undefined, never>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export interface TimeOffEntryTable {
  id: string;
  organizationId: string;
  organizationUserId: string;
  date: ColumnType<Date, Date | string, Date | string>;
  type: string;
  status: string;
  createdAt: ColumnType<Date, Date | string | undefined, never>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string | undefined>;
}

export interface Database {
  Organization: OrganizationTable;
  User: UserTable;
  OrganizationUser: OrganizationUserTable;
  TimeSession: TimeSessionTable;
  WeekLock: WeekLockTable;
  AuditLog: AuditLogTable;
  AppSession: AppSessionTable;
  UserPreference: UserPreferenceTable;
  TimeOffEntry: TimeOffEntryTable;
}
