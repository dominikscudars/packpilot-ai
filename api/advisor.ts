import {
  createRateLimiter,
  handleAdvisorRequest,
} from "../src/advisor/server.js";

declare const process: { env: Record<string, string | undefined> };

// Best-effort per-client limit for each warm function instance: at most
// 6 questions per 10 minutes from one address.
const limiter = createRateLimiter(6, 10 * 60_000);

// Vercel Function: the Gemini key lives only in the server environment
// (Vercel project setting GEMINI_API_KEY), never in the browser bundle.
export function POST(request: Request): Promise<Response> {
  return handleAdvisorRequest(request, {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL,
    fallbackModel: process.env.GEMINI_FALLBACK_MODEL,
    limiter,
  });
}
