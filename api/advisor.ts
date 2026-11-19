import { handleAdvisorRequest } from "../src/advisor/server.js";

declare const process: { env: Record<string, string | undefined> };

// Vercel Function: the API key lives only in the server environment
// (Vercel project setting ANTHROPIC_API_KEY), never in the browser bundle.
export function POST(request: Request): Promise<Response> {
  return handleAdvisorRequest(request, {
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}
