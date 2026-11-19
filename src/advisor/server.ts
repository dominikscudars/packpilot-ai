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
/** Whole-answer budget, kept below the Vercel function limit (300 s). */
const DEADLINE_MS = 240_000;
const MAX_TURNS = 12;
const MAX_CHARS = 2000;
const MAX_STEPS = 12;
/** Web research calls allowed per question (each runs one Google-grounded request). */
const MAX_RESEARCH = 3;

const SYSTEM_PROMPT = `You are PackPilot AI's packaging research analyst for small and medium food manufacturers, mainly in Latvia and the EU.
You do practical market research and recommend how a manufacturer should upgrade its packaging: machinery, materials, pack formats, processes, suppliers and regulatory readiness.

How to work:
1. Read the company's current operation and its current costs (given as PackPilot JSON): monthly packaging cost, cost per kg and cost per kg for each pack size. Always measure options against these current costs, in euro per month and per kg.
2. Research before you answer. Call research_web for anything about laws and deadlines, machine models and prices, packaging materials, suppliers, recycling and market trends. Run several focused searches (one topic each), for example "EU PPWR recyclability requirements for food packaging 2030", "double chamber vacuum packaging machine price Europe", "mono-material PE vacuum pouch shelf life fresh tofu".
3. Test options with evaluate_scenario: every cost, time, capacity or saving figure about this company must come from it. When research gives a machine's speed or price, feed it in as an assumption and say so.
4. Recommend. Compare at least two or three concrete options where the question allows, and say which you recommend now and which later as production grows.

Rules:
- Facts from research must be cited; never invent prices, model names, laws or dates. If research finds nothing reliable, say so.
- Prices found online are indicative: give currency, source and that a supplier quote is needed.
- Do not certify food-contact compliance, shelf life, recyclability or machine compatibility; say what test, declaration or supplier confirmation is needed.
- Inputs marked "assumption" or "missing" are uncertain; say when a recommendation depends on them.
- If customer survey results are attached, use them: which pack sizes and prices customers prefer, what they value, and what that means for the product range and savings. Say how many responses there were and that a small, self-selected sample is indicative only.

Background you can build on (verify details with research_web before relying on them):
- EU Packaging and Packaging Waste Regulation (EU) 2025/40 (PPWR) applies in general from 12 August 2026. It phases in requirements such as recyclable-by-design packaging from 2030, restrictions on PFAS in food-contact packaging, packaging minimisation and harmonised labelling.
- Food-contact materials: Regulation (EC) No 1935/2004 (framework), Regulation (EU) No 10/2011 (plastics, with a supplier declaration of compliance) and Regulation (EC) No 2023/2006 (good manufacturing practice).
- Food information to consumers: Regulation (EU) No 1169/2011 (labelling, allergens, nutrition). In Latvia, labels must be in Latvian; food businesses are registered with and supervised by PVD (Pārtikas un veterinārais dienests).
- Latvia also has a natural resources tax on packaging and producer-responsibility schemes for packaging waste.
- Typical options for vacuum-packed fresh foods: single- and double-chamber vacuum machines, belt chamber machines, thermoforming lines and tray sealers (vacuum skin or modified atmosphere). Materials range from PA/PE multilayer pouches to mono-material PE or PP barrier films marketed as recyclable.

Write for a non-specialist owner, in English, as a short research report:
## Recommendation (two or three sentences)
## Options compared (each option: what it is, indicative price with source, effect on cost and capacity from evaluate_scenario)
## Regulations to prepare for (only those relevant to the question)
## Next steps (concrete actions, such as which quotes or tests to request)
Use "- " bullets and **bold** sparingly. No tables. Keep it under about 700 words.`;

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

