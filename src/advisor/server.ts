import Anthropic from "@anthropic-ai/sdk";
import { betaTool } from "@anthropic-ai/sdk/helpers/beta/json-schema";
import { z } from "zod";
import { calculatePackaging } from "../../backend/src/calculation-engine/packaging";
import { compareScenarios } from "../../backend/src/calculation-engine/comparison";
import {
  scenarioInputSchema,
  type ScenarioInput,
} from "../../backend/src/domain/scenario";
import { assumed } from "../../backend/src/domain/inputs";

export const ADVISOR_MODEL = "claude-opus-5-5";
const MAX_TURNS = 12;
const MAX_CHARS = 2000;

const SYSTEM_PROMPT = `You are PackPilot AI's packaging advisor for small food manufacturers.
You help a manufacturer decide how to upgrade their packaging operation: pack sizes, materials, labour and machinery, especially as production grows.

Rules:
- Every cost, time or saving figure you state must come from the evaluate_scenario tool or from the current operation given to you. Never estimate PackPilot figures yourself.
- To test an idea, call evaluate_scenario with the change. Compare several options when the question allows, then recommend one.
- Prices or specifications found with web search are external, unverified information: say so, cite the source, and only feed them into evaluate_scenario as labelled assumptions.
- Inputs marked "assumption" or "missing" are uncertain; say when a recommendation depends on them and what the company should measure.
- Do not certify food-contact compliance, shelf life, recyclability or machine compatibility. Say these need supplier or lab confirmation.
- Write for a non-specialist owner. Lead with the recommendation, then the numbers behind it, then what to check next. Keep it under about 300 words. Use short paragraphs and simple "- " bullets; no tables or headings.`;

