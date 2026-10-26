// Thin, dependency-free client for TypeSafe AI's Jev "System One" model
// (plain fetch, no @typesafe-ai/sdk — matches gmail.ts's own hand-rolled-REST-
// client style). Jev has no free-text-generation primitive: it only answers
// typed questions (choice/score/noul) against a `state` blob, returning
// structured, probabilistic answers. See https://docs.typesafe.ai.

const SYSTEM_ONE_API = "https://api.typesafe.ai/v1/systemone";

export type JevQuestion =
  | { type: "score"; instructions: string; criteria: string[] }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "noul"; instructions: string; criteria?: { true: string; false: string } };

export type JevAnswer =
  | { type: "score"; score: number; confidence: number; probabilities: Record<string, number>; legend: Record<string, string> }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: "noul"; noul: number };

type JevResult<T extends Record<string, JevQuestion>> =
  | { ok: true; answers: { [K in keyof T]: JevAnswer } }
  | { ok: false; error: string };

export async function askJev<T extends Record<string, JevQuestion>>(
  state: string,
  questions: T
): Promise<JevResult<T>> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "TYPESAFE_API_KEY is not configured." };
  }

  let res: Response;
  try {
    res = await fetch(SYSTEM_ONE_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "jev-latest", state, questions }),
    });
  } catch {
    return { ok: false, error: "Could not reach the Jev API." };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Jev API request failed: ${res.status} ${body}`.trim() };
  }

  const data = (await res.json()) as { answers: { [K in keyof T]: JevAnswer } };
  return { ok: true, answers: data.answers };
}
