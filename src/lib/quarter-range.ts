import { addQuarters, endOfQuarter, format, startOfQuarter } from "date-fns";

export type QuarterSelectionMode = "previous" | "current" | "next" | "custom";

export type QuarterRange = {
  quarterKey: string;
  label: string;
  from: string;
  to: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
};

function buildQuarterRange(date: Date): QuarterRange {
  const start = startOfQuarter(date);
  const end = endOfQuarter(date);
  const year = start.getFullYear();
  const quarter = (Math.floor(start.getMonth() / 3) + 1) as 1 | 2 | 3 | 4;

  return {
    quarterKey: `${year}-Q${quarter}`,
    label: `Q${quarter} ${year}`,
    from: format(start, "yyyy-MM-dd"),
    to: format(end, "yyyy-MM-dd"),
    year,
    quarter
  };
}

export function getCurrentQuarterRange() {
  return buildQuarterRange(new Date());
}

export function getPreviousQuarterRange() {
  return buildQuarterRange(addQuarters(new Date(), -1));
}

export function getNextQuarterRange() {
  return buildQuarterRange(addQuarters(new Date(), 1));
}

export function parseQuarterKey(quarterKey: string) {
  const match = quarterKey.match(/^(\d{4})-Q([1-4])$/);
  if (!match) {
    throw new Error("Malformed quarter key.");
  }

  const year = Number(match[1]);
  const quarter = Number(match[2]) as 1 | 2 | 3 | 4;
  return { year, quarter };
}

export function getRangeForQuarter(quarterKey: string) {
  const { year, quarter } = parseQuarterKey(quarterKey);
  return buildQuarterRange(new Date(year, (quarter - 1) * 3, 1, 12));
}

export function getQuarterModeLabel(mode: Exclude<QuarterSelectionMode, "custom">) {
  if (mode === "previous") return "Previous quarter";
  if (mode === "next") return "Next quarter";
  return "Current quarter";
}

export function listQuarterOptions(centerYear = new Date().getFullYear()) {
  const options: QuarterRange[] = [];
  for (let year = centerYear - 2; year <= centerYear + 2; year += 1) {
    for (const quarter of [1, 2, 3, 4] as const) {
      options.push(getRangeForQuarter(`${year}-Q${quarter}`));
    }
  }
  return options;
}
