import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWorkspace } from "../components/WorkspaceProvider";
import { SurveyBuilder } from "../survey/SurveyBuilder";
import { parseTable, summaryText, tabulate } from "../survey/tabulate";
import { saveSurvey } from "../survey/surveyStore";

/** Tool: write a customer survey for Google Forms and analyse the answers. */
export function Survey() {
  const { scope } = useWorkspace();
  const navigate = useNavigate();
  const [pasted, setPasted] = useState("");
  const [fileError, setFileError] = useState("");

  const results = useMemo(() => tabulate(parseTable(pasted)), [pasted]);

  return (
    <>
      <header className="page-heading">
        <div>
          <h1>Customer survey</h1>
          <p>A survey written from your own numbers, in a few clicks.</p>
        </div>
      </header>

      <SurveyBuilder />

      <section className="panel">
        <h2>Analyse the answers</h2>
        <label>
          Paste your responses (copied from Google Sheets or Excel)
          <textarea
            rows={5}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Select all cells in the responses sheet, copy, and paste here"
          />
        </label>
        <label className="file-input">
          …or upload the .csv file
          <input
            type="file"
            accept=".csv,text/csv,.tsv,.txt"
            onChange={async (e) => {
              setFileError("");
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2_000_000)
                return setFileError("That file is larger than 2 MB.");
              setPasted(await file.text());
            }}
          />
        </label>
        {fileError && (
          <div className="error" role="alert">
            {fileError}
          </div>
        )}

        {results.responses > 0 && (
          <div data-testid="survey-results">
            <p>
              <strong>{results.responses} responses</strong> ·{" "}
              {results.questions.length} questions
            </p>
            {results.questions.map((q) => (
              <div key={q.question} className="survey-result">
                <h3>{q.question}</h3>
                {q.kind === "choice" ? (
                  <ul>
                    {q.answers.slice(0, 8).map((a) => {
                      const share = Math.round((a.count / q.answered) * 100);
                      return (
                        <li key={a.label}>
                          <span className="bar-label">
                            {a.label} — {a.count} ({share}%)
                          </span>
                          <span
                            className="bar"
                            style={{ width: `${share}%` }}
                            aria-hidden="true"
                          />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <ul className="survey-quotes">
                    {q.examples.map((e) => (
                      <li key={e}>“{e}”</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                saveSurvey(scope, {
                  responses: results.responses,
                  text: summaryText(results.responses, results.questions),
                });
                navigate("/advisor");
              }}
            >
              Use these results in market research →
            </button>
          </div>
        )}
      </section>
    </>
  );
}
