import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReportText } from "../components/ReportText";

it("renders headings, bullets and bold without interpreting HTML", () => {
  const { container } = render(
    <ReportText
      text={
        "## Recommendation\nBuy the **double-chamber** machine.\n\n- Option A\n- Option B\n1. Ask for quotes\n<img src=x onerror=alert(1)>"
      }
    />,
  );
  expect(
    screen.getByRole("heading", { name: "Recommendation" }),
  ).toBeInTheDocument();
  expect(screen.getByText("double-chamber").tagName).toBe("STRONG");
  expect(container.querySelectorAll("ul li")).toHaveLength(2);
  expect(container.querySelectorAll("ol li")).toHaveLength(1);
  expect(container.querySelector("img")).toBeNull();
  expect(screen.getByText(/<img src=x/)).toBeInTheDocument();
});
