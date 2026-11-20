import { Decimal } from "decimal.js";
import type { ScenarioInput } from "../models/api";
import { missing } from "../../backend/src/domain/inputs";
import {
  fieldIds,
  setupProblems,
  type SetupProblem,
} from "../setup/setupState";

export type Format = ScenarioInput["formats"][number];
export type Machine = ScenarioInput["machines"][number];
export const MAX_FORMATS = 20;

export function newId(prefix: string, taken: string[]): string {
  for (let n = 1; ; n++) {
    const id = `${prefix}-${n}`;
    if (!taken.includes(id)) return id;
  }
}

export function blankMachine(id: string): Machine {
  return {
    id,
    throughput: {
      method: "cycle",
      packagesPerCycle: missing(),
      cycleSeconds: missing(),
    },
    operators: missing(),
    investmentEuro: missing(),
    maintenanceEuroPerMonth: missing(),
    availableHoursPerMonth: missing(),
  };
}

export function blankFormat(id: string, machineId: string): Format {
  return {
    id,
    portionWeightGrams: missing(),
    allocationPercent: missing(),
    materialCost: { method: "combined", combinedEuroPerPackage: missing() },
    machineId,
  };
}

/** A scenario the form can edit: at least one machine, every format assigned. */
export function editable(input: ScenarioInput): ScenarioInput {
  const machines = input.machines.length
    ? input.machines
    : [blankMachine("machine-1")];
  const machineId = machines[0].id;
  const formats = input.formats.length
    ? input.formats
    : [blankFormat("format-1", machineId)];
  return {
    ...input,
    machines,
    formats: formats.map((f) => ({
      ...f,
      machineId: f.machineId ?? machineId,
    })),
  };
}

/** Every field empty: the visitor's own data, never sample figures. */
export function blankScenario(): ScenarioInput {
  return editable({
    monthlyProductionKg: missing(),
    formats: [],
    machines: [],
    labor: { method: "perPackage", euroPerPackage: missing() },
    additionalOperatingEuroPerMonth: missing(),
  });
}

export function shareTotal(formats: Format[]): Decimal | null {
  let sum = new Decimal(0);
  for (const f of formats) {
    if (f.allocationPercent.value === null) return null;
    try {
      sum = sum.plus(f.allocationPercent.value);
    } catch {
      return null;
    }
  }
  return sum;
}

/** Onboarding steps; each validation problem belongs to the step showing its field. */
export const STEPS = [
  { id: "production", title: "Production", short: "Production" },
  { id: "costs", title: "Packaging materials", short: "Materials" },
  { id: "labour", title: "Labour & capacity", short: "Labour" },
  { id: "review", title: "Review", short: "Review" },
] as const;

export function stepOf(problem: SetupProblem): number {
  if (problem.field.endsWith("-material")) return 1;
  if (problem.field === fieldIds.machine) return 2;
  return 0;
}

export const problemsForStep = (input: ScenarioInput, step: number) =>
  setupProblems(input).filter((p) => stepOf(p) === step);
