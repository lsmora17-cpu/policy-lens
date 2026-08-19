import { EMBEDDING_MODEL } from "@/lib/config";
import { getOpenAIClient } from "@/lib/openai";

// Kept comfortably under OpenAI's per-request input-array limit; a single
// document's chunk count from our upload pipeline (max ~300 pages) stays
// well within a couple of batches even in the worst case.
const BATCH_SIZE = 100;

// Same model for ingestion and query time (PRD.md §8) — callers just pass
// chunk text or a user's question, this doesn't care which.
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = getOpenAIClient();
  const vectors: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    vectors.push(...response.data.map((d) => d.embedding));
  }

  return vectors;
}
