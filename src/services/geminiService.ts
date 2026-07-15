// Ce service n'appelle plus l'API Gemini directement depuis le navigateur.
// Tous les appels passent par une Netlify Function (netlify/functions/gemini.mts),
// afin que la clé API reste côté serveur et ne soit JAMAIS exposée dans le bundle.

import { Block } from "../types";

// Sur le web : chemin relatif. En app de bureau (file://) : on appelle le site déployé.
const PROD_SITE = "https://caddr-v2.netlify.app";
const IS_DESKTOP = typeof window !== "undefined" && !window.location.protocol.startsWith("http");
const ENDPOINT = (IS_DESKTOP ? PROD_SITE : "") + "/.netlify/functions/gemini";

async function callGemini<T>(action: string, payload: unknown): Promise<T | null> {
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    return (json?.data ?? null) as T | null;
  } catch (error) {
    console.error(`Gemini call "${action}" failed:`, error);
    return null;
  }
}

export const getRoutineAdvice = (blocks: Block[], performance: number) =>
  callGemini("routineAdvice", { blocks, performance });

export const getDailyReviewFeedback = (
  tasks: string[],
  performance: number,
  reflection: string
) => callGemini("dailyReview", { tasks, performance, reflection });

export const generateRoutineFromGoal = (goal: string) =>
  callGemini("generateFromGoal", { goal });

export const extractRoutineFromImage = (base64Image: string) =>
  callGemini("extractFromImage", { base64Image });
