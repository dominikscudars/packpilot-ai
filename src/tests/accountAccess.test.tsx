import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import App from "../App";
import type { AppServices } from "../components/AuthGate";
import { authFixture, apiFixture } from "./integrationFixture";
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
const noAuth: AppServices = {
  auth: null,
  apiUrl: "http://localhost:3001",
  error: null,
};
function mount(services: AppServices = noAuth) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <App services={services} />
    </MemoryRouter>,
  );
}
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
function fillSignUp(password = "pilot-pass-1", repeat = password) {
  fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
  type("Your name", "Ana");
  type("Company name", "OG TOFU");
  type("Work email", "ana@example.test");
  type("Create password", password);
  type("Repeat password", repeat);
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));
}

it("previews sign-up, plans and a simulated checkout without storing anything", async () => {
  mount();
  fillSignUp("pilot-pass-1", "different-1");
  expect(screen.getByRole("alert")).toHaveTextContent("do not match");
  type("Repeat password", "pilot-pass-1");
  fireEvent.click(screen.getByRole("button", { name: "Create account" }));

  expect(
    await screen.findByRole("heading", { name: "Welcome, Ana" }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/€\s?\d/)).toBeNull(); // no prices are quoted
  const pro = screen.getByRole("region", { name: "Professional plan" });
  fireEvent.click(
    (pro.querySelector("button") as HTMLButtonElement) ??
      screen.getAllByRole("button", { name: "Preview checkout" })[0],
  );
  const checkout = screen.getByRole("dialog", { name: "Simulated checkout" });
  expect(checkout).toHaveTextContent("No payment is taken");
  expect(checkout.querySelectorAll("input")).toHaveLength(0);
  fireEvent.click(screen.getByRole("button", { name: "Confirm (simulated)" }));
  expect(screen.getByRole("status")).toHaveTextContent("Nothing was charged");
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to PackPilot" }),
  );
  expect(await screen.findByLabelText("Active company")).toBeInTheDocument();
  const stored = JSON.stringify({ ...localStorage });
  expect(stored).not.toContain("ana@example.test");
  expect(stored).not.toContain("pilot-pass-1");
});

it("creates a real account and asks the user to confirm their email", async () => {
  const { auth } = authFixture(null);
  auth.signUp = vi.fn(async () => ({ needsConfirmation: true }));
  mount({ ...noAuth, auth, fetcher: apiFixture().fetcher });
  await screen.findByRole("button", { name: "Sign in" });
  fillSignUp();
  expect(await screen.findByRole("status")).toHaveTextContent(
    "Check ana@example.test and confirm your address",
  );
  expect(auth.signUp).toHaveBeenCalledWith("ana@example.test", "pilot-pass-1", {
    name: "Ana",
    company: "OG TOFU",
  });
  expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
});

it("shows sign-up failures from the account provider", async () => {
  const { auth } = authFixture(null);
  auth.signUp = vi.fn(async () => {
    throw new Error("Signups not allowed for this instance");
  });
  mount({ ...noAuth, auth, fetcher: apiFixture().fetcher });
  await screen.findByRole("button", { name: "Sign in" });
  fillSignUp();
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Signups not allowed",
  );
});

it("keeps the start screen to sign in and the demo (no plans button)", () => {
  mount();
  expect(screen.queryByRole("button", { name: "See plans" })).toBeNull();
  expect(
    screen.getByRole("button", { name: "Open local demo" }),
  ).toBeInTheDocument();
});
