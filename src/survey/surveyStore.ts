/**
 * Survey results handed from the survey tool to market research: this tab
 * only, and scoped to one workspace so another company never sees them.
 */
export interface SurveySummary {
  responses: number;
  text: string;
}
const KEY = (scope: string) => `packpilot.survey.v1:${scope}`;

export function loadSurvey(scope: string): SurveySummary | null {
  try {
    const raw = sessionStorage.getItem(KEY(scope));
    if (!raw) return null;
    const value = JSON.parse(raw) as SurveySummary;
    return typeof value.text === "string" && typeof value.responses === "number"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveSurvey(scope: string, value: SurveySummary): boolean {
  try {
    sessionStorage.setItem(KEY(scope), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function clearSurvey(scope: string) {
  try {
    sessionStorage.removeItem(KEY(scope));
  } catch {
    // Storage blocked: nothing was stored.
  }
}
