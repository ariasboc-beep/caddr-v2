// Assistant Claude intégré à Caddr.
// Le navigateur envoie la conversation + le contexte (état de l'app) ; cette fonction
// appelle l'API Claude avec la liste des outils. Les outils sont exécutés dans l'app
// (les données y vivent), qui renvoie ensuite les résultats pour la suite de la réponse.
// La clé ANTHROPIC_API_KEY reste côté serveur. Réservé aux comptes connectés + quota.
import { verifyFirebaseToken, consumeDailyQuota } from "../lib/auth.mts";
import { ASSISTANT_TOOLS, ASSISTANT_SYSTEM } from "../../src/assistant/schema.ts";

const API_KEY = process.env.ANTHROPIC_API_KEY || "";
const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
const DAILY_MAX = Number(process.env.ASSISTANT_DAILY_LIMIT || 150); // appels API par utilisateur et par jour
const MAX_BODY = 400_000;

const json = (obj: unknown, status = 200) => new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async (req: Request) => {
  if (req.method !== "POST") return json({ message: "Méthode non autorisée." }, 405);

  const allowed = (process.env.ALLOWED_ORIGINS || "https://caddr-v2.netlify.app,http://localhost:5173,http://localhost:8888,http://localhost:4173").split(",").map(o => o.trim());
  const origin = req.headers.get("origin");
  if (origin && !allowed.includes(origin)) return json({ message: "Origine refusée." }, 403);

  const user = await verifyFirebaseToken(req);
  if (!user) return json({ error: "auth", message: "Connecte-toi à ton compte pour parler à l'assistant." }, 401);
  if (!API_KEY) return json({ error: "config", message: "Assistant non configuré : ajoute la variable ANTHROPIC_API_KEY sur Netlify (voir ASSISTANT_SETUP.md)." }, 500);

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BODY) return json({ message: "Conversation trop longue : commence une nouvelle discussion." }, 413);

  let body: any;
  try { body = await req.json(); } catch { return json({ message: "Requête invalide." }, 400); }
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  const context = typeof body?.context === "string" ? body.context.slice(0, 30000) : "";
  if (!messages || !messages.length || messages.length > 60) return json({ message: "Conversation invalide." }, 400);
  // Seuls les rôles et types de contenu attendus passent
  const okBlock = (b: any) => b && ["text", "tool_use", "tool_result"].includes(b.type);
  if (!messages.every((m: any) => (m.role === "user" || m.role === "assistant") && (typeof m.content === "string" || (Array.isArray(m.content) && m.content.every(okBlock))))) {
    return json({ message: "Conversation invalide." }, 400);
  }

  const quota = await consumeDailyQuota("assistant", user.uid, DAILY_MAX);
  if (!quota.ok) return json({ error: "quota", message: "Limite quotidienne de l'assistant atteinte. Réessaie demain." }, 429);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        // Partie fixe (consignes + outils) mise en cache ; le contexte change à chaque message
        system: [
          { type: "text", text: ASSISTANT_SYSTEM, cache_control: { type: "ephemeral" } },
          { type: "text", text: `ÉTAT ACTUEL DE CADDR (données de l'utilisateur) :\n${context}` },
        ],
        tools: ASSISTANT_TOOLS,
        messages,
      }),
    });
    const data: any = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("Claude API error", res.status, data?.error?.message);
      const msg = res.status === 401 ? "Clé ANTHROPIC_API_KEY invalide." : res.status === 429 ? "L'assistant est très sollicité, réessaie dans un instant." : res.status === 529 ? "Le service Claude est surchargé, réessaie dans un instant." : "L'assistant n'a pas pu répondre.";
      return json({ message: msg }, 502);
    }
    return json({ content: data.content, stop_reason: data.stop_reason, usage: data.usage });
  } catch (e) {
    console.error("Assistant failed", e);
    return json({ message: "Impossible de joindre l'assistant." }, 504);
  }
};