const evaluationSchema = z
  .object({
    label: z.string().min(1).max(80),
    monthlyProductionKg: z.number().nonnegative().optional(),
    formats: z
      .array(
        z
          .object({
            formatId: z.string(),
            sharePercent: z.number().min(0).max(100).optional(),
            materialEuroPerPack: z.number().nonnegative().optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    machine: z
      .object({
        cycleSeconds: z.number().positive().optional(),
        packsPerCycle: z.number().int().positive().optional(),
        operators: z.number().int().positive().optional(),
        availableHoursPerMonth: z.number().positive().optional(),
        investmentEuro: z.number().nonnegative().optional(),
        maintenanceEuroPerMonth: z.number().nonnegative().optional(),
      })
      .strict()
      .optional(),
    laborEuroPerPack: z.number().nonnegative().optional(),
    laborEuroPerHour: z.number().nonnegative().optional(),
  })
  .strict();
export type Evaluation = z.infer<typeof evaluationSchema>;

const note = (label: string) =>
  `Advisor what-if "${label}"; unverified assumption.`;
const q = (value: number, label: string) => assumed(String(value), note(label));

/** Applies an advisor what-if to a copy of the current operation. */
export function applyEvaluation(
  current: ScenarioInput,
  change: Evaluation,
): ScenarioInput {
  const next = structuredClone(current);
  const { label } = change;
  if (change.monthlyProductionKg !== undefined)
    next.monthlyProductionKg = q(change.monthlyProductionKg, label);
  for (const f of change.formats ?? []) {
    const format = next.formats.find((x) => x.id === f.formatId);
    if (!format) throw new Error(`Unknown formatId "${f.formatId}".`);
    if (f.sharePercent !== undefined)
      format.allocationPercent = q(f.sharePercent, label);
    if (f.materialEuroPerPack !== undefined)
      format.materialCost = {
        method: "combined",
        combinedEuroPerPackage: q(f.materialEuroPerPack, label),
      };
  }
  const m = change.machine;
  if (m && next.machines.length) {
    const machine = next.machines[0];
    if (m.cycleSeconds !== undefined || m.packsPerCycle !== undefined) {
      const prev =
        machine.throughput.method === "cycle" ? machine.throughput : null;
      machine.throughput = {
        method: "cycle",
        cycleSeconds:
          m.cycleSeconds !== undefined
            ? q(m.cycleSeconds, label)
            : (prev?.cycleSeconds ?? { value: null, quality: "missing" }),
        packagesPerCycle:
          m.packsPerCycle !== undefined
            ? q(m.packsPerCycle, label)
            : (prev?.packagesPerCycle ?? { value: null, quality: "missing" }),
      };
    }
    if (m.operators !== undefined) machine.operators = q(m.operators, label);
    if (m.availableHoursPerMonth !== undefined)
      machine.availableHoursPerMonth = q(m.availableHoursPerMonth, label);
    if (m.investmentEuro !== undefined)
      machine.investmentEuro = q(m.investmentEuro, label);
    if (m.maintenanceEuroPerMonth !== undefined)
      machine.maintenanceEuroPerMonth = q(m.maintenanceEuroPerMonth, label);
  }
  if (change.laborEuroPerHour !== undefined)
    next.labor = {
      method: "hourly",
      euroPerPersonHour: q(change.laborEuroPerHour, label),
    };
  else if (change.laborEuroPerPack !== undefined)
    next.labor = {
      method: "perPackage",
      euroPerPackage: q(change.laborEuroPerPack, label),
    };
  return scenarioInputSchema.parse(next);
}

function summary(input: ScenarioInput) {
  const r = calculatePackaging(input);
  return {
    monthlyProductionKg: r.monthlyProductionKg,
    totalPackages: r.totalPackages,
    packagingCostEuroPerMonth: r.totalPackagingOperatingEuro,
    packagingEuroPerKg: r.packagingEuroPerPlannedKg,
    machineHours: r.machineHours,
    personHours: r.personHours,
    machineUtilizationPercent: r.machineUsage.map((u) => u.utilizationPercent),
    formats: r.rows.map((row) => ({
      formatId: row.formatId,
      packages: row.packages,
      euroPerPackedKg: row.packagingEuroPerPackedKg,
    })),
    warnings: r.warnings,
  };
}

/** Runs the engine on the current operation and an advisor what-if. */
export function evaluate(current: ScenarioInput, change: Evaluation) {
  const alternative = applyEvaluation(current, change);
  const sameDemand =
    change.monthlyProductionKg === undefined &&
    !(change.formats ?? []).some((f) => f.sharePercent !== undefined);
  const comparison = compareScenarios({
    baseline: current,
    alternative,
    sameProductAndDemand: sameDemand,
  });
  return {
    label: change.label,
    alternative: summary(alternative),
    comparedWithCurrent: {
      changeInPackagingCostEuroPerMonth:
        comparison.differences.totalPackagingEuro.absolute,
      changeInEuroPerKg: comparison.differences.euroPerPlannedKg.absolute,
      changeInMachineHours: comparison.differences.machineHours.absolute,
      savingsComparable: comparison.comparableForSavings,
      monthlyNetSavingsEuro: comparison.monthlyNetSavingsEuro,
      simplePaybackMonths: comparison.simplePaybackMonths,
      notes: [...comparison.warnings, ...comparison.assumptions],
    },
  };
}

function inputContext(current: ScenarioInput): string {
  const formats = current.formats.map((f) => ({
    formatId: f.id,
    packWeightGrams: f.portionWeightGrams,
    sharePercent: f.allocationPercent,
    materialCost: f.materialCost,
  }));
  let results: unknown;
  try {
    results = summary(current);
  } catch (e) {
    results = `Not calculable yet: ${e instanceof Error ? e.message : String(e)}`;
  }
  return JSON.stringify({
    inputs: {
      monthlyProductionKg: current.monthlyProductionKg,
      formats,
      machines: current.machines,
      labor: current.labor,
    },
    results,
  });
}

const requestSchema = z.object({
  scenario: scenarioInputSchema,
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_CHARS),
      }),
    )
    .min(1)
    .max(MAX_TURNS)
    .refine((m) => m.at(0)?.role === "user" && m.at(-1)?.role === "user", {
      message: "The conversation must start and end with a user message.",
    }),
});
export type AdvisorRequest = z.input<typeof requestSchema>;
export interface AdvisorReply {
  reply: string;
  sources: { url: string; title: string }[];
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

/** Builds the answer: Claude plus the deterministic engine as a tool. */
export async function advise(
  client: Anthropic,
  request: z.output<typeof requestSchema>,
): Promise<AdvisorReply> {
  const current = request.scenario;
  const evaluateTool = betaTool({
    name: "evaluate_scenario",
    description:
      "Run PackPilot's deterministic packaging cost engine on the company's current operation with the given changes applied, and compare it with the current operation. Omitted fields keep their current values. Use the formatId values from the current operation. Returns monthly packaging cost, cost per kg, cost per kg for each pack size, machine and person hours, utilisation, and savings or payback when comparable.",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description:
            "Short name for this option, e.g. 'Double-chamber machine'.",
        },
        monthlyProductionKg: { type: "number" },
        formats: {
          type: "array",
          items: {
            type: "object",
            properties: {
              formatId: { type: "string" },
              sharePercent: {
                type: "number",
                description:
                  "Share of production weight; all shares must total 100.",
              },
              materialEuroPerPack: {
                type: "number",
                description: "Bag and label cost in euro per pack.",
              },
            },
            required: ["formatId"],
            additionalProperties: false,
          },
        },
        machine: {
          type: "object",
          description: "Changes to the packing machine.",
          properties: {
            cycleSeconds: { type: "number" },
            packsPerCycle: { type: "integer" },
            operators: { type: "integer" },
            availableHoursPerMonth: { type: "number" },
            investmentEuro: {
              type: "number",
              description: "New purchase cost, used for payback.",
            },
            maintenanceEuroPerMonth: { type: "number" },
          },
          additionalProperties: false,
        },
        laborEuroPerPack: { type: "number" },
        laborEuroPerHour: {
          type: "number",
          description:
            "Switches labour to an hourly wage, so a faster machine lowers labour cost.",
        },
      },
      required: ["label"],
      additionalProperties: false,
    },
    run: (args) => {
      const parsed = evaluationSchema.safeParse(args);
      if (!parsed.success)
        return `Error: invalid input. ${parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}`;
      try {
        return JSON.stringify(evaluate(current, parsed.data));
      } catch (e) {
        return `Error: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  });

  const messages: Anthropic.Beta.BetaMessageParam[] = request.messages.map(
    (m, i) =>
      i === 0
        ? {
            role: "user",
            content: `The company's current operation, as PackPilot JSON (inputs with provenance, and engine results):\n${inputContext(current)}\n\nQuestion: ${m.content}`,
          }
        : { role: m.role, content: m.content },
  );

