import { expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { enterReferenceData, openTab } from "./journey";

it("lets you type forecast changes freely and tap common values", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App
        services={{ auth: null, apiUrl: "http://localhost:3001", error: null }}
      />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Open local demo" }));
  await enterReferenceData();
  openTab("Forecast");
  const production = screen.getByRole("textbox", { name: "Production change" });
  // The old box snapped back to 0 when cleared; now it can be emptied and retyped.
  await user.clear(production);
  expect(production).toHaveValue("");
  await user.type(production, "100");
  expect(production).toHaveValue("100");
  expect(screen.getByTestId("projection-summary")).toHaveTextContent(
    "€572 a month (now €286)",
  );
  // A decimal comma works too.
  await user.clear(production);
  await user.type(production, "12,5");
  expect(production).toHaveValue("12,5");
  expect(screen.getByTestId("projection-summary")).toHaveTextContent(
    "production +12.5%",
  );
  // One tap for common values.
  await user.click(
    screen
      .getByRole("group", { name: "Production change presets" })
      .querySelector("button:nth-child(3)")!,
  );
  expect(production).toHaveValue("50");
  expect(screen.getByTestId("projection-summary")).toHaveTextContent(
    "€429 a month",
  );
});
