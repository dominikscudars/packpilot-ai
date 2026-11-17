import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import App from "../App";
// Chart geometry belongs to Recharts; assert the real calculation-backed text and table.
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
it("renders reference results, recalculates immediately, and restores edits after remount", () => {
  const view = render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByTestId("operating-cost")).toHaveTextContent("€286.00");
  expect(screen.getByTestId("cost-per-kg")).toHaveTextContent("€0.286");
  expect(screen.getByTestId("total-packages")).toHaveTextContent("1,300");
  fireEvent.change(
    screen.getByLabelText("Fresh tofu monthly production (kg)"),
    { target: { value: "2000" } },
  );
  expect(screen.getByTestId("operating-cost")).toHaveTextContent("€572.00");
  expect(screen.getByTestId("total-packages")).toHaveTextContent("2,600");
  view.unmount();
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  expect(
    screen.getByLabelText("Fresh tofu monthly production (kg)"),
  ).toHaveValue(2000);
  expect(screen.getByTestId("operating-cost")).toHaveTextContent("€572.00");
});
it("shows a missing production error instead of stale financial results", () => {
  render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
  fireEvent.change(
    screen.getByLabelText("Fresh tofu monthly production (kg)"),
    { target: { value: "" } },
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Enter monthly production",
  );
  expect(screen.queryByTestId("operating-cost")).toBeNull();
});
it("keeps simulator edits separate from current-operation inputs", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/simulator"]}>
      <App />
    </MemoryRouter>,
  );
  fireEvent.change(
    screen.getByLabelText("Fresh tofu monthly production (kg)"),
    { target: { value: "2000" } },
  );
  expect(screen.getByTestId("operating-cost")).toHaveTextContent("€572.00");
  expect(screen.getByText(/Different production volumes/)).toBeInTheDocument();
  await user.click(screen.getByRole("link", { name: "Overview" }));
  expect(screen.getByTestId("operating-cost")).toHaveTextContent("€286.00");
});
it("requires an explicit rate when switching to hourly labor", () => {
  render(
    <MemoryRouter initialEntries={["/simulator"]}>
      <App />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Pricing method"), {
    target: { value: "perHour" },
  });
  expect(screen.getByTestId("operating-cost")).toHaveTextContent("Unknown");
  fireEvent.change(screen.getByLabelText("Labor rate (€/worker-hour)"), {
    target: { value: "12" },
  });
  expect(screen.getByTestId("operating-cost")).toHaveTextContent("€242.67");
});
it("persists company profile edits", () => {
  const view = render(
    <MemoryRouter initialEntries={["/company"]}>
      <App />
    </MemoryRouter>,
  );
  fireEvent.change(screen.getByLabelText("Company name"), {
    target: { value: "Edited pilot" },
  });
  view.unmount();
  render(
    <MemoryRouter initialEntries={["/company"]}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByLabelText("Company name")).toHaveValue("Edited pilot");
});
