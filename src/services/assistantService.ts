// Appel de l'assistant Claude (fonction serveur netlify/functions/assistant.mts)
import { auth } from '../firebase';

const PROD_SITE = 'https://caddr-v2.netlify.app';
const IS_DESKTOP = typeof window !== 'undefined' && !window.location.protocol.startsWith('http');
const ENDPOINT = (IS_DESKTOP ? PROD_SITE : '') + '/.netlify/functions/assistant';

export type ApiBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
export interface ApiMessage { role: 'user' | 'assistant'; content: string | ApiBlock[] }
export interface AssistantReply { content: ApiBlock[]; stop_reason: string }

// Tests en local uniquement (jamais en production) : permet de simuler l'assistant sans compte
export const devAssistant = () => { try { return typeof window !== 'undefined' && window.location.hostname === 'localhost' && localStorage.getItem('caddr_dev_assistant') === '1'; } catch { return false; } };

export async function callAssistant(messages: ApiMessage[], context: string): Promise<AssistantReply> {
  const user = auth.currentUser;
  if (!user && !devAssistant()) throw new Error("Connecte-toi à ton compte pour parler à l'assistant.");
  const token = user ? await user.getIdToken() : 'dev';
  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ messages, context }) });
  } catch {
    throw new Error('Pas de connexion internet : réessaie quand tu seras en ligne.');
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message || "L'assistant est indisponible pour le moment.");
  return json as AssistantReply;
}
