import { z } from "zod";
import type { SalesHistory } from "./projection";

/** Sales history pasted by the user, kept per workspace scope in this browser. */
const KEY = (scope: string) => `packpilot.history.v1:${scope}`;
const schema = z
  .object({
    version: z.literal(1),
    unit: z.enum(["packs", "kg"]),
    table: z.string().max(200_000),
    savedAt: z.string(),
  })
  .strict();

export function loadHistory(scope: string): SalesHistory | null {
  try {
    const raw = localStorage.getItem(KEY(scope));
    if (!raw) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export function saveHistory(
  scope: string,
  unit: "packs" | "kg",
  table: string,
): boolean {
  try {
    localStorage.setItem(
      KEY(scope),
      JSON.stringify({
        version: 1,
        unit,
        table,
        savedAt: new Date().toISOString(),
      }),
    );
    return true;
  } catch {
    return false;
  }
}
export function clearHistory(scope: string) {
  try {
    localStorage.removeItem(KEY(scope));
  } catch {
    // Nothing stored.
  }
}
