import { stringify } from "csv-stringify/sync";

export type PayrollRow = {
  email: string;
  name: string;
  month: string;
  workedMinutes: number;
  expectedMinutes: number;
  varianceMinutes: number;
};

export function buildPayrollCsv(rows: PayrollRow[]) {
  return stringify(rows, {
    header: true,
    columns: [
      { key: "email", header: "email" },
      { key: "name", header: "name" },
      { key: "month", header: "month" },
      { key: "workedMinutes", header: "worked_minutes" },
      { key: "expectedMinutes", header: "expected_minutes" },
      { key: "varianceMinutes", header: "variance_minutes" }
    ]
  });
}
