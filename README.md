# ToogleMaps

App PWA pour livreurs : ajoute tes adresses de livraison (saisie, dictée
vocale, ou scan d'étiquette) et fais calculer l'ordre de passage le plus
rapide pour toute ta tournée (même avec 60+ arrêts), façon Spoke/Circuit.

- Aucun compte Google : géocodage et optimisation via
  [OpenRouteService](https://openrouteservice.org) (gratuit, basé
  OpenStreetMap).
- Optimisation réelle (pas juste "à vol d'oiseau") via l'endpoint
  `/optimization` d'ORS, propulsé par
  [VROOM](https://github.com/VROOM-Project/vroom), un solveur fait pour
  résoudre "N arrêts, 1 véhicule, minimiser le temps total".
- Scan d'étiquette (OCR) et dictée vocale tournent 100% dans le
  navigateur (gratuit, pas d'appel réseau).
- La tournée du jour reste consultable et modifiable hors-ligne une fois
  calculée (IndexedDB + service worker).

## Structure

```
frontend/   PWA statique (HTML/CSS/JS, sans build) -> Cloudflare Pages
backend/    Cloudflare Worker (proxy vers OpenRouteService) -> Cloudflare Workers
```

## Déploiement (100% gratuit, sans carte bancaire)

### 1. Clé API OpenRouteService

1. Crée un compte gratuit sur https://openrouteservice.org/dev/#/signup
2. Génère une clé API (token) dans ton tableau de bord ORS.

### 2. Backend (Cloudflare Worker)

Prérequis : un compte Cloudflare gratuit, et `wrangler` (CLI Cloudflare) :

```bash
npm install -g wrangler
cd backend
wrangler login
wrangler secret put ORS_API_KEY   # colle ta clé ORS quand demandé
wrangler deploy
```

`wrangler deploy` affiche l'URL de ton Worker, du style
`https://tooglemaps-api.<ton-compte>.workers.dev`. Note-la.

Une fois le frontend déployé (étape 3), édite `backend/wrangler.toml` pour
remplacer `ALLOWED_ORIGIN = "*"` par l'URL exacte de ton frontend Pages
(ex. `https://tooglemaps.pages.dev`), puis relance `wrangler deploy` — ça
évite que d'autres sites consomment ton quota ORS.

### 3. Frontend (Cloudflare Pages)

Édite d'abord `frontend/js/config.js` et remplace la valeur de
`window.TOOGLEMAPS_API_BASE` par l'URL du Worker obtenue à l'étape 2.

Puis, dans le dashboard Cloudflare : Pages → Créer un projet → connecter
ce repo GitHub → dossier de build : `frontend` (pas de commande de build,
pas de dépendances). Ou en ligne de commande :

```bash
cd frontend
wrangler pages deploy .
```

### 4. Installer l'app sur ton téléphone

Ouvre l'URL Pages sur ton téléphone (Chrome/Android recommandé pour la
dictée vocale) puis "Ajouter à l'écran d'accueil" — l'app s'installe comme
une vraie application.

## Limitations connues (V1)

- Dictée vocale : bon support sur Android/Chrome, support faible/absent
  sur iOS/Safari (le bouton micro se masque automatiquement si non
  supporté).
- Limites du plan gratuit ORS (requêtes/jour, nb max de "jobs" par appel
  d'optimisation) à vérifier dans la doc ORS à jour : avec des tournées de
  60+ arrêts très fréquentes, il peut être nécessaire de batcher les
  appels ou de passer sur un plan payant ORS.
- Pas de guidage turn-by-turn intégré : le bouton "Naviguer" de chaque
  arrêt ouvre Waze ou Google Maps pour la conduite réelle.

## Développement local

```bash
cd backend && wrangler dev          # backend sur http://localhost:8787
cd frontend && python3 -m http.server 8000   # frontend sur http://localhost:8000
```

(`frontend/js/config.js` pointe par défaut sur `http://localhost:8787`.)
