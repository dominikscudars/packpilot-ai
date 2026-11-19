import { z } from "zod";
import { Decimal } from "decimal.js";
import type { ScenarioInput } from "../models/api";
import { scenarioInputSchema } from "../../backend/src/domain/scenario";

/**
 * Onboarding gate: a workspace is "set up" once the visitor has saved inputs
 * that meet the engine's minimum requirements. This is UI guidance only; it
 * never replaces backend authentication or company membership checks.
 */

/** A field that needs attention, keyed so the form can highlight it. */
export interface SetupProblem {
  field: string;
  message: string;
}

export const fieldIds = {
  production: "field-production",
  grams: (i: number) => `field-format-${i}-grams`,
  share: (i: number) => `field-format-${i}-share`,
  material: (i: number) => `field-format-${i}-material`,
  shares: "field-shares-total",
  formats: "field-formats",
  machine: "field-machine",
};

const finite = (value: string | null) =>
  value !== null && /^-?\d+(\.\d+)?$/.test(value.trim());

/**
 * Minimum valid setup from the engine's real requirements: a valid production
 * amount (zero allowed), at least one pack size with a positive weight, shares
 * that total exactly 100%, and valid machine references. Missing costs and
 * equipment details are allowed: those results stay Unknown.
 */
export function setupProblems(input: ScenarioInput): SetupProblem[] {
  const problems: SetupProblem[] = [];
  const production = input.monthlyProductionKg.value;
  if (production === null)
    problems.push({
      field: fieldIds.production,
      message: "Enter how many kilograms you produce per month (0 is allowed).",
    });
  else if (!finite(production) || Number(production) < 0)
    problems.push({
      field: fieldIds.production,
      message: "Monthly production must be a number of kilograms, 0 or more.",
    });
  if (input.formats.length === 0)
    problems.push({
      field: fieldIds.formats,
      message: "Add at least one pack size.",
    });
  let total = new Decimal(0);
  let sharesKnown = true;
  input.formats.forEach((format, i) => {
    const grams = format.portionWeightGrams.value;
    if (grams === null || !finite(grams) || Number(grams) <= 0)
      problems.push({
        field: fieldIds.grams(i),
        message: `Pack size ${i + 1}: enter a pack weight in grams above 0.`,
      });
    const share = format.allocationPercent.value;
    if (share === null || !finite(share)) {
      sharesKnown = false;
      problems.push({
        field: fieldIds.share(i),
        message: `Pack size ${i + 1}: enter its share of production in %.`,
      });
    } else if (Number(share) < 0 || Number(share) > 100) {
      sharesKnown = false;
      problems.push({
        field: fieldIds.share(i),
        message: `Pack size ${i + 1}: the share must be between 0 and 100%.`,
      });
    } else total = total.plus(share);
    const cost = format.materialCost;
    const costs =
      cost.method === "combined"
        ? [cost.combinedEuroPerPackage.value]
        : [cost.bagEuroPerPackage.value, cost.labelEuroPerPackage.value];
    if (costs.some((c) => c !== null && (!finite(c) || Number(c) < 0)))
      problems.push({
        field: fieldIds.material(i),
        message: `Pack size ${i + 1}: costs cannot be negative.`,
      });
    if (
      format.machineId !== null &&
      !input.machines.some((m) => m.id === format.machineId)
    )
      problems.push({
        field: fieldIds.machine,
        message: `Pack size ${i + 1} refers to a machine that does not exist.`,
      });
  });
  if (sharesKnown && input.formats.length > 0 && !total.eq(100))
    problems.push({
      field: fieldIds.shares,
      message: `Shares of production add up to ${total.toString()}%; they must total exactly 100%.`,
    });
  if (new Set(input.formats.map((f) => f.id)).size !== input.formats.length)
    problems.push({
      field: fieldIds.formats,
      message: "Two pack sizes share the same identifier.",
    });
  if (problems.length === 0 && !scenarioInputSchema.safeParse(input).success)
    problems.push({
      field: fieldIds.formats,
      message:
        "Some values are not valid numbers. Check the highlighted fields.",
    });
  return problems;
}

/** Workspace scope: readiness and drafts never leak between modes, users or companies. */
export const scopeKey = (
  mode: "demo" | "authenticated",
  userId: string | null,
  companyId: string,
) => `${mode}:${userId ?? "local"}:${companyId}`;

const STORE = "packpilot.setup.v1";
const recordSchema = z
  .object({
    version: z.literal(1),
    scenarioId: z.string().min(1),
    completedAt: z.string(),
  })
  .strict();
export type SetupRecord = z.infer<typeof recordSchema>;

function readAll(): Record<string, SetupRecord> {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const out: Record<string, SetupRecord> = {};
    for (const [scope, value] of Object.entries(parsed)) {
      const record = recordSchema.safeParse(value);
      if (record.success) out[scope] = record.data;
    }
    return out;
  } catch {
    return {};
  }
}
function writeAll(all: Record<string, SetupRecord>) {
  try {
    localStorage.setItem(STORE, JSON.stringify(all));
  } catch {
    // Storage blocked: readiness then lasts for this page session only.
  }
}

export function loadSetupRecord(scope: string): SetupRecord | null {
  return readAll()[scope] ?? null;
}
export function saveSetupRecord(scope: string, scenarioId: string) {
  writeAll({
    ...readAll(),
    [scope]: { version: 1, scenarioId, completedAt: new Date().toISOString() },
  });
}
export function clearSetupRecords(prefix: string) {
  const all = readAll();
  for (const scope of Object.keys(all))
    if (scope.startsWith(prefix)) delete all[scope];
  writeAll(all);
}

/** Session draft of the data-entry form, scoped and validated on restore. */
const DRAFT = "packpilot.draft.v1:";
export function loadDraft(scope: string): ScenarioInput | null {
  try {
    const raw = sessionStorage.getItem(DRAFT + scope);
    if (!raw) return null;
    const parsed = scenarioInputSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
export function saveDraft(scope: string, input: ScenarioInput | null) {
  try {
    if (input === null) sessionStorage.removeItem(DRAFT + scope);
    else sessionStorage.setItem(DRAFT + scope, JSON.stringify(input));
  } catch {
    // Storage blocked: the draft lives in memory only.
  }
}
