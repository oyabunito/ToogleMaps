// Appels vers le backend (Cloudflare Worker) : géocodage + optimisation.
// Le backend garde la clé OpenRouteService secrète, jamais exposée ici.

const Api = (() => {
  const BASE = window.TOOGLEMAPS_API_BASE || "";

  async function request(path, body) {
    const res = await fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Erreur backend (${res.status}) : ${text || res.statusText}`);
    }
    return res.json();
  }

  // -> [{ label, lat, lon }]
  function geocode(query) {
    if (!query || query.trim().length < 3) return Promise.resolve([]);
    return request("/geocode", { query }).then((data) => data.suggestions || []);
  }

  // addresses: string[]
  // start: { lat, lon } | string | null (null = position GPS gérée côté front)
  // -> { ordered: [{address, lat, lon, originalIndex}], failed: string[] }
  function optimize(addresses, start) {
    return request("/optimize", { addresses, start });
  }

  return { geocode, optimize };
})();
