import { GoogleGenAI, Type } from "@google/genai";

// La clé reste côté serveur : jamais préfixée VITE_, donc jamais envoyée au navigateur.
const API_KEY = process.env.GEMINI_API_KEY || "";

// --- Schémas de réponse (identiques à l'ancienne logique client) ---

const routineAdviceSchema = {
  type: Type.OBJECT,
  properties: {
    advice: { type: Type.STRING },
    powerTask: { type: Type.STRING },
    motivation: { type: Type.STRING },
  },
  required: ["advice", "powerTask", "motivation"],
};

const dailyReviewSchema = {
  type: Type.OBJECT,
  properties: {
    feedback: { type: Type.STRING },
    focusTomorrow: { type: Type.STRING },
  },
  required: ["feedback", "focusTomorrow"],
};

const routineArraySchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ["title", "tasks"],
  },
};

// --- Handlers par action ---

async function routineAdvice(ai: GoogleGenAI, payload: any) {
  const { blocks = [], performance = 0 } = payload || {};
  const routineSummary = (blocks as any[])
    .map((b) => `${b.title}: ${(b.tasks || []).map((t: any) => t.title).join(", ")}`)
    .join("\n");

  const prompt = `
    En tant qu'expert en productivité pour l'application Caddr., analyse cette routine :
    ${routineSummary}
    Performance : ${performance}%

    Donne un conseil, une tâche "Power Move" et une citation motivante.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: routineAdviceSchema },
  });
  return JSON.parse(response.text || "{}");
}

async function dailyReview(ai: GoogleGenAI, payload: any) {
  const { tasks = [], performance = 0, reflection = "" } = payload || {};
  const prompt = `
    Analyse ma journée sur Caddr. :
    Tâches complétées : ${(tasks as string[]).join(", ")}
    Score global : ${performance}%
    Ma réflexion : "${reflection}"

    Donne un feedback constructif et encourageant (max 150 caractères) et un "Focus" pour demain.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: dailyReviewSchema },
  });
  return JSON.parse(response.text || "{}");
}

async function generateFromGoal(ai: GoogleGenAI, payload: any) {
  const { goal = "" } = payload || {};
  const prompt = `Crée une routine de performance sur Caddr. pour l'objectif suivant : "${goal}".
  Structure la réponse en blocs logiques (ex: Matin, Travail, Soir).
  Chaque bloc doit avoir un titre et une liste de 3 à 5 tâches concrètes.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: routineArraySchema },
  });
  return JSON.parse(response.text || "[]");
}

async function extractFromImage(ai: GoogleGenAI, payload: any) {
  const { base64Image = "" } = payload || {};
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
        {
          text:
            "Extrais les tâches de cette image pour l'application Caddr. et organise-les en blocs logiques avec des titres. Si c'est une liste simple, crée un bloc 'Import Image'.",
        },
      ],
    },
    config: { responseMimeType: "application/json", responseSchema: routineArraySchema },
  });
  return JSON.parse(response.text || "[]");
}

const HANDLERS: Record<string, (ai: GoogleGenAI, payload: any) => Promise<unknown>> = {
  routineAdvice,
  dailyReview,
  generateFromGoal,
  extractFromImage,
};

// --- Point d'entrée de la fonction (Netlify Functions v2) ---

export default async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!API_KEY) {
    // Erreur de config serveur : la variable GEMINI_API_KEY n'est pas définie sur Netlify.
    return json({ error: "Server misconfiguration: missing GEMINI_API_KEY" }, 500);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { action, payload } = body || {};
  const handler = action ? HANDLERS[action] : undefined;
  if (!handler) {
    return json({ error: `Unknown action: ${action}` }, 400);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const data = await handler(ai, payload);
    return json({ data });
  } catch (error) {
    console.error(`Gemini action "${action}" failed:`, error);
    // On renvoie null comme donnée pour que le client conserve son comportement de repli.
    return json({ data: null, error: "Gemini request failed" }, 502);
  }
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
