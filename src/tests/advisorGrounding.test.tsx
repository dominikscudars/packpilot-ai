import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import App from "../App";
import { scopeKey } from "../setup/setupState";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PieChart: () => <div />,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
}));
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

const SCOPE = scopeKey("demo", null, "og-tofu");
const survey = (responses: number) =>
  JSON.stringify({ responses, text: `Survey: ${responses} responses` });
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const basis = {
  snapshotId: "abcd1234",
  model: "test-model",
  generatedAt: "2026-11-19T12:00:00Z",
  surveyAttached: true,
  researchCalls: 2,
  engineCalls: 3,
};

async function openAdvisor() {
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App
        services={{ auth: null, apiUrl: "http://localhost:3001", error: null }}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open local demo" }));
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Fill everything with OG TOFU data",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "View packaging insights" }),
  );
  await screen.findByRole("heading", { name: "Packaging Insights" });
  fireEvent.click(screen.getAllByRole("link", { name: /Market research/ })[0]);
  await screen.findByRole("heading", { name: "Market research" });
}
const askQuestion = (text: string) => {
  fireEvent.change(screen.getByLabelText("Your question"), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ask the advisor" }));
};

describe("advisor grounding in the browser", () => {
  it("uses only the active workspace's survey", async () => {
    sessionStorage.setItem("packpilot.survey.v1", survey(9)); // old, unscoped
    sessionStorage.setItem(
      "packpilot.survey.v1:" + scopeKey("demo", null, "other"),
      survey(7),
    );
    await openAdvisor();
    expect(screen.queryByTestId("survey-attached")).toBeNull();
  });

  it("shows what each answer was based on", async () => {
    sessionStorage.setItem("packpilot.survey.v1:" + SCOPE, survey(5));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reply({
          reply: "Get two quotes.",
          sources: [{ url: "https://example.com/a", title: "A" }],
          basis,
        }),
      ),
    );
    await openAdvisor();
    askQuestion("Which film?");
    const used = await screen.findByTestId("answer-basis");
    expect(used).toHaveTextContent("snapshot abcd1234, with customer survey");
    expect(used).toHaveTextContent("3 PackPilot calculations");
    expect(used).toHaveTextContent("2 web searches");
    expect(screen.getByText(/Sources \(external, unverified\)/)).toBeVisible();
  });

  it("clears the conversation when the attached survey changes", async () => {
    sessionStorage.setItem("packpilot.survey.v1:" + SCOPE, survey(5));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => reply({ reply: "Offer 250 g.", sources: [], basis })),
    );
    await openAdvisor();
    askQuestion("Which sizes?");
    await screen.findByText("Offer 250 g.");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByTestId("conversation-reset")).toBeInTheDocument();
    expect(screen.queryByText("Offer 250 g.")).toBeNull();
  });

  it("can cancel a running question and keeps the draft", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_, reject) => {
            signal = init.signal ?? undefined;
            signal?.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    await openAdvisor();
    askQuestion("Long question");
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Question cancelled",
    );
    expect(signal?.aborted).toBe(true);
    expect(screen.getByLabelText("Your question")).toHaveValue("Long question");
  });

  it("explains a used-up quota without a fixed count and keeps prepared answers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        reply({ error: "RESOURCE_EXHAUSTED", code: "quota" }, 429),
      ),
    );
    await openAdvisor();
    expect(screen.queryByText(/questions a day/)).toBeNull();
    askQuestion("Anything");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The free AI quota is used up for now. Prepared answers below still work",
    );
    expect(
      screen.getByRole("button", {
        name: /Which EU and Latvian packaging rules affect us/,
      }),
    ).toBeEnabled();
  });
});
