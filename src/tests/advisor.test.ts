import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";
import { createDemoScenario } from "../../backend/src/domain/demo";
import {
  DEFAULT_GEMINI_MODEL,
  type GeminiModels,
  applyEvaluation,
  evaluate,
  handleAdvisorRequest,
} from "../advisor/server";

const post = (body: unknown) =>
  new Request("http://localhost/api/advisor", {
    method: "POST",
    body: JSON.stringify(body),
  });
const ask = (content = "Should we buy a faster machine?") => ({
  scenario: createDemoScenario(),
  messages: [{ role: "user", content }],
});

describe("advisor what-ifs use the deterministic engine", () => {
  it("halves machine hours when twice as many packs fit per cycle", () => {
    const result = evaluate(createDemoScenario(), {
      label: "Bigger chamber",
      machine: { packsPerCycle: 4 },
      laborEuroPerHour: 18,
    });
    expect(Number(result.alternative.machineHours)).toBeCloseTo(
      (1300 * 70) / 4 / 3600,
      10,
    );
    // 6.3194 h × €18 + €91 material = €204.75; current is €286.
    expect(Number(result.alternative.packagingCostEuroPerMonth)).toBeCloseTo(
      204.75,
      10,
    );
    // Same demand, so the comparison is valid; payback needs an investment.
    expect(result.comparedWithCurrent.savingsComparable).toBe(true);
    expect(result.comparedWithCurrent.simplePaybackMonths).toBeNull();
  });
  it("labels every changed input as an unverified advisor assumption", () => {
    const next = applyEvaluation(createDemoScenario(), {
      label: "10 t",
      monthlyProductionKg: 10000,
    });
    expect(next.monthlyProductionKg).toMatchObject({
      value: "10000",
      quality: "assumption",
    });
    expect(next.monthlyProductionKg.sourceNote).toContain("10 t");
  });
  it("rejects unknown pack sizes instead of guessing", () => {
    expect(() =>
      applyEvaluation(createDemoScenario(), {
        label: "x",
        formats: [{ formatId: "nope", sharePercent: 50 }],
      }),
    ).toThrow(/Unknown formatId/);
  });
});

describe("advisor HTTP handler", () => {
  it("explains a missing API key instead of failing silently", async () => {
    const r = await handleAdvisorRequest(post(ask()), { apiKey: undefined });
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatch(/GEMINI_API_KEY/);
  });
  it("validates the conversation", async () => {
    const r = await handleAdvisorRequest(
      post({ scenario: createDemoScenario(), messages: [] }),
      { apiKey: "test" },
    );
    expect(r.status).toBe(400);
  });
  it("lets Gemini call the engine tool and returns its final answer", async () => {
    const generateContent = vi.fn();
    generateContent
      .mockResolvedValueOnce({
        functionCalls: [
          {
            id: "c1",
            name: "evaluate_scenario",
            args: { label: "Faster", machine: { packsPerCycle: 4 } },
          },
        ],
        candidates: [
          {
            content: {
              role: "model",
              parts: [
                {
                  functionCall: {
                    id: "c1",
                    name: "evaluate_scenario",
                    args: { label: "Faster", machine: { packsPerCycle: 4 } },
                  },
                  thoughtSignature: "sig",
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({ text: "Buy the bigger chamber." });
    const client: GeminiModels = { models: { generateContent } };
    const r = await handleAdvisorRequest(post(ask()), {
      apiKey: undefined,
      client,
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      reply: "Buy the bigger chamber.",
      sources: [],
    });
    const first = generateContent.mock.calls[0][0];
    expect(first.model).toBe(DEFAULT_GEMINI_MODEL);
    expect(JSON.stringify(first.contents)).toContain("og-format-1kg");
    const second = generateContent.mock.calls[1][0];
    // The model turn is sent back unchanged, including its thought signature.
    expect(second.contents[1].parts[0].thoughtSignature).toBe("sig");
    const result = second.contents[2].parts[0].functionResponse;
    expect(result).toMatchObject({ id: "c1", name: "evaluate_scenario" });
    expect(result.response.output.alternative.totalPackages).toBe(1300);
  });
  it("returns tool errors to the model instead of crashing", async () => {
    const generateContent = vi
      .fn()
      .mockResolvedValueOnce({
        functionCalls: [
          {
            name: "evaluate_scenario",
            args: {
              label: "Bad",
              formats: [{ formatId: "nope", sharePercent: 1 }],
            },
          },
        ],
      })
      .mockResolvedValueOnce({ text: "That pack size does not exist." });
    const r = await handleAdvisorRequest(post(ask()), {
      apiKey: undefined,
      client: { models: { generateContent } },
    });
    expect(r.status).toBe(200);
    const response =
      generateContent.mock.calls[1][0].contents[2].parts[0].functionResponse
        .response;
    expect(response.error).toMatch(/Unknown formatId/);
  });
  it("falls back to the backup model when the main one is overloaded", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ message: "The model is overloaded.", status: 503 }),
      )
      .mockResolvedValueOnce({ text: "Answer from the backup model." });
    const r = await handleAdvisorRequest(post(ask()), {
      apiKey: undefined,
      fallbackModel: "backup-model",
      client: { models: { generateContent } },
    });
    expect((await r.json()).reply).toBe("Answer from the backup model.");
    expect(generateContent.mock.calls.map((c) => c[0].model)).toEqual([
      DEFAULT_GEMINI_MODEL,
      "backup-model",
    ]);
  });
  it("shows Gemini's own error message when every model fails", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ message: "The model is overloaded.", status: 503 }),
      );
    const r = await handleAdvisorRequest(post(ask()), {
      apiKey: undefined,
      client: { models: { generateContent } },
    });
    expect(r.status).toBe(502);
    expect((await r.json()).error).toMatch(/unavailable.*overloaded/);
  });
  it("does not retry another model when the key is rejected", async () => {
    const generateContent = vi
      .fn()
      .mockRejectedValue(
        new ApiError({ message: "API key not valid.", status: 400 }),
      );
    const r = await handleAdvisorRequest(post(ask()), {
      apiKey: undefined,
      client: { models: { generateContent } },
    });
    expect((await r.json()).error).toMatch(/key was rejected/);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
