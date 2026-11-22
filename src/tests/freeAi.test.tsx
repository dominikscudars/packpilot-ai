import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { createDemoScenario } from "../../backend/src/domain/demo";
import {
  backupModels,
  handleAdvisorRequest,
  resetBackupModels,
  type GeminiModels,
} from "../advisor/server";
import { quickAnswer } from "../advisor/quickAnswer";
import { enterReferenceData, navLink } from "./journey";

const request = () =>
  new Request("http://x/api/advisor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scenario: createDemoScenario(),
      messages: [{ role: "user", content: "How could we cut costs?" }],
    }),
  });
async function* listing(names: string[]) {
  for (const name of names)
    yield { name: `models/${name}`, supportedActions: ["generateContent"] };
}
const busy = () =>
  new ApiError({
    message: "This model is currently experiencing high demand.",
    status: 503,
  });

beforeEach(() => resetBackupModels());

describe("free backup models", () => {
  it("picks Flash models from the key's own list, lightest first", async () => {
    const ai: GeminiModels = {
      models: {
        generateContent: vi.fn(),
        list: async () =>
          listing([
            "gemini-9.1-pro",
            "gemini-9.1-flash",
            "gemini-9.1-flash-image",
            "gemini-9.0-flash-lite",
            "gemini-9.2-flash-preview",
            "text-embedding-9",
          ]),
      },
    };
    expect(await backupModels(ai, ["gemini-9.1-flash"])).toEqual([
      "gemini-9.0-flash-lite",
      "gemini-9.2-flash-preview",
    ]);
  });

  it("answers from a backup model when the main one is overloaded", async () => {
    const generateContent = vi.fn(async ({ model }: { model: string }) => {
      if (model === "main-flash") throw busy();
      return { text: `Answer from ${model}` };
    });
    const r = await handleAdvisorRequest(request(), {
      apiKey: undefined,
      model: "main-flash",
      client: {
        models: {
          generateContent:
            generateContent as unknown as GeminiModels["models"]["generateContent"],
          list: async () => listing(["main-flash", "backup-flash-lite"]),
        },
      },
    });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.reply).toBe("Answer from backup-flash-lite");
    expect(body.basis.model).toBe("backup-flash-lite");
  });

  it("still reports the main model's error when every model is busy", async () => {
    const r = await handleAdvisorRequest(request(), {
      apiKey: undefined,
      model: "main-flash",
      client: {
        models: {
          generateContent: vi.fn(async () => {
            throw busy();
          }),
          list: async () => listing(["main-flash", "other-flash"]),
        },
      },
    });
    expect(r.status).toBe(502);
    expect((await r.json()).code).toBe("unavailable");
  });
});

describe("quick answer from the company's numbers", () => {
  it("lists the calculated savings without any AI service", () => {
    const text = quickAnswer(createDemoScenario())!;
    expect(text).toContain("## Recommendation");
    expect(text).toContain("about €33.00 a month on your €286.00");
    expect(text).toContain("## Next steps");
  });

  it("answers in the page when live research is busy, and keeps it out of the chat", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: "overloaded", code: "unavailable" }),
          {
            status: 502,
            headers: { "content-type": "application/json" },
          },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <App
            services={{
              auth: null,
              apiUrl: "http://localhost:3001",
              error: null,
            }}
          />
        </MemoryRouter>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Open local demo" }));
      await enterReferenceData();
      fireEvent.click(navLink(/Market research/));
      fireEvent.click(
        await screen.findByRole("button", {
          name: "How could we reduce our packaging costs?",
        }),
      );
      expect(await screen.findByTestId("quick-answer")).toBeInTheDocument();
      expect(screen.getByTestId("advisor-assistant")).toHaveTextContent(
        "about €33.00 a month",
      );
      // The calculated answer is not sent back as if the AI had written it.
      fireEvent.change(screen.getByLabelText("Your question"), {
        target: { value: "And materials?" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Ask the advisor" }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      const sent = JSON.parse(
        String(
          (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body,
        ),
      );
      expect(sent.messages.map((m: { role: string }) => m.role)).toEqual([
        "user",
        "user",
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