const MAX_CONTEXT = 8000;
const requestSchema = z.object({
  scenario: scenarioInputSchema,
  /** Optional customer survey summary prepared by PackPilot in the browser. */
  context: z.string().max(MAX_CONTEXT).optional(),
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

const researchDeclaration: FunctionDeclaration = {
  name: "research_web",
  description:
    "Search the web with Google for current facts: EU and Latvian packaging and food laws, packaging machines (models, speeds, prices), packaging materials and their shelf-life and recyclability, suppliers, and market trends. Ask one focused question per call. Returns findings with source links.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "One focused research question, e.g. 'double chamber vacuum packaging machine price Europe 2026'.",
      },
    },
    required: ["query"],
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

type Source = AdvisorReply["sources"][number];

/** One Google-grounded research request; returns findings and their sources. */
async function research(
  ai: GeminiModels,
  model: string,
  query: string,
): Promise<{ findings: string; sources: Source[] }> {
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Research this for a small food manufacturer in Latvia (EU): ${query}\n\nReport concrete, current facts: names, models, regulation numbers and dates, and prices with currency and date. Say clearly when something could not be confirmed. Under 250 words.`,
          },
        ],
      },
    ],
    config: { tools: [{ googleSearch: {} }], maxOutputTokens: 2048 },
  });
  const chunks =
    response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const sources: Source[] = [];
  for (const chunk of chunks) {
    const uri = chunk.web?.uri;
    if (uri) sources.push({ url: uri, title: chunk.web?.title || uri });
  }
  return { findings: (response.text ?? "").trim(), sources };
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function runEvaluation(
  current: ScenarioInput,
  args: unknown,
): Record<string, unknown> {
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
    return { error: errorText(e) };
  }
}

/** Builds the answer: Gemini with web research and the deterministic engine. */
export async function advise(
  ai: GeminiModels,
  model: string,
  request: ParsedRequest,
  deadline = Date.now() + DEADLINE_MS,
): Promise<AdvisorReply> {
  const current = request.scenario;
  const sources = new Map<string, Source>();
  let researchCalls = 0;
  const contents: Content[] = request.messages.map((m, i) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [
      {
        text:
          i === 0
            ? `The company's current operation, as PackPilot JSON (inputs with provenance, and engine results):\n${inputContext(current)}\n\n${request.context ? `Customer survey results (tabulated by PackPilot from the company's own survey):\n${request.context}\n\n` : ""}Question: ${m.content}`
            : m.content,
      },
    ],
  }));
  const reply = (text: string): AdvisorReply => ({
    reply: text,
    sources: [...sources.values()].slice(0, 12),
  });
  for (let step = 0; step < MAX_STEPS; step++) {
    if (Date.now() > deadline)
      return reply(
        "The research took too long for this question. Try a narrower question.",
      );
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [
          { functionDeclarations: [evaluateDeclaration, researchDeclaration] },
        ],
        maxOutputTokens: 8192,
      },
    });
    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      const text = (response.text ?? "").trim();
      return reply(text || "The advisor returned no answer. Please try again.");
    }
    // Send the model's turn back unchanged (it may carry thought signatures).
    contents.push(
      response.candidates?.[0]?.content ?? {
        role: "model",
        parts: calls.map((functionCall) => ({ functionCall })),
      },
    );
    const results = await Promise.all(
      calls.map(async (call): Promise<Record<string, unknown>> => {
        if (call.name === "evaluate_scenario")
          return runEvaluation(current, call.args);
        if (call.name !== "research_web")
          return { error: `Unknown tool ${call.name}.` };
        const query = call.args?.query;
        if (typeof query !== "string" || !query.trim())
          return { error: "Give a research question in 'query'." };
        if (++researchCalls > MAX_RESEARCH)
          return {
            error:
              "Research limit reached for this question. Answer with what you have.",
          };
        try {
          const found = await research(ai, model, query.slice(0, 300));
          for (const s of found.sources) sources.set(s.url, s);
          return {
            output: {
              findings: found.findings || "No findings.",
              sources: found.sources,
            },
          };
        } catch (e) {
          return { error: `Research failed: ${errorText(e)}` };
        }
      }),
    );
    contents.push({
      role: "user",
      parts: calls.map((call, i) => ({
        functionResponse: {
          id: call.id,
          name: call.name,
          response: results[i],
        },
      })),
    });
  }
  return reply(
    "The advisor ran out of steps before finishing. Try a narrower question.",
  );
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
        timeout: 60_000,
        // Retry brief outages only: a 429 means the (free-tier) quota is
        // used up, and retrying would just spend more of it.
        retryOptions: {
          attempts: 3,
          initialDelay: 1,
          maxDelay: 4,
          httpStatusCodes: [500, 502, 503, 504],
        },
      },
    });
  // A backup model is tried only when GEMINI_FALLBACK_MODEL is set.
  const models = [options.model || DEFAULT_GEMINI_MODEL, options.fallbackModel]
    .filter((m): m is string => Boolean(m))
    .filter((m, i, all) => all.indexOf(m) === i);
  const deadline = Date.now() + DEADLINE_MS;
  let firstError: unknown;
  for (const model of models) {
    try {
      return json(200, await advise(client, model, parsed.data, deadline));
    } catch (e) {
      firstError ??= e;
      // Try the backup model only when the main one is missing or overloaded.
      if (!(e instanceof ApiError) || ![404, 429, 500, 503].includes(e.status))
        break;
    }
  }
  // Report the main model's failure: it is the one to fix.
  return errorResponse(firstError);
}

/** Maps Gemini failures to a clear message; never includes the API key. */
function errorResponse(e: unknown): Response {
  if (!(e instanceof ApiError))
    return json(500, { error: "The advisor failed unexpectedly." });
  const detail = e.message.replace(/\s+/g, " ").slice(0, 600);
  if (e.status === 401 || e.status === 403 || /api key/i.test(e.message))
    return json(502, { error: "The server's Gemini API key was rejected." });
  if (e.status === 404)
    return json(502, {
      error: `The Gemini model was not found; check GEMINI_MODEL. (${detail})`,
    });
  if (e.status === 429)
    return json(429, {
      error: `Gemini's free-tier limit was reached. Wait a minute and try again; if it persists, the daily limit is used up. (${detail})`,
    });
  return json(502, {
    error: `Gemini is unavailable right now (${e.status}). Try again in a minute. (${detail})`,
  });
}
