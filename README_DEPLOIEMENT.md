# Caddr. v2 — Déploiement

## Contenu de ce paquet
Code source complet et prêt à déployer. **Aucun** dossier `node_modules`,
`dist` ou `release` n'est inclus : ils sont régénérés automatiquement au build.

## Mise en ligne (Netlify via GitHub)

Le déploiement est automatique : chaque `git push` déclenche un build Netlify.

```bash
# 1. Se placer dans le dépôt local
cd caddr-v2

# 2. Vérifier que tout compile
npm install
npm run build

# 3. Envoyer sur GitHub -> déclenche le déploiement Netlify
git add .
git commit -m "Mise a jour Caddr v2"
git push
```

Puis sur app.netlify.com -> projet **caddr-v2** -> onglet **Deploys**,
attendre le statut **Published** (1 a 3 min).

## ⚠️ Variable d'environnement (obligatoire pour l'IA)

Dans Netlify -> Project configuration -> Environment variables :

- Nom : `GEMINI_API_KEY`  (SANS le prefixe VITE_)
- Valeur : votre cle Google Gemini (de preference regeneree)

Le prefixe `VITE_` exposerait la cle dans le navigateur : ne pas l'utiliser.

## Configuration de build (deja dans netlify.toml)
- Commande : `npm install && npm run build`
- Dossier publie : `dist`
- Fonctions : `netlify/functions`

## Version bureau (optionnel, hors deploiement web)
```bash
npm run desktop      # lancer l'app de bureau
npm run dist:win     # generer l'installeur Windows (.exe)
npm run dist:mac     # generer le .dmg macOS
npm run dist:linux   # generer l'AppImage Linux
```
