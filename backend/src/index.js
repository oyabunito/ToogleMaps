// Backend ToogleMaps (Cloudflare Worker).
//
// Rôle : proxy minimal vers OpenRouteService (ORS) pour ne jamais exposer
// la clé API côté client, et orchestrer géocodage + optimisation de
// tournée (VROOM, via l'endpoint /optimization d'ORS) pour un livreur avec
// potentiellement 60+ arrêts.
//
// Routes :
//   GET  /health              -> { ok: true }
//   POST /geocode  {query}    -> { suggestions: [{label, lat, lon}] }
//   POST /optimize {addresses, start} -> { ordered: [...], failed: [...] }
//
// À VÉRIFIER au moment du déploiement dans la doc ORS (peut évoluer) :
// limites du plan gratuit (requêtes/jour, nb max de "jobs" par appel
// /optimization). Si le nombre d'arrêts dépasse la limite ORS, il faudra
// batcher les appels ou augmenter de plan.

const ORS_BASE = "https://api.openrouteservice.org";
const MAX_ADDRESSES = 100;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

async function geocodeAutocomplete(text, env) {
  const url = `${ORS_BASE}/geocode/autocomplete?api_key=${encodeURIComponent(env.ORS_API_KEY)}&text=${encodeURIComponent(text)}&size=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.features || []).map((f) => ({
    label: f.properties.label,
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
  }));
}

async function geocodeSearch(text, env) {
  const url = `${ORS_BASE}/geocode/search?api_key=${encodeURIComponent(env.ORS_API_KEY)}&text=${encodeURIComponent(text)}&size=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const feature = (data.features || [])[0];
  if (!feature) return null;
  return {
    label: feature.properties.label,
    lat: feature.geometry.coordinates[1],
    lon: feature.geometry.coordinates[0],
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function handleGeocode(request, env) {
  const body = await request.json().catch(() => ({}));
  const query = (body.query || "").trim();
  if (query.length < 3) return json({ suggestions: [] }, 200, env);
  const suggestions = await geocodeAutocomplete(query, env);
  return json({ suggestions }, 200, env);
}

async function handleOptimize(request, env) {
  const body = await request.json().catch(() => ({}));
  const addresses = Array.isArray(body.addresses) ? body.addresses.filter((a) => typeof a === "string" && a.trim()) : [];
  if (!addresses.length) return json({ error: "Aucune adresse fournie." }, 400, env);
  if (addresses.length > MAX_ADDRESSES) {
    return json({ error: `Trop d'arrêts (max ${MAX_ADDRESSES} par tournée).` }, 400, env);
  }

  // 1. Résoudre le point de départ (coordonnées directes, ou adresse à géocoder).
  let start = body.start;
  if (start && typeof start === "string" && start.trim()) {
    const resolved = await geocodeSearch(start.trim(), env);
    if (!resolved) return json({ error: "Point de départ introuvable." }, 400, env);
    start = { lat: resolved.lat, lon: resolved.lon };
  }
  if (!start || typeof start.lat !== "number" || typeof start.lon !== "number") {
    return json({ error: "Point de départ manquant ou invalide." }, 400, env);
  }

  // 2. Géocoder chaque adresse. Séquentiel + petite pause pour rester sous
  // la limite de requêtes/minute du plan gratuit ORS avec 60+ arrêts.
  const geocoded = []; // { originalIndex, address, lat, lon }
  const failed = [];
  for (let i = 0; i < addresses.length; i++) {
    const text = addresses[i].trim();
    const result = await geocodeSearch(text, env);
    if (result) {
      geocoded.push({ originalIndex: i, address: text, lat: result.lat, lon: result.lon });
    } else {
      failed.push(text);
    }
    if (i < addresses.length - 1) await sleep(150);
  }

  if (!geocoded.length) {
    return json({ ordered: [], failed }, 200, env);
  }

  // 3. Optimisation VROOM : un seul véhicule, départ fixé, pas de retour
  // forcé au dépôt (tournée "en ligne", pas un aller-retour).
  const jobs = geocoded.map((g, idx) => ({
    id: idx + 1,
    location: [g.lon, g.lat],
  }));
  const vehicles = [
    {
      id: 1,
      profile: "driving-car",
      start: [start.lon, start.lat],
    },
  ];

  const orsRes = await fetch(`${ORS_BASE}/optimization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: env.ORS_API_KEY,
    },
    body: JSON.stringify({ jobs, vehicles }),
  });

  if (!orsRes.ok) {
    const errText = await orsRes.text().catch(() => "");
    return json({ error: `Échec de l'optimisation ORS : ${errText || orsRes.statusText}` }, 502, env);
  }

  const orsData = await orsRes.json();
  const route = (orsData.routes || [])[0];
  if (!route) {
    return json({ error: "ORS n'a renvoyé aucun itinéraire." }, 502, env);
  }

  const ordered = route.steps
    .filter((step) => step.type === "job")
    .map((step) => {
      const g = geocoded[step.id - 1];
      return { address: g.address, lat: g.lat, lon: g.lon, originalIndex: g.originalIndex };
    });

  return json({ ordered, failed }, 200, env);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    if (url.pathname === "/health") {
      return json({ ok: true }, 200, env);
    }

    if (!env.ORS_API_KEY) {
      return json({ error: "Clé ORS_API_KEY non configurée sur le Worker." }, 500, env);
    }

    try {
      if (url.pathname === "/geocode" && request.method === "POST") {
        return await handleGeocode(request, env);
      }
      if (url.pathname === "/optimize" && request.method === "POST") {
        return await handleOptimize(request, env);
      }
    } catch (e) {
      return json({ error: "Erreur interne : " + e.message }, 500, env);
    }

    return json({ error: "Route inconnue." }, 404, env);
  },
};
