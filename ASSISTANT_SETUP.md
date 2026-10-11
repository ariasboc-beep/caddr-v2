# Cady (assistante propulsée par Claude) dans Caddr : mise en service

L'assistant appelle l'API Claude depuis la fonction Netlify `netlify/functions/assistant.mts`.
La clé reste côté serveur : elle n'est jamais envoyée au navigateur.

## 1. Créer une clé API Claude
1. Va sur https://console.anthropic.com (compte distinct de l'abonnement Claude.ai).
2. Ajoute des crédits prépayés (Billing).
3. Settings → API keys → « Create key ». Copie la clé (elle commence par `sk-ant-`).

## 2. L'ajouter sur Netlify
Netlify → ton site → Site configuration → Environment variables → Add a variable :

| Variable | Valeur | Obligatoire |
|---|---|---|
| `ANTHROPIC_API_KEY` | la clé copiée | oui |
| `ANTHROPIC_MODEL` | `claude-sonnet-5-5` (par défaut) ou `claude-haiku-5-5` (moins cher) | non |
| `ASSISTANT_DAILY_LIMIT` | nombre d'appels par jour et par compte (150 par défaut) | non |

Puis redéploie le site.

## 3. Sécurité et coût
- Réservé aux comptes connectés (jeton Firebase vérifié) + quota quotidien par compte.
- Coût indicatif avec Sonnet 5.5 (2 $ / 10 $ par million de jetons en entrée / sortie) : quelques centimes de dollar par demande.
- Chaque série de changements faite par l'assistant peut être annulée dans la discussion.
