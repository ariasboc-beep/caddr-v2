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

// --- Rate limiting best-effort (en mémoire, par instance chaude) ---
// Note : les fonctions Netlify étant sans état partagé, ce limiteur protège
// contre les rafales sur une instance chaude, mais n'est pas global. Pour une
// protection robuste, utiliser un store partagé (Firestore/Upstash) — voir SECURITY.md.
const RATE_MAX = 20;              // requêtes autorisées
const RATE_WINDOW_MS = 60_000;    // par minute
const hits = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  // Nettoyage léger pour éviter une croissance mémoire illimitée
  if (hits.size > 5000) {
    for (const [k, v] of hits) { if (v.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(k); }
  }
  return arr.length > RATE_MAX;
}

// --- Point d'entrée de la fonction (Netlify Functions v2) ---

export default async (req: Request) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Contrôle d'origine : bloque l'abus depuis d'autres sites web.
  // (Les appels same-origin et sans Origin — app de bureau — sont autorisés.)
  const allowed = (process.env.ALLOWED_ORIGINS || "https://caddr-v2.netlify.app,http://localhost:5173,http://localhost:8888")
    .split(",").map((o) => o.trim());
  const origin = req.headers.get("origin");
  if (origin && !allowed.includes(origin)) {
    return json({ error: "Forbidden origin" }, 403);
  }

  // Rate limiting par IP
  const ip = req.headers.get("x-nf-client-connection-ip")
    || (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
    || "unknown";
  if (isRateLimited(ip)) {
    return json({ error: "Trop de requêtes, réessayez dans un instant." }, 429);
  }

  if (!API_KEY) {
    // Erreur de config serveur : la variable GEMINI_API_KEY n'est pas définie sur Netlify.
    return json({ error: "Server misconfiguration: missing GEMINI_API_KEY" }, 500);
  }

  // Plafond de taille de requête (~1,5 Mo) pour limiter l'abus / le coût.
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > 1_500_000) {
    return json({ error: "Payload too large" }, 413);
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
