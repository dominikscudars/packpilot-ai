import { workspaceSchema } from "../models/schema";
import { createDemo } from "../demo/ogTofu";
import type { Workspace } from "../models/types";
export const STORAGE_KEY = "packpilot.workspace.v1";
export function loadWorkspace(storage: Pick<Storage, "getItem">): {
  workspace: Workspace;
  notice: string | null;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { workspace: createDemo(), notice: null };
    const result = workspaceSchema.safeParse(JSON.parse(raw));
    if (!result.success) throw new Error("Invalid saved data");
    return { workspace: result.data, notice: null };
  } catch {
    return {
      workspace: createDemo(),
      notice:
        "Saved data could not be loaded. The demo is open; existing saved data is preserved until you make an edit.",
    };
  }
}
export function saveWorkspace(
  storage: Pick<Storage, "setItem">,
  workspace: Workspace,
): string | null {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(workspaceSchema.parse(workspace)),
    );
    return null;
  } catch {
    return "Changes are visible in this session but could not be saved in this browser.";
  }
}
