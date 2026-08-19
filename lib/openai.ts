import OpenAI from "openai";

// Server-side only: OPENAI_API_KEY is read from process.env, never exposed to
// the browser, and never asked of the user — it lives in .env per CLAUDE.md.
export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set in .env");
  }
  return new OpenAI({ apiKey });
}