  const final = await client.beta.messages.toolRunner({
    model: ADVISOR_MODEL,
    max_tokens: 16000,
    max_iterations: 8,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" },
    system: SYSTEM_PROMPT,
    tools: [
      evaluateTool,
      { type: "web_search_20260209", name: "web_search", max_uses: 3 },
    ],
    messages,
  });

  if (final.stop_reason === "refusal")
    return {
      reply:
        "The advisor could not answer this question. Try rephrasing it as a question about your packaging operation.",
      sources: [],
    };
  const sources = new Map<string, string>();
  const text: string[] = [];
  for (const block of final.content) {
    if (block.type !== "text") continue;
    text.push(block.text);
    for (const c of block.citations ?? [])
      if (c.type === "web_search_result_location")
        sources.set(c.url, c.title ?? c.url);
  }
  const reply = text.join("").trim();
  return {
    reply:
      reply ||
      (final.stop_reason === "pause_turn" || final.stop_reason === "tool_use"
        ? "The advisor ran out of steps before finishing. Try a narrower question."
        : "The advisor returned no answer. Please try again."),
    sources: [...sources].map(([url, title]) => ({ url, title })),
  };
}

/** HTTP entry point shared by the Vercel function and tests. */
export async function handleAdvisorRequest(
  request: Request,
  options: { apiKey: string | undefined; client?: Anthropic },
): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "Use POST." });
  if (!options.apiKey && !options.client)
    return json(503, {
      error:
        "The AI advisor is not set up yet: the server has no ANTHROPIC_API_KEY.",
    });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "Invalid JSON." });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success)
    return json(400, {
      error: `Invalid request: ${parsed.error.issues[0]?.message ?? "unknown"}`,
    });
  const client = options.client ?? new Anthropic({ apiKey: options.apiKey });
  try {
    return json(200, await advise(client, parsed.data));
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      return json(502, {
        error: "The server's Anthropic API key was rejected.",
      });
    if (e instanceof Anthropic.RateLimitError)
      return json(429, {
        error: "The advisor is busy. Try again in a minute.",
      });
    if (e instanceof Anthropic.APIError)
      return json(502, {
        error: `The AI service failed (${e.status ?? "network"}).`,
      });
    return json(500, { error: "The advisor failed unexpectedly." });
  }
}
