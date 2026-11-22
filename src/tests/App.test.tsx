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
import { NAV, enterReferenceData, navLink } from "./journey";
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
/**
 * Opens the demo. A first visit shows only the full-screen data entry at
 * every address, so by default the visitor types OG TOFU's reference data,
 * then the requested page is opened from the navigation.
 */
async function openDemo(path = "/", { setup = true } = {}) {
  const view = mount(path);
  // After a refresh in the same tab the demo opens directly.
  const open = screen.queryByRole("button", { name: "Open local demo" });
  if (open) fireEvent.click(open);
  await screen.findByLabelText("Active company");
  if (!setup) return view;
  const first = await screen.findByRole("heading", {
    name: /^(Enter your data|Your workspace)$/,
  });
  if (first.textContent === "Enter your data") await enterReferenceData();
  else await screen.findByTestId("operating-cost");
  const link = NAV[path];
  if (link) fireEvent.click(navLink(link));
  return view;
}
const change = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
it("points visitors to the local demo when sign-in is not configured", () => {
  mount();
  expect(
    screen.getByText(/Sign-in isn.t enabled on this demo yet/),
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
    ["1 kg", "800", "€176.00", "€0.220"],
    ["500 g", "300", "€66.00", "€0.440"],
    ["250 g", "200", "€44.00", "€0.880"],
  ]) {
    const row = screen.getByRole("rowheader", { name: format }).closest("tr");
    if (!row) throw new Error("Packaging row missing");
    const cells = within(row).getAllByRole("cell");
    expect(cells[1].textContent).toBe(count);
    expect(cells[2].textContent).toBe(perKg);
    expect(cells[5].textContent).toBe(total);
  }
  fireEvent.click(navLink(/Edit data & costs/));
  change("How many kilograms do you produce per month?", "2000");
  // The 2000 kg edit is not stored until it is saved explicitly.
  expect(localStorage.getItem(DEMO_KEY) ?? "").not.toContain('"2000"');
  fireEvent.click(
    screen.getByRole("button", { name: "Save changes & update costs" }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("operating-cost")).toHaveTextContent("€572.00"),
  );
  expect(localStorage.getItem(DEMO_KEY)).toContain('"2000"');
  // A refresh returns straight to the workspace with the saved data.
  view.unmount();
  await openDemo();
  expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
    "€572.00",
  );
});
it("never saves or shows results for missing or invalid production", async () => {
  await openDemo("/data");
  await screen.findByRole("heading", { name: "Edit data & costs" });
  for (const value of ["", "-1"]) {
    change("How many kilograms do you produce per month?", value);
    fireEvent.click(
      screen.getByRole("button", { name: "Save changes & update costs" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Monthly production|how many kilograms/i,
    );
    expect(screen.queryByTestId("operating-cost")).toBeNull();
  }
  expect(localStorage.getItem(DEMO_KEY) ?? "").not.toContain('"-1"');
});
it("saves company and product changes explicitly", async () => {
  await openDemo("/company");
  await screen.findByLabelText("Company name");
  change("Company name", "Edited pilot");
  // Setup saved the operation; the edited name is stored only on save.
  expect(localStorage.getItem(DEMO_KEY) ?? "").not.toContain("Edited pilot");
  fireEvent.click(screen.getByRole("button", { name: "Save company profile" }));
  await screen.findByText("Company profile saved.");
  expect(JSON.parse(localStorage.getItem(DEMO_KEY)!).company.name).toBe(
    "Edited pilot",
  );
  // The demo starts empty: no sample products are shown as the visitor's.
  expect(screen.queryByLabelText("Product name")).toBeNull();
  expect(JSON.parse(localStorage.getItem(DEMO_KEY)!).catalog.products).toEqual(
    [],
  );
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
  change("Product name", "Edited tofu");
  fireEvent.click(screen.getByRole("button", { name: "Save product" }));
  await screen.findByText("Product saved.");
  expect(
    fetcher.mock.calls.some(
      ([url, init]) =>
        String(url).includes("/companies/og-tofu/products/") &&
        init?.method === "PATCH" &&
        String(init.body).includes("Edited tofu"),
    ),
  ).toBe(true);
  fireEvent.click(navLink(/Edit data & costs/));
  change("How many kilograms do you produce per month?", "2000");
  fireEvent.click(
    screen.getByRole("button", { name: "Save changes & update costs" }),
  );
  await waitFor(() =>
    expect(screen.getByTestId("operating-cost")).toHaveTextContent("€572.00"),
  );
  expect(
    fetcher.mock.calls.some(
      ([url, init]) =>
        String(url).includes("/companies/og-tofu/scenarios/") &&
        init?.method === "PATCH" &&
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
  fireEvent.click(navLink(/Edit data & costs/));
  fetcher.mockImplementation(async () => json("Expired", 401));
  vi.mocked(auth.refresh).mockResolvedValue(null);
  change("How many kilograms do you produce per month?", "2000");
  fireEvent.click(
    screen.getByRole("button", { name: "Save changes & update costs" }),
  );
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
  // The second company has no saved data, so it shows its own empty setup
  // screen: readiness and data are not shared between companies.
  expect(
    await screen.findByRole("heading", { name: "Enter your data" }),
  ).toBeInTheDocument();
  expect(screen.getByLabelText("Active company")).toHaveValue("second");
  expect(
    screen.getByLabelText("How many kilograms do you produce per month?"),
  ).toHaveValue("");
  await act(async () => {
    release();
    await delayed;
  });
  expect(screen.getByLabelText("Active company")).toHaveValue("second");
  expect(
    screen.getByLabelText("How many kilograms do you produce per month?"),
  ).toHaveValue("");
  expect(
    screen.queryByRole("heading", { name: "Packaging Insights" }),
  ).toBeNull();
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
  mount("/data", {
    auth,
    apiUrl: "http://localhost:3001",
    error: null,
    fetcher,
  });
  await screen.findByRole("heading", { name: "Edit data & costs" });
  change("How many kilograms do you produce per month?", "2000");
  fireEvent.click(
    screen.getByRole("button", { name: "Save changes & update costs" }),
  );
  await waitFor(() =>
    expect(
      fetcher.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/scenarios/") && init?.method === "PATCH",
      ),
    ).toBe(true),
  );
  fireEvent.click(navLink(/Company profile/));
  await screen.findByLabelText("Company name");
  fireEvent.click(navLink(/Edit data & costs/));
  change("How many kilograms do you produce per month?", "3000");
  await act(async () => {
    release();
    await delayed;
  });
  // The late save neither clears the newer draft nor navigates away.
  await waitFor(() =>
    expect(
      screen.getByLabelText("How many kilograms do you produce per month?"),
    ).toHaveValue("3000"),
  );
  expect(
    screen.getByRole("heading", { name: "Edit data & costs" }),
  ).toBeInTheDocument();
});
it("onboarding starts empty, shows no results, validates each step and opens the workspace only after a valid save", async () => {
  const view = await openDemo("/data", { setup: false });
  const production = await screen.findByLabelText(
    "How many kilograms do you produce per month?",
  );
  // A first visit is the full-screen form only: empty, no results, no menu.
  expect(production).toHaveValue("");
  expect(screen.queryByTestId("operating-cost")).toBeNull();
  expect(
    screen.queryByRole("navigation", { name: "Main navigation" }),
  ).toBeNull();
  // No per-field OG TOFU fills; only the one labelled, opt-in example button.
  expect(
    screen
      .getAllByRole("button", { name: /OG TOFU/ })
      .map((b) => b.textContent),
  ).toEqual(["Load example company (OG TOFU)"]);
  expect(screen.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Step 1 of 4",
  );
  expect(localStorage.getItem(DEMO_KEY)).toBeNull();
  change("How many kilograms do you produce per month?", "100");
  change("Pack weight (g) · pack size 1", "500");
  change("Share of production (%) · pack size 1", "90");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  // Invalid shares: the step stays, the entries are kept, nothing is saved.
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "add up to 90%; they must total exactly 100%",
  );
  expect(screen.getByTestId("share-total")).toHaveClass("field-error");
  expect(production).toHaveValue("100");
  expect(localStorage.getItem(DEMO_KEY)).toBeNull();
  change("Share of production (%) · pack size 1", "100");
  fireEvent.click(screen.getByRole("button", { name: "+ Add pack size" }));
  fireEvent.click(screen.getByRole("button", { name: "Remove pack size 2" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  // Decimal comma is accepted and stored as a decimal point.
  change("Bag and label cost (€ per pack) · pack size 1", "0,10");
  expect(
    screen.getByLabelText("Bag and label cost (€ per pack) · pack size 1"),
  ).toHaveValue("0.10");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  change("Labour cost (€ per pack)", "0.20");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(
    within(screen.getByRole("region", { name: "Production" })).getByText(
      "100 kg",
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Show my workspace" }));
  expect(await screen.findByTestId("operating-cost")).toHaveTextContent(
    "€60.00",
  );
  expect(
    screen.getByRole("heading", { name: "Your costs" }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole("heading", { name: "Future forecasting" }),
  ).toBeInTheDocument();
  view.unmount();
  // Returning visitors with completed data go straight to their workspace.
  await openDemo("/", { setup: false });
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
    fireEvent.click(navLink(/Market research/));
    fireEvent.click(
      await screen.findByRole("button", {
        name: "How could we reduce our packaging costs?",
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
    fireEvent.click(navLink(/Market research/));
    fireEvent.click(
      await screen.findByRole("button", {
        name: /Which EU and Latvian packaging rules affect us/,
      }),
    );
    const answer = await screen.findByTestId("advisor-assistant");
    expect(answer).toHaveTextContent("Regulation (EU) 2025/40");
    expect(answer).toHaveTextContent("Prepared example for OG TOFU");
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
    await screen.findByRole("region", { name: "Survey builder" });
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
it("the workspace leads with Your costs and Future forecasting, and offers market research", async () => {
  await openDemo();
  expect(screen.getByRole("heading", { name: "Your costs" })).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Future forecasting" }),
  ).toBeVisible();
  // No grid of unrelated feature cards.
  expect(screen.queryByRole("region", { name: "Next actions" })).toBeNull();
  expect(screen.getByTestId("cost-drivers")).toHaveTextContent(
    "Labour is 68% of your monthly cost",
  );
  expect(screen.getByTestId("cost-drivers")).toHaveTextContent(
    "250 g packs cost 4.0× more per kg than 1 kg packs",
  );
  // A projection only follows stated assumptions; none means no change.
  expect(screen.getByTestId("projection-summary")).toHaveTextContent(
    "No change set",
  );
  change("Production change", "100");
  expect(screen.getByTestId("projection-summary")).toHaveTextContent(
    "packaging cost €572 a month (now €286)",
  );
  fireEvent.click(screen.getByRole("link", { name: "Ask market research" }));
  expect(
    await screen.findByRole("heading", { name: "Market research" }),
  ).toBeInTheDocument();
  expect(await screen.findByTestId("research-costs")).toHaveTextContent(
    "€286.00 a month",
  );
});
it("has no Stock & orders or Sales history tools; old links open the workspace", async () => {
  const view = await openDemo();
  expect(screen.queryByRole("link", { name: /Stock & orders/ })).toBeNull();
  expect(screen.queryByRole("link", { name: /Sales history/ })).toBeNull();
  expect(
    screen.queryByRole("button", { name: "From your sales history" }),
  ).toBeNull();
  view.unmount();
  for (const path of ["/reorder", "/forecast", "/inventory"]) {
    const again = await openDemo(path, { setup: false });
    expect(
      await screen.findByRole("heading", { name: "Your workspace" }),
    ).toBeInTheDocument();
    again.unmount();
  }
});
