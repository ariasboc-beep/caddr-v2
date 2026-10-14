import { GoogleGenAI, Type } from "@google/genai";
import { verifyFirebaseToken, consumeDailyQuota } from "../lib/auth.mts";

// Nombre maximal d'appels IA par utilisateur et par jour (modifiable sur Netlify).
const DAILY_MAX = Number(process.env.AI_DAILY_LIMIT || 40);

// La clé reste côté serveur : jamais préfixée VITE_, donc jamais envoyée au navigateur.
const API_KEY = process.env.GEMINI_API_KEY || "";

// Modèles de l'offre gratuite de Gemini. Le premier est utilisé ; si Google le
// refuse (modèle retiré, saturé, quota du modèle atteint), on essaie le suivant.
// Modifiable sur Netlify avec la variable GEMINI_MODEL.
const MODELS = [...new Set([process.env.GEMINI_MODEL || "gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-2.5-flash"])];

async function generate(ai: GoogleGenAI, contents: any, schema: any): Promise<string> {
  let last: unknown;
  for (const model of MODELS) {
    try {
      const response = await ai.models.generateContent({ model, contents, config: { responseMimeType: "application/json", responseSchema: schema } });
      if (response.text) return response.text;
    } catch (e) { last = e; console.warn(`Gemini ${model} indisponible, modèle suivant.`, e); }
  }
  throw last || new Error("Réponse vide");
}

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

  return JSON.parse(await generate(ai, prompt, routineAdviceSchema) || "{}");
}

async function dailyReview(ai: GoogleGenAI, payload: any) {
  const { tasks = [], performance = 0, reflection = "", missed = [], mood = "", gratitude = [], pride = [], priority = "", habits = [], postponed = [] } = payload || {};
  const list = (a: unknown) => (Array.isArray(a) ? a : []).map(String).filter(Boolean).slice(0, 40).join(" ; ") || "—";
  const prompt = `Tu es le coach bienveillant et exigeant de l'application de discipline Caddr.
Analyse ma journée à partir de ces éléments :
- Tâches faites : ${list(tasks)}
- Tâches non faites : ${list(missed)}
- Reportées à demain : ${list(postponed)}
- Habitudes du jour : ${list(habits)}
- Objectif prioritaire : ${String(priority || "—").slice(0, 200)}
- Score de la journée : ${performance} %
- Humeur : ${mood || "—"}
- Ma réflexion : "${String(reflection).replace(/<[^>]+>/g, " ").slice(0, 1500)}"
- Gratitudes : ${list(gratitude)} · Fiertés : ${list(pride)}

Rédige en français, en tutoyant, sans jargon :
- feedback : 2 ou 3 phrases (300 caractères maximum) qui disent honnêtement ce qui a marché et ce qui a freiné, en citant des éléments réels ;
- focusTomorrow : UNE action précise et réaliste pour demain (une phrase courte).
Ne culpabilise jamais. N'invente rien qui ne soit pas dans les données.`;
  return JSON.parse(await generate(ai, prompt, dailyReviewSchema) || "{}");
}

async function generateFromGoal(ai: GoogleGenAI, payload: any) {
  const { goal = "" } = payload || {};
  const prompt = `Crée une routine de performance sur Caddr. pour l'objectif suivant : "${goal}".
  Structure la réponse en blocs logiques (ex: Matin, Travail, Soir).
  Chaque bloc doit avoir un titre et une liste de 3 à 5 tâches concrètes.`;

  return JSON.parse(await generate(ai, prompt, routineArraySchema) || "[]");
}

async function extractFromImage(ai: GoogleGenAI, payload: any) {
  const { base64Image = "" } = payload || {};
  return JSON.parse(await generate(ai, {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
        {
          text:
            "Extrais les tâches de cette image pour l'application Caddr. et organise-les en blocs logiques avec des titres. Si c'est une liste simple, crée un bloc 'Import Image'.",
        },
      ],
    }, routineArraySchema) || "[]");
}


