/**
 * Sales history → simple forecast. The trend is an ordinary least-squares
 * straight line through monthly kg; pack-size shares are the average of the
 * last three months. Deliberately simple and explainable.
 */
export interface Format {
  id: string;
  grams: number;
}
export interface MonthRow {
  label: string;
  totalKg: number;
  kgByFormat: Record<string, number>;
}
export interface Forecast {
  history: MonthRow[];
  forecast: { label: string; totalKg: number }[];
  trendKgPerMonth: number;
  /** Share of weight per format id, in percent, summing to exactly 100. */
  shares: Record<string, number>;
  unmatched: string[];
}

const number = (cell: string) => {
  const n = Number(cell.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Grams named in a header such as "1 kg", "500 g packs" or "250g". */
export function headerGrams(header: string): number | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i.exec(header);
  if (!m) return null;
  const value = Number(m[1].replace(",", "."));
  return m[2].toLowerCase() === "kg" ? value * 1000 : value;
}

function nextLabel(label: string, step: number): string {
  const m = /^(\d{4})-(\d{1,2})/.exec(label.trim());
  if (!m) return `Month +${step}`;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + step, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Rounds shares to one decimal and makes them total exactly 100. */
function exactShares(kg: Record<string, number>): Record<string, number> {
  const ids = Object.keys(kg);
  const total = ids.reduce((s, id) => s + kg[id], 0);
  if (total <= 0) return {};
  const shares: Record<string, number> = {};
  let used = 0;
  ids.forEach((id, i) => {
    const share =
      i === ids.length - 1
        ? Math.round((100 - used) * 10) / 10
        : Math.round((kg[id] / total) * 100 * 10) / 10;
    shares[id] = share;
    used += share;
  });
  return shares;
}

export function buildForecast(
  rows: string[][],
  formats: Format[],
  unit: "packs" | "kg",
  months = 6,
): Forecast {
  const [header = [], ...body] = rows;
  const columns: { col: number; format: Format }[] = [];
  const unmatched: string[] = [];
  header.slice(1).forEach((h, i) => {
    const grams = headerGrams(h);
    const format = formats.find((f) => f.grams === grams);
    if (format) columns.push({ col: i + 1, format });
    else if (h.trim()) unmatched.push(h.trim());
  });
  const history: MonthRow[] = [];
  for (const row of body) {
    const kgByFormat: Record<string, number> = {};
    let any = false;
    for (const { col, format } of columns) {
      const value = number(row[col] ?? "");
      if (value === null || value < 0) continue;
      any = true;
      kgByFormat[format.id] =
        (kgByFormat[format.id] ?? 0) +
        (unit === "packs" ? (value * format.grams) / 1000 : value);
    }
    if (!any) continue;
    history.push({
      label: (row[0] ?? "").trim() || `Month ${history.length + 1}`,
      totalKg: Object.values(kgByFormat).reduce((s, v) => s + v, 0),
      kgByFormat,
    });
  }
  const n = history.length;
  let slope = 0;
  let intercept = n ? history[0].totalKg : 0;
  if (n >= 2) {
    const meanX = (n - 1) / 2;
    const meanY = history.reduce((s, r) => s + r.totalKg, 0) / n;
    let sxy = 0;
    let sxx = 0;
    history.forEach((r, x) => {
      sxy += (x - meanX) * (r.totalKg - meanY);
      sxx += (x - meanX) ** 2;
    });
    slope = sxx ? sxy / sxx : 0;
    intercept = meanY - slope * meanX;
  }
  const last = history.at(-1)?.label ?? "";
  const forecast = n
    ? Array.from({ length: months }, (_, i) => ({
        label: nextLabel(last, i + 1),
        totalKg: Math.max(0, Math.round(intercept + slope * (n + i))),
      }))
    : [];
  const recent = history.slice(-3);
  const recentKg: Record<string, number> = {};
  for (const r of recent)
    for (const [id, kg] of Object.entries(r.kgByFormat))
      recentKg[id] = (recentKg[id] ?? 0) + kg;
  return {
    history,
    forecast,
    trendKgPerMonth: Math.round(slope),
    shares: exactShares(recentKg),
    unmatched,
  };
}
