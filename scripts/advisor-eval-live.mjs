// Optional live evaluation of the AI advisor (not run in CI).
//
//   GEMINI_API_KEY=... npm run eval:advisor:live [-- L01 L03]
//
// Sends the "live" questions of the versioned case set to the real model
// with the OG TOFU demo data, then scores each answer with the same checks
// the offline set uses. Each question spends AI quota (several requests with
// research), so run it deliberately. The key is read from the environment
// only and never printed.
import { handleAdvisorRequest } from "../src/advisor/server.ts";
import { forbiddenClaims } from "../src/advisor/snapshot.ts";
import { CASES, EVAL_VERSION } from "../src/advisor/evals/cases.v1.ts";
import { createDemoScenario } from "../backend/src/domain/demo.ts";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("Set GEMINI_API_KEY to run the live evaluation.");
  process.exit(2);
}
const only = process.argv.slice(2);
const cases = CASES.filter(
  (c) => c.kind === "live" && (only.length === 0 || only.includes(c.id)),
);
const results = [];
for (const c of cases) {
  const started = Date.now();
  const response = await handleAdvisorRequest(
    new Request("http://local/api/advisor", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        scenario: createDemoScenario(),
        messages: [{ role: "user", content: c.question }],
      }),
    }),
    { apiKey, model: process.env.GEMINI_MODEL },
  );
  const body = await response.json();
  const failures = [];
  if (response.status !== 200)
    failures.push(`HTTP ${response.status} ${body.code ?? ""}`);
  else {
    const flags = forbiddenClaims(body.reply);
    if (flags.length) failures.push(`forbidden: ${flags.join(", ")}`);
    if (c.mustUseEngine && body.basis.engineCalls === 0)
      failures.push("no PackPilot calculation used");
    if (c.mustCite && body.sources.length === 0)
      failures.push("no sources cited");
  }
  results.push({
    id: c.id,
    pass: failures.length === 0,
    failures,
    seconds: Math.round((Date.now() - started) / 1000),
    basis: body.basis,
  });
  console.log(
    `${failures.length ? "FAIL" : "pass"} ${c.id} ${c.what} ${failures.join("; ")}`,
  );
}
const passed = results.filter((r) => r.pass).length;
console.log(`\n${EVAL_VERSION}: ${passed}/${results.length} live cases passed`);
process.exit(passed === results.length ? 0 : 1);