// --- Coach de la semaine ---
const weeklyCoachSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    wins: { type: Type.ARRAY, items: { type: Type.STRING } },
    watch: { type: Type.ARRAY, items: { type: Type.STRING } },
    actions: { type: Type.ARRAY, items: { type: Type.STRING } },
    focusNextWeek: { type: Type.STRING },
  },
  required: ["summary", "wins", "watch", "actions", "focusNextWeek"],
};

const clip = (v: unknown, n = 4000) => JSON.stringify(v ?? null).slice(0, n);

async function weeklyCoach(ai: GoogleGenAI, payload: any) {
  const prompt = `Tu es le coach bienveillant et exigeant de l'application de discipline Caddr.
Voici les données de ma semaine (JSON) : ${clip(payload, 6000)}

Rédige en français, en tutoyant, sans jargon :
- summary : 2 à 3 phrases qui résument honnêtement ma semaine (chiffres à l'appui) ;
- wins : 2 ou 3 réussites concrètes ;
- watch : 1 ou 2 points de vigilance (blocs ou jours faibles, tâches reportées) ;
- actions : exactement 3 actions précises et réalistes pour la semaine prochaine ;
- focusNextWeek : une phrase courte qui donne le cap.
Ne culpabilise jamais. Ne cite que des éléments présents dans les données.`;
  return JSON.parse(await generate(ai, prompt, weeklyCoachSchema) || "{}");
}

// --- Journée surchargée : proposition d'une version allégée ---
const lightenSchema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    postpone: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, reason: { type: Type.STRING } }, required: ["id", "reason"] } },
    reschedule: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, startTime: { type: Type.STRING } }, required: ["id", "startTime"] } },
  },
  required: ["summary", "postpone", "reschedule"],
};

async function lightenDay(ai: GoogleGenAI, payload: any) {
  const prompt = `Tu aides à alléger une journée trop chargée dans l'application Caddr.
Données (JSON) : ${clip(payload, 7000)}
"freeMinutes" est le temps disponible restant, "plannedMinutes" le temps des tâches restantes, "meetings" les rendez-vous fixes (intouchables).
Propose :
- postpone : les tâches à reporter (id + raison courte), en priorité les tâches de basse priorité, non habituelles et ponctuelles ; garde les habitudes et les priorités hautes ;
- reschedule : de nouvelles heures (HH:mm) pour supprimer les chevauchements, sans jamais toucher aux rendez-vous ;
- summary : une phrase en français, en tutoyant, qui explique la logique.
N'utilise que des id présents dans les données. Reporte le minimum nécessaire pour que la journée tienne dans le temps disponible.`;
  return JSON.parse(await generate(ai, prompt, lightenSchema) || "{}");
}

const HANDLERS: Record<string, (ai: GoogleGenAI, payload: any) => Promise<unknown>> = {
  weeklyCoach,
  lightenDay,
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
    return json({ error: "rate", message: "Trop de requêtes, réessaie dans un instant." }, 429);
  }

  // Réservé aux utilisateurs connectés : sans jeton Firebase valide, personne ne
  // peut consommer le quota Gemini (même en appelant la fonction hors du navigateur).
  const user = await verifyFirebaseToken(req);
  if (!user) {
    return json({ error: "auth", message: "Connecte-toi à ton compte pour utiliser l'IA." }, 401);
  }

  if (!API_KEY) {
    // Erreur de config serveur : la variable GEMINI_API_KEY n'est pas définie sur Netlify.
    return json({ error: "config", message: "IA non configurée : la variable GEMINI_API_KEY manque sur Netlify." }, 500);
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

  const quota = await consumeDailyQuota("gemini", user.uid, DAILY_MAX);
  if (!quota.ok) {
    return json({ error: "quota", message: `Limite quotidienne atteinte (${DAILY_MAX} demandes à l'IA). Réessaie demain.` }, 429);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const data = await handler(ai, payload);
    return json({ data });
  } catch (error) {
    console.error(`Gemini action "${action}" failed:`, error);
    // On renvoie null comme donnée pour que le client conserve son comportement de repli.
    return json({ data: null, error: "upstream", message: "L'IA n'a pas répondu. Réessaie dans un instant." }, 502);
  }
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
