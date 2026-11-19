import { beforeEach, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { StrictMode, type ReactNode } from "react";
import App from "../App";
import type { AppServices } from "../components/AuthGate";
import { authFixture, apiFixture, json } from "./integrationFixture";
import { DEMO_KEY } from "../demo/apiDemo";
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => (
    <div>{children}</div>
  ),
  PieChart: () => <div />,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
}));
beforeEach(() => localStorage.clear());
const demoConfig = { auth: null, apiUrl: "http://localhost:3001", error: null };
function mount(path = "/", services: AppServices = demoConfig) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <App services={services} />
      </MemoryRouter>
    </StrictMode>,
  );
}
/** Step 1: fill every field with OG TOFU's data and save (lands on step 2). */
async function enterOgData() {
  if (!screen.queryByRole("heading", { name: "Enter your data" }))
    fireEvent.click(
      await screen.findByRole("link", { name: /Enter your data/ }),
    );
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Fill everything with OG TOFU data",
    }),
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Save and see my costs →" }),
  );
  await screen.findByRole("heading", { name: "Your costs" });
}
async function openDemo(path = "/") {
  const view = mount(path);
  fireEvent.click(screen.getByRole("button", { name: "Open local demo" }));
  await screen.findByLabelText("Active company");
  if (path === "/") {
    // A fresh demo starts at step 1; a saved one opens on step 2.
    const heading = await screen.findByRole("heading", {
      name: /Enter your data|Your costs/,
    });
    if (heading.textContent === "Enter your data") await enterOgData();
  }
  return view;
}
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
it("points visitors to the local demo when sign-in is not configured", () => {
  mount();
  expect(
    screen.getByText(/Company accounts are not enabled on this demo site yet/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/environment variables/)).toBeNull();
  expect(
    screen.getByRole("button", { name: "Open local demo" }),
  ).toBeInTheDocument();
});
it("requires explicit demo entry, preserves exact reference results and persists only explicit saves", async () => {
  const view = await openDemo();
  expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
    "€286.00",
  );
  expect(screen.getByTestId("cost-per-kg")).toHaveTextContent("€0.286");
  expect(screen.getByTestId("total-packages")).toHaveTextContent("1,300");
  for (const [format, count, total, perKg] of [
    ["1000 g", "800", "€176.00", "€0.220"],
    ["500 g", "300", "€66.00", "€0.440"],
    ["250 g", "200", "€44.00", "€0.880"],
  ]) {
    const row = screen.getByRole("rowheader", { name: format }).closest("tr");
    if (!row) throw new Error("Packaging row missing");
    const cells = within(row).getAllByRole("cell");
    expect(cells[2].textContent).toBe(count);
    expect(cells[3].textContent).toBe(perKg);
    expect(cells[6].textContent).toBe(total);
  }
  change("Monthly production (kg)", "2000");
  expect(screen.queryByTestId("operating-cost")).toBeNull();
  await waitFor(() =>
    expect(screen.getByTestId("operating-cost")).toHaveTextContent("€572.00"),
  );
  // The 2000 kg edit is not stored until it is saved explicitly.
  expect(localStorage.getItem(DEMO_KEY) ?? "").not.toContain('"2000"');
  fireEvent.click(screen.getByRole("button", { name: "Save scenario" }));
  await screen.findByText("Scenario saved in this browser.");
  view.unmount();
  await openDemo();
  expect(await screen.findByLabelText("Monthly production (kg)")).toHaveValue(
    "2000",
  );
  expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
    "€572.00",
  );
});
/** Incomplete input shows the calm setup card, never the red error alert. */
async function expectGuidance(text: RegExp) {
  await waitFor(() =>
    expect(screen.getByText(/setup guidance/i).parentElement).toHaveTextContent(
      text,
    ),
  );
  expect(screen.queryByRole("alert")).toBeNull();
}
it("hides old results immediately when production becomes missing or invalid", async () => {
  await openDemo();
  await screen.findByTestId("operating-cost");
  change("Monthly production (kg)", "");
  expect(screen.queryByTestId("operating-cost")).toBeNull();
  await expectGuidance(/add monthly production.*see your results/i);
  change("Monthly production (kg)", "-1");
  await expectGuidance(/non-negative/);
});
it("saves company and product changes explicitly", async () => {
  await openDemo("/company");
  await screen.findByLabelText("Company name");
  change("Company name", "Edited pilot");
  expect(localStorage.getItem(DEMO_KEY)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save company profile" }));
  await screen.findByText("Company profile saved.");
  expect(JSON.parse(localStorage.getItem(DEMO_KEY)!).company.name).toBe(
    "Edited pilot",
  );
  change("Product name", "Edited tofu");
  fireEvent.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText("Product saved.");
  expect(
    JSON.parse(localStorage.getItem(DEMO_KEY)!).catalog.products[0].name,
  ).toBe("Edited tofu");
});
it("signs in, uses bearer tokens and API results, and never uploads legacy browser profiles", async () => {
  localStorage.setItem(
    "packpilot.workspace.v1",
    JSON.stringify({ privateProfile: "DO NOT UPLOAD" }),
  );
  const { auth } = authFixture(null),
    { fetcher } = apiFixture();
  const normal = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) => {
    const response = await normal(url, init);
    if (String(url).includes("packaging-costs")) {
      const body = await response.json();
      body.data.totalPackagingOperatingEuro = "123.45";
      return json(body.data);
    }
    return response;
  });
  mount("/", { auth, apiUrl: "http://localhost:3001", error: null, fetcher });
  await screen.findByLabelText("Email");
  change("Email", "pilot@example.test");
  change("Password", "test-only-password");
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
    "€123.45",
  );
  expect(auth.signIn).toHaveBeenCalledWith(
    "pilot@example.test",
    "test-only-password",
  );
  expect(
    fetcher.mock.calls.every(
      ([, init]) =>
        new Headers(init?.headers).get("Authorization") ===
        "Bearer signed-in-token",
    ),
  ).toBe(true);
  expect(
    fetcher.mock.calls.some(
      ([url, init]) =>
        String(url).includes("/companies") && init?.method !== "GET",
    ),
  ).toBe(false);
  expect(JSON.stringify(fetcher.mock.calls)).not.toContain("DO NOT UPLOAD");
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("button", { name: "Sign in" });
  expect(screen.queryByLabelText("Active company")).toBeNull();
});
it("loads profiles and saves scenarios through company-scoped endpoints", async () => {
  const { auth } = authFixture(),
    { fetcher } = apiFixture();
  mount("/company", {
    auth,
    apiUrl: "http://localhost:3001",
    error: null,
    fetcher,
  });
  await screen.findByLabelText("Company name");
  change("Company name", "API company");
  fireEvent.click(screen.getByRole("button", { name: "Save company profile" }));
  await screen.findByText("Company profile saved.");
  expect(
    fetcher.mock.calls.some(
      ([url, init]) =>
        String(url).endsWith("/companies/og-tofu") &&
        init?.method === "PATCH" &&
        String(init.body).includes("API company"),
    ),
  ).toBe(true);
  fireEvent.click(screen.getByRole("link", { name: /Your costs/ }));
  await screen.findByLabelText("Monthly production (kg)");
  change("Monthly production (kg)", "2000");
  fireEvent.click(screen.getByRole("button", { name: "Save as new scenario" }));
  await screen.findByText("Scenario saved to your company.");
  expect(
    fetcher.mock.calls.some(
      ([url, init]) =>
        String(url).endsWith("/companies/og-tofu/scenarios") &&
        init?.method === "POST" &&
        String(init.body).includes("2000"),
    ),
  ).toBe(true);
  expect(localStorage.getItem(DEMO_KEY)).toBeNull();
});
it("shows empty company access without silently switching to demo", async () => {
  const { auth } = authFixture();
  mount("/", {
    auth,
    apiUrl: "http://localhost:3001",
    error: null,
    fetcher: vi.fn(async () => json([])),
  });
  await screen.findByText("No companies yet");
  expect(screen.queryByText("OG TOFU")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Create company" }),
  ).toBeInTheDocument();
});
it("shows load failures with retry and does not substitute demo data", async () => {
  const { auth } = authFixture();
  const fetcher = vi.fn(async () => json("API unavailable", 503));
  mount("/", { auth, apiUrl: "http://localhost:3001", error: null, fetcher });
  expect(await screen.findByRole("alert")).toHaveTextContent("API unavailable");
  expect(screen.queryByText("OG TOFU")).toBeNull();
  fetcher.mockImplementation(async () => json([]));
  fireEvent.click(screen.getByRole("button", { name: "Retry companies" }));
  await screen.findByText("No companies yet");
});
it("clears data on rejected refresh and keeps an expired session signed out", async () => {
  const { auth, emit } = authFixture(),
    { fetcher } = apiFixture();
  mount("/", { auth, apiUrl: "http://localhost:3001", error: null, fetcher });
  await screen.findByTestId("operating-cost");
  fetcher.mockImplementation(async () => json("Expired", 401));
  vi.mocked(auth.refresh).mockResolvedValue(null);
  change("Monthly production (kg)", "2000");
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Your session expired",
  );
  expect(screen.queryByLabelText("Active company")).toBeNull();
  act(() => emit({ userId: "user-a", accessToken: "late-refresh" }));
  expect(screen.queryByLabelText("Active company")).toBeNull();
});
it("discards late company responses when switching between accessible companies", async () => {
  const { auth } = authFixture(),
    { fetcher, demo } = apiFixture();
  const normal = fetcher.getMockImplementation()!;
  const companies = await demo.companies();
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  fetcher.mockImplementation(async (url, init) => {
    if (new URL(String(url)).pathname.endsWith("/companies"))
      return json([
        ...companies,
        { ...companies[0], id: "second", name: "Second company" },
      ]);
    if (String(url).includes("/companies/og-tofu/")) {
      await delayed;
      return normal(url, init);
    }
    if (String(url).includes("/companies/second/")) return json([]);
    return normal(url, init);
  });
  mount("/company", {
    auth,
    apiUrl: "http://localhost:3001",
    error: null,
    fetcher,
  });
  await screen.findByLabelText("Active company");
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes("/og-tofu/products"),
      ),
    ).toBe(true),
  );
  await userEvent.selectOptions(
    screen.getByLabelText("Active company"),
    "second",
  );
  expect(await screen.findByLabelText("Company name")).toHaveValue(
    "Second company",
  );
  await act(async () => {
    release();
    await delayed;
  });
  expect(screen.getByLabelText("Company name")).toHaveValue("Second company");
  expect(screen.queryByLabelText("Product name")).toBeNull();
});
it("prevents members editing owner-only company metadata", async () => {
  const { auth } = authFixture(),
    { fetcher, demo } = apiFixture();
  const normal = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) =>
    new URL(String(url)).pathname.endsWith("/companies")
      ? json(
          (await demo.companies()).map((c) => ({
            ...c,
            membershipRole: "member",
          })),
        )
      : normal(url, init),
  );
  mount("/company", {
    auth,
    apiUrl: "http://localhost:3001",
    error: null,
    fetcher,
  });
  expect(await screen.findByLabelText("Company name")).toBeDisabled();
  expect(screen.getByLabelText("Product name")).toBeEnabled();
});
it("shows a storage warning but keeps the explicit demo usable when storage is blocked", async () => {
  const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Blocked");
  });
  try {
    await openDemo();
    expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
      "€286.00",
    );
    expect(
      screen.getByText(/Saved demo could not be read/),
    ).toBeInTheDocument();
  } finally {
    spy.mockRestore();
  }
});
it("ignores a late authentication failure from a previous account", async () => {
  const { auth, emit } = authFixture();
  let release!: (value: Response) => void;
  const old = new Promise<Response>((resolve) => {
    release = resolve;
  });
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(async () => old)
    .mockImplementation(async () => json([]));
  mount("/", { auth, apiUrl: "http://localhost:3001", error: null, fetcher });
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  act(() => emit({ userId: "user-b", accessToken: "other-user-token" }));
  await screen.findByText("No companies yet");
  await act(async () => {
    release(json("Expired old token", 401));
    await old;
  });
  expect(screen.getByText("No companies yet")).toBeInTheDocument();
  expect(auth.signOut).not.toHaveBeenCalled();
});
it("keeps data hidden after failed provider sign-out and offers a retry", async () => {
  const { auth, emit } = authFixture(),
    { fetcher } = apiFixture();
  vi.mocked(auth.signOut).mockRejectedValueOnce(new Error("Offline"));
  mount("/", { auth, apiUrl: "http://localhost:3001", error: null, fetcher });
  await screen.findByTestId("operating-cost");
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  await screen.findByRole("button", { name: "Retry sign out" });
  act(() => emit({ userId: "user-a", accessToken: "late-token" }));
  expect(screen.queryByTestId("operating-cost")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Retry sign out" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Retry sign out" })).toBeNull(),
  );
});
it("retries failed backend calculations without displaying old or local results", async () => {
  const { auth } = authFixture(),
    { fetcher } = apiFixture();
  const normal = fetcher.getMockImplementation()!;
  let failing = true;
  fetcher.mockImplementation(async (url, init) =>
    failing && String(url).includes("packaging-costs")
      ? json("Calculator unavailable", 503)
      : normal(url, init),
  );
  mount("/", { auth, apiUrl: "http://localhost:3001", error: null, fetcher });
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Calculator unavailable",
  );
  expect(screen.queryByTestId("operating-cost")).toBeNull();
  failing = false;
  fireEvent.click(screen.getByRole("button", { name: "Retry calculation" }));
  expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
    "€286.00",
  );
});
it("keeps a rejected profile draft visible without claiming it was saved", async () => {
  const { auth } = authFixture(),
    { fetcher } = apiFixture();
  const normal = fetcher.getMockImplementation()!;
  fetcher.mockImplementation(async (url, init) =>
    init?.method === "PATCH"
      ? json("Company owner required.", 403)
      : normal(url, init),
  );
  mount("/company", {
    auth,
    apiUrl: "http://localhost:3001",
    error: null,
    fetcher,
  });
  await screen.findByLabelText("Company name");
  change("Company name", "Unsaved edit");
  fireEvent.click(screen.getByRole("button", { name: "Save company profile" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Company owner required.",
  );
  expect(screen.getByLabelText("Company name")).toHaveValue("Unsaved edit");
  expect(screen.queryByText("Company profile saved.")).toBeNull();
});
it("does not let a save from an unmounted editor overwrite a newer draft", async () => {
  const { auth } = authFixture(),
    { fetcher } = apiFixture();
  const normal = fetcher.getMockImplementation()!;
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  fetcher.mockImplementation(async (url, init) => {
    if (init?.method === "PATCH" && String(url).includes("/scenarios/"))
      await delayed;
    return normal(url, init);
  });
  mount("/", { auth, apiUrl: "http://localhost:3001", error: null, fetcher });
  await screen.findByLabelText("Monthly production (kg)");
  change("Monthly production (kg)", "2000");
  fireEvent.click(screen.getByRole("button", { name: "Save scenario" }));
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/scenarios/") && init?.method === "PATCH",
      ),
    ).toBe(true),
  );
  fireEvent.click(screen.getByRole("link", { name: /Company profile/ }));
  await screen.findByLabelText("Company name");
  fireEvent.click(screen.getByRole("link", { name: /Your costs/ }));
  change("Monthly production (kg)", "3000");
  await act(async () => {
    release();
    await delayed;
  });
  await waitFor(() =>
    expect(screen.getByLabelText("Monthly production (kg)")).toHaveValue(
      "3000",
    ),
  );
});
it("starts step 1 empty, offers OG TOFU values and saves the company's own data", async () => {
  const view = await openDemo("/data");
  const production = await screen.findByLabelText(
    "How many kilograms do you produce per month?",
  );
  expect(production).toHaveValue("");
  expect(localStorage.getItem(DEMO_KEY)).toBeNull();
  fireEvent.click(
    screen.getByRole("button", {
      name: "Use 1000 – OG TOFU for How many kilograms do you produce per month?",
    }),
  );
  expect(production).toHaveValue("1000");
  expect(screen.getByText(/reported · OG TOFU interview/)).toBeInTheDocument();
  fireEvent.click(
    screen.getByRole("button", { name: "Fill everything with OG TOFU data" }),
  );
  expect(await screen.findByTestId("entry-total")).toHaveTextContent("€286.00");
  // Labelled as estimates on the fields (and in the results' assumptions).
  expect(
    screen.getAllByText(/OG TOFU has not reported its 500 g \/ 250 g split/)
      .length,
  ).toBeGreaterThanOrEqual(2);
  fireEvent.click(screen.getByRole("button", { name: "Clear all fields" }));
  await expectGuidance(/see your results/i);
  change("How many kilograms do you produce per month?", "100");
  change("Pack weight (g) · pack size 1", "500");
  change("Share of production (%) · pack size 1", "100");
  change("Bag and label cost (€ per pack) · pack size 1", "0.10");
  change("Labour cost (€ per pack)", "0.20");
  expect(screen.getByTestId("share-total")).toHaveTextContent(
    "Shares add up to 100%.",
  );
  await waitFor(() =>
    expect(screen.getByTestId("entry-total")).toHaveTextContent("€60.00"),
  );
  fireEvent.click(screen.getByRole("button", { name: "Add pack size" }));
  expect(screen.getByLabelText("Pack weight (g) · pack size 2")).toHaveValue(
    "",
  );
  fireEvent.click(screen.getByRole("button", { name: "Remove pack size 2" }));
  fireEvent.click(
    screen.getByRole("button", { name: "Save and see my costs →" }),
  );
  expect(
    await screen.findByRole("heading", { name: "Your costs" }),
  ).toBeInTheDocument();
  expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
    "€60.00",
  );
  view.unmount();
  await openDemo();
  expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
    "€60.00",
  );
});
it("asks the upgrade advisor with the current operation and shows its answer", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          reply: "Keep the current machine until about 6 t a month.",
          sources: [
            { url: "https://example.com/vac", title: "Vacuum machine" },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
  );
  vi.stubGlobal("fetch", fetchMock);
  try {
    await openDemo();
    fireEvent.click(screen.getByRole("link", { name: /Market research/ }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /cheaper per kilogram/,
      }),
    );
    expect(await screen.findByTestId("advisor-assistant")).toHaveTextContent(
      "Keep the current machine until about 6 t a month.",
    );
    expect(
      screen.getByRole("link", { name: "Vacuum machine" }),
    ).toHaveAttribute("href", "https://example.com/vac");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/advisor");
    const sent = JSON.parse(String(init.body));
    expect(sent.scenario.monthlyProductionKg.value).toBe("1000");
    expect(sent.messages).toHaveLength(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("shows prepared OG TOFU research without calling the AI, and keeps it out of live questions", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ reply: "Live answer.", sources: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  try {
    await openDemo();
    fireEvent.click(screen.getByRole("link", { name: /Market research/ }));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Which EU and Latvian packaging rules affect us/,
      }),
    );
    const answer = await screen.findByTestId("advisor-assistant");
    expect(answer).toHaveTextContent("Regulation (EU) 2025/40");
    expect(answer).toHaveTextContent("Prepared answer · researched");
    expect(fetchMock).not.toHaveBeenCalled();
    change("Your question", "What about labels?");
    fireEvent.click(screen.getByRole("button", { name: "Ask the advisor" }));
    expect(await screen.findByText("Live answer.")).toBeInTheDocument();
    const sent = JSON.parse(
      String(
        (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    );
    expect(sent.messages).toEqual([
      { role: "user", content: "What about labels?" },
    ]);
  } finally {
    vi.unstubAllGlobals();
  }
});
it("plans reorders from step 1 data with only stock counts typed in", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T12:00:00Z"));
  try {
    await openDemo();
    fireEvent.click(screen.getByRole("link", { name: /Stock & orders/ }));
    expect(
      await screen.findByRole("region", { name: "Your data" }),
    ).toHaveTextContent("1,000 kg / month");
    expect(await screen.findByTestId("use-labels")).toHaveTextContent(
      "You use about 1,300 a month (from step 1).",
    );
    change("250 g bags in stock", "100");
    change("1000 g bags in stock", "2000");
    expect(
      await screen.findByText(
        /enough for about 15 days\. Order 241 by 19 Nov 2026\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("plan-bag-format-3")).toHaveTextContent(
      "Order now",
    );
    expect(screen.getByTestId("plan-bag-format-1")).toHaveTextContent(
      /OK for now.*enough for about 75 days\. Order 800 by 11 Jan 2027\./,
    );
    expect(screen.getByTestId("order-list")).toHaveTextContent(
      "250 g bags: 241 (order by 19 Nov 2026)",
    );
    expect(screen.getByTestId("order-list")).not.toHaveTextContent("1000 g");
    fireEvent.click(
      screen.getByRole("button", {
        name: "Use 12 – OG TOFU for Kg of product per transport box",
      }),
    );
    expect(screen.getByTestId("use-boxes")).toHaveTextContent(
      "You use about 84 a month",
    );
  } finally {
    vi.useRealTimers();
  }
});
it("turns pasted survey answers into context for market research", async () => {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify({ reply: "Offer 250 g.", sources: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  try {
    await openDemo();
    fireEvent.click(screen.getByRole("link", { name: /Customer survey/ }));
    expect(await screen.findByTestId("survey-questions")).toHaveTextContent(
      "Which pack size would you prefer for regular use?",
    );
    change(
      "Paste your responses (copied from Google Sheets or Excel)",
      "Timestamp\tPreferred size\n1\t250 g\n2\t250 g\n3\t1 kg",
    );
    expect(await screen.findByTestId("survey-results")).toHaveTextContent(
      "3 responses",
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: /Use these results in market research/,
      }),
    );
    expect(await screen.findByTestId("survey-attached")).toHaveTextContent(
      "Customer survey attached (3 responses)",
    );
    expect(await screen.findByTestId("research-costs")).toHaveTextContent(
      "€286.00 a month",
    );
    change("Your question", "Which pack sizes should we offer?");
    fireEvent.click(screen.getByRole("button", { name: "Ask the advisor" }));
    await screen.findByText("Offer 250 g.");
    const sent = JSON.parse(
      String(
        (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body,
      ),
    );
    expect(sent.context).toContain("- 250 g: 2 (67%)");
  } finally {
    sessionStorage.clear();
    vi.unstubAllGlobals();
  }
});
it("fills step 1 from a sales forecast pasted from Excel", async () => {
  await openDemo("/forecast");
  await screen.findByLabelText("Paste from Excel or Google Sheets");
  change(
    "Paste from Excel or Google Sheets",
    "Month\t1 kg\t500 g\t250 g\n2026-08\t800\t300\t200\n2026-09\t850\t300\t200\n2026-10\t900\t300\t200",
  );
  expect(await screen.findByTestId("forecast-summary")).toHaveTextContent(
    "Next month (2026-11): about 1,150 kg",
  );
  fireEvent.click(
    screen.getByRole("button", { name: /Use next month's forecast in step 1/ }),
  );
  expect(
    await screen.findByRole("heading", { name: "Your costs" }),
  ).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "Your data" })).toHaveTextContent(
    "1,150 kg / month",
  );
});
