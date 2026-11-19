import { describe, expect, it, vi } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { createDemoScenario } from "../../backend/src/domain/demo";
import {
  ADVISOR_MODEL,
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
    expect((await r.json()).error).toMatch(/ANTHROPIC_API_KEY/);
  });
  it("validates the conversation", async () => {
    const r = await handleAdvisorRequest(
      post({ scenario: createDemoScenario(), messages: [] }),
      { apiKey: "test" },
    );
    expect(r.status).toBe(400);
  });
  it("lets Claude call the engine tool and returns its answer with sources", async () => {
    let toolOutput = "";
    let params: Record<string, unknown> = {};
    const toolRunner = vi.fn(async (p: Record<string, unknown>) => {
      params = p;
      const tools = p.tools as {
        name: string;
        run?: (a: unknown) => unknown;
      }[];
      const tool = tools.find((t) => t.name === "evaluate_scenario");
      toolOutput = String(
        await tool?.run?.({ label: "Faster", machine: { packsPerCycle: 4 } }),
      );
      return {
        stop_reason: "end_turn",
        content: [
          {
            type: "text",
            text: "Buy the bigger chamber.",
            citations: [
              {
                type: "web_search_result_location",
                url: "https://example.com/m",
                title: "Machine page",
              },
            ],
          },
        ],
      };
    });
    const client = {
      beta: { messages: { toolRunner } },
    } as unknown as Anthropic;
    const r = await handleAdvisorRequest(post(ask()), {
      apiKey: undefined,
      client,
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      reply: "Buy the bigger chamber.",
      sources: [{ url: "https://example.com/m", title: "Machine page" }],
    });
    expect(JSON.parse(toolOutput).alternative.totalPackages).toBe(1300);
    expect(params.model).toBe(ADVISOR_MODEL);
    expect(params.fallbacks).toBe("default");
    expect(JSON.stringify(params.messages)).toContain("og-format-1kg");
  });
});
