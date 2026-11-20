import { DEMO_KEY } from "../demo/apiDemo";
import { clearSetupRecords } from "./setupState";

/** Browser keys the local demo writes; cleared together by "Reset demo". */
const DEMO_LOCAL_KEYS = [DEMO_KEY, "packpilot.reorder.v1"];
const DEMO_LOCAL_PREFIXES = ["packpilot.reorder.v1:demo:"];
const DEMO_SESSION_PREFIXES = ["packpilot.draft.v1:demo:", "packpilot.survey"];

/** Clears demo data, setup readiness and drafts. Signed-in data is untouched. */
export function resetDemoStorage() {
  clearSetupRecords("demo:");
  for (const key of DEMO_LOCAL_KEYS)
    try {
      localStorage.removeItem(key);
    } catch {
      // Blocked storage: nothing was stored.
    }
  try {
    for (const key of Object.keys(localStorage))
      if (DEMO_LOCAL_PREFIXES.some((p) => key.startsWith(p)))
        localStorage.removeItem(key);
  } catch {
    // Blocked storage: nothing was stored.
  }
  try {
    for (const key of Object.keys(sessionStorage))
      if (DEMO_SESSION_PREFIXES.some((p) => key.startsWith(p)))
        sessionStorage.removeItem(key);
  } catch {
    // Blocked storage: nothing was stored.
  }
}
