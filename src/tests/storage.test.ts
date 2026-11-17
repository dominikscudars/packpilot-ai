import { describe, it, expect } from "vitest";
import { createDemo } from "../demo/ogTofu";
import {
  loadWorkspace,
  saveWorkspace,
  STORAGE_KEY,
} from "../storage/workspace";
describe("versioned browser storage", () => {
  it("round-trips the edited profile and both scenarios", () => {
    localStorage.clear();
    const workspace = createDemo();
    workspace.company.name = "Edited company";
    workspace.baseline.plans[0].productionKg.value = 2000;
    expect(saveWorkspace(localStorage, workspace)).toBeNull();
    expect(loadWorkspace(localStorage).workspace).toEqual(workspace);
  });
  it.each(["{", '{"version":42}', '{"version":1,"company":null}'])(
    "recovers from invalid saved data without overwriting it: %s",
    (raw) => {
      localStorage.setItem(STORAGE_KEY, raw);
      expect(loadWorkspace(localStorage).notice).toBeTruthy();
      expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    },
  );
  it("reports blocked browser storage", () => {
    expect(
      loadWorkspace({
        getItem: () => {
          throw new Error("blocked");
        },
      }).notice,
    ).toBeTruthy();
    expect(
      saveWorkspace(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        createDemo(),
      ),
    ).toMatch(/could not be saved/);
  });
});
