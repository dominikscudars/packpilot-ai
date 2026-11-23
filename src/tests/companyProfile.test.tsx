import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { DEMO_KEY } from "../demo/apiDemo";
import { navLink } from "./journey";

async function openExampleProfile() {
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
      name: "Load example company (OG TOFU)",
    }),
  );
  await screen.findByTestId("operating-cost");
  fireEvent.click(navLink(/Company profile/));
  await screen.findByRole("heading", { name: "OG TOFU", level: 1 });
}
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("company profile", () => {
  it("shows the operation, pack sizes, packing line and data quality", async () => {
    await openExampleProfile();
    expect(
      screen.getByText("Latvia · Plant-based food manufacturing"),
    ).toBeInTheDocument();
    const glance = await screen.findByTestId("profile-glance");
    expect(glance).toHaveTextContent("1,000 kg / month");
    expect(glance).toHaveTextContent("€286.00 / month");
    expect(glance).toHaveTextContent("€0.286");
    const packs = screen.getByTestId("profile-pack-sizes");
    const row = within(packs)
      .getByRole("rowheader", { name: "250 g" })
      .closest("tr")!;
    expect(row).toHaveTextContent("5%");
    expect(row).toHaveTextContent("200");
    expect(row).toHaveTextContent("€0.880");
    expect(screen.getByTestId("profile-packing-line")).toHaveTextContent(
      "about 103 packs / hour",
    );
    // Reported, estimated and missing numbers are counted and listed.
    const quality = screen.getByTestId("data-quality");
    expect(quality).toHaveTextContent(/\d+ reported by the company/);
    expect(quality).toHaveTextContent(/\d+ entered or estimated/);
    expect(
      screen.getByText("Available machine hours").closest("li"),
    ).toHaveTextContent("Estimate, not reported by OG TOFU");
  });

  it("adds and edits suppliers, checking numbers", async () => {
    await openExampleProfile();
    fireEvent.click(screen.getByRole("button", { name: "+ Add supplier" }));
    type("Supplier name", "Baltic Pack");
    type("What they supply", "PA/PE vacuum bags");
    type("Delivery time (days)", "two weeks");
    fireEvent.click(screen.getByRole("button", { name: "Save supplier" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Delivery time and minimum order must be whole numbers.",
    );
    type("Delivery time (days)", "14");
    type("Minimum order (packs)", "5000");
    type("Contact", "sales@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Save supplier" }));
    const list = await screen.findByTestId("supplier-list");
    expect(list).toHaveTextContent("Baltic Pack");
    expect(list).toHaveTextContent("14 days delivery");
    expect(list).toHaveTextContent("min. 5,000 packs");
    const stored = JSON.parse(localStorage.getItem(DEMO_KEY)!);
    expect(stored.catalog.suppliers[0]).toMatchObject({
      name: "Baltic Pack",
      leadTimeCalendarDays: { value: "14" },
    });
    // Edit keeps the record and updates it.
    fireEvent.click(screen.getByRole("button", { name: "Edit Baltic Pack" }));
    type("Delivery time (days)", "10");
    fireEvent.click(screen.getByRole("button", { name: "Save supplier" }));
    expect(await screen.findByText("10 days delivery")).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(DEMO_KEY)!).catalog.suppliers,
    ).toHaveLength(1);
  });
});
