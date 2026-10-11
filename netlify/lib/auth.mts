// Vérification des jetons de connexion Firebase côté serveur (sans firebase-admin).
// Le navigateur envoie « Authorization: Bearer <jeton> » ; on vérifie la signature
// avec les clés publiques de Google, l'émetteur et l'audience du projet Caddr.
import { createRemoteJWKSet, jwtVerify } from "jose";

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "caddr-b0a5f";
const JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export interface VerifiedUser { uid: string; email?: string }

export async function verifyFirebaseToken(req: Request): Promise<VerifiedUser | null> {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  try {
    const { payload } = await jwtVerify(m[1], JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
      algorithms: ["RS256"],
    });
    if (!payload.sub) return null;
    return { uid: String(payload.sub), email: typeof payload.email === "string" ? payload.email : undefined };
  } catch {
    return null;
  }
}

// Quota quotidien par utilisateur, stocké dans Netlify Blobs (persistant entre
// instances). Si le stockage n'est pas disponible, on ne bloque pas l'utilisateur.
export async function consumeDailyQuota(scope: string, uid: string, max: number): Promise<{ ok: boolean; used: number }> {
  try {
    const { getStore } = await import("@netlify/blobs");
    const store = getStore("quotas");
    const day = new Date().toISOString().slice(0, 10);
    const key = `${scope}/${day}/${uid}`;
    const used = Number((await store.get(key)) || 0);
    if (used >= max) return { ok: false, used };
    await store.set(key, String(used + 1));
    return { ok: true, used: used + 1 };
  } catch (e) {
    console.warn("Quota indisponible :", (e as Error)?.message);
    return { ok: true, used: 0 };
  }
}
