import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";
afterEach(cleanup);
// Per-tab state (the demo choice, drafts, research conversations) must never
// leak from one test into the next.
beforeEach(() => {
  try {
    sessionStorage.clear();
    localStorage.clear();
  } catch {
    // Some tests stub storage; they set up their own state.
  }
});
