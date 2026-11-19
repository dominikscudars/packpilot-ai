import {
  ApiError,
  GoogleGenAI,
  type Content,
  type FunctionDeclaration,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from "@google/genai";
import { z } from "zod";
import { calculatePackaging } from "../../backend/src/calculation-engine/packaging.js";
import { compareScenarios } from "../../backend/src/calculation-engine/comparison.js";
import {
  scenarioInputSchema,
  type ScenarioInput,
} from "../../backend/src/domain/scenario.js";
import { assumed } from "../../backend/src/domain/inputs.js";

/** Default Gemini model; override with the GEMINI_MODEL environment variable. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
/** Tried when the main model is unavailable; override with GEMINI_FALLBACK_MODEL. */
export const DEFAULT_FALLBACK_MODEL = "gemini-2.5-flash";
/** Whole-answer budget, kept below the Vercel function limit (120 s). */
const DEADLINE_MS = 90_000;
const MAX_TURNS = 12;
const MAX_CHARS = 2000;
const MAX_STEPS = 8;

const SYSTEM_PROMPT = `You are PackPilot AI's packaging advisor for small food manufacturers.
You help a manufacturer decide how to upgrade their packaging operation: pack sizes, materials, labour and machinery, especially as production grows.

Rules:
- Every cost, time or saving figure you state must come from the evaluate_scenario tool or from the current operation given to you. Never estimate PackPilot figures yourself.
- To test an idea, call evaluate_scenario with the change. Compare several options when the question allows, then recommend one.
- You have no internet access. For a machine or material price you don't have, test a clearly stated example value with evaluate_scenario, say it is an example, and tell the company to get a supplier quote.
- Inputs marked "assumption" or "missing" are uncertain; say when a recommendation depends on them and what the company should measure.
- Do not certify food-contact compliance, shelf life, recyclability or machine compatibility. Say these need supplier or lab confirmation.
- Write for a non-specialist owner. Lead with the recommendation, then the numbers behind it, then what to check next. Keep it under about 300 words. Use short paragraphs and simple "- " bullets; no tables, headings or bold markers.`;

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
type ParsedRequest = z.output<typeof requestSchema>;
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

const evaluateDeclaration: FunctionDeclaration = {
  name: "evaluate_scenario",
  description:
    "Run PackPilot's deterministic packaging cost engine on the company's current operation with the given changes applied, and compare it with the current operation. Omitted fields keep their current values. Use the formatId values from the current operation. Returns monthly packaging cost, cost per kg, cost per kg for each pack size, machine and person hours, utilisation, and savings or payback when comparable.",
  parametersJsonSchema: {
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
      },
      laborEuroPerPack: { type: "number" },
      laborEuroPerHour: {
        type: "number",
        description:
          "Switches labour to an hourly wage, so a faster machine lowers labour cost.",
      },
    },
    required: ["label"],
  },
};

/** The part of the Gemini client the advisor uses (injectable for tests). */
export interface GeminiModels {
  models: {
    generateContent(
      params: GenerateContentParameters,
    ): Promise<
      Pick<GenerateContentResponse, "candidates" | "functionCalls" | "text">
    >;
  };
}

function runTool(
  current: ScenarioInput,
  name: string | undefined,
  args: unknown,
): Record<string, unknown> {
  if (name !== "evaluate_scenario") return { error: `Unknown tool ${name}.` };
  const parsed = evaluationSchema.safeParse(args);
  if (!parsed.success)
    return {
      error: `Invalid input. ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    };
  try {
    return { output: evaluate(current, parsed.data) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/** Builds the answer: Gemini plus the deterministic engine as a tool. */
export async function advise(
  ai: GeminiModels,
  model: string,
  request: ParsedRequest,
  deadline = Date.now() + DEADLINE_MS,
): Promise<AdvisorReply> {
  const current = request.scenario;
  const contents: Content[] = request.messages.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      {
        text:
          i === 0
            ? `The company's current operation, as PackPilot JSON (inputs with provenance, and engine results):\n${inputContext(current)}\n\nQuestion: ${m.content}`
            : m.content,
      },
    ],
  }));
  for (let step = 0; step < MAX_STEPS; step++) {
    if (Date.now() > deadline)
      return {
        reply:
          "The advisor needed too long for this question. Try a narrower question.",
        sources: [],
      };
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations: [evaluateDeclaration] }],
        maxOutputTokens: 8192,
      },
    });
    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      const reply = (response.text ?? "").trim();
      return {
        reply: reply || "The advisor returned no answer. Please try again.",
        sources: [],
      };
    }
    // Send the model's turn back unchanged (it may carry thought signatures).
    const modelTurn = response.candidates?.[0]?.content ?? {
      role: "model",
      parts: calls.map((functionCall) => ({ functionCall })),
    };
    contents.push(modelTurn);
    contents.push({
      role: "user",
      parts: calls.map((call) => ({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: runTool(current, call.name, call.args),
        },
      })),
    });
  }
  return {
    reply:
      "The advisor ran out of steps before finishing. Try a narrower question.",
    sources: [],
  };
}

/** HTTP entry point shared by the Vercel function and tests. */
export async function handleAdvisorRequest(
  request: Request,
  options: {
    apiKey: string | undefined;
    model?: string;
    fallbackModel?: string;
    client?: GeminiModels;
  },
): Promise<Response> {
  if (request.method !== "POST") return json(405, { error: "Use POST." });
  if (!options.apiKey && !options.client)
    return json(503, {
      error:
        "The AI advisor is not set up yet: the server has no GEMINI_API_KEY.",
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
  const client =
    options.client ??
    new GoogleGenAI({
      apiKey: options.apiKey,
      httpOptions: {
        timeout: 45_000,
        retryOptions: { attempts: 3, initialDelay: 1, maxDelay: 4 },
      },
    });
  const models = [
    options.model || DEFAULT_GEMINI_MODEL,
    options.fallbackModel || DEFAULT_FALLBACK_MODEL,
  ].filter((m, i, all) => all.indexOf(m) === i);
  const deadline = Date.now() + DEADLINE_MS;
  let lastError: unknown;
  for (const model of models) {
    try {
      return json(200, await advise(client, model, parsed.data, deadline));
    } catch (e) {
      lastError = e;
      // Try the backup model only when the main one is missing or overloaded.
      if (!(e instanceof ApiError) || ![404, 429, 500, 503].includes(e.status))
        break;
    }
  }
  return errorResponse(lastError);
}

/** Maps Gemini failures to a clear message; never includes the API key. */
function errorResponse(e: unknown): Response {
  if (!(e instanceof ApiError))
    return json(500, { error: "The advisor failed unexpectedly." });
  const detail = e.message.replace(/\s+/g, " ").slice(0, 300);
  if (e.status === 401 || e.status === 403 || /api key/i.test(e.message))
    return json(502, { error: "The server's Gemini API key was rejected." });
  if (e.status === 404)
    return json(502, {
      error: `The Gemini model was not found; check GEMINI_MODEL. (${detail})`,
    });
  if (e.status === 429)
    return json(429, {
      error: `Gemini quota or rate limit reached. Try again later. (${detail})`,
    });
  return json(502, {
    error: `Gemini is unavailable right now (${e.status}). Try again in a minute. (${detail})`,
  });
}
