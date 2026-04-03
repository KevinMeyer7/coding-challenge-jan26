import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";

/**
 * AI SDK integration — generates match narratives using Vercel AI SDK.
 *
 * Uses Vercel AI SDK to generate match narratives via GPT-4o-mini.
 * It takes match data and generates a narrative explanation using GPT-4o-mini
 * through the official Vercel AI SDK (not raw fetch).
 */
export async function POST(req: Request) {
  const { fruitType, attrDescription, prefDescription, topMatches, candidates } =
    await req.json();

  const otherType = fruitType === "apple" ? "oranges" : "apples";
  const matchDetails = (topMatches || [])
    .slice(0, 3)
    .map(
      (m: { candidateId: string; mutualScore: number; forwardScore: number; reverseScore: number }, i: number) => {
        const c = (candidates || []).find((c: { id: string }) => c.id === m.candidateId);
        return `Match #${i + 1} (${Math.round(m.mutualScore * 100)}% mutual):
  Description: ${c?.attributeDescription || JSON.stringify(c?.attributes || {})}
  Forward: ${Math.round(m.forwardScore * 100)}% | Reverse: ${Math.round(m.reverseScore * 100)}%`;
      }
    )
    .join("\n\n");

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: `You are a charming matchmaking host for a fruit dating show called "Perfect Pear".
A new ${fruitType} has arrived and you need to announce their matches with ${otherType}.

THE ${(fruitType || "fruit").toUpperCase()}:
${attrDescription || "No description available"}
${prefDescription || "No preferences stated"}

TOP MATCHES:
${matchDetails || "No matches found"}

Write a fun, engaging 2-3 paragraph matchmaking announcement. Be witty and use fruit puns.
Explain WHY the top match is a good fit based on their compatibility.
If the scores are low, be encouraging but honest. Keep it under 200 words.`,
    maxTokens: 300,
    temperature: 0.8,
  });

  return Response.json({ narrative: text });
}
