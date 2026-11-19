/** Survey results handed from the survey tool to market research (this tab only). */
export interface SurveySummary {
  responses: number;
  text: string;
}
const KEY = "packpilot.survey.v1";

export function loadSurvey(): SurveySummary | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as SurveySummary;
    return typeof value.text === "string" && typeof value.responses === "number"
      ? value
      : null;
  } catch {
    return null;
  }
}
export function saveSurvey(value: SurveySummary): boolean {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function clearSurvey() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing was stored.
  }
}
