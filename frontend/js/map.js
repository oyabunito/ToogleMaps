// Vue d'ensemble de la tournée (Leaflet + tuiles OpenStreetMap, gratuit,
// sans clé). Pas de guidage turn-by-turn ici : juste une carte de contexte,
// la navigation réelle se fait via Waze/Google Maps (voir stopList.js).

const Map = (() => {
  const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

  let loadPromise = null;
  let map = null;
  let layerGroup = null;

  function loadLib() {
    if (window.L) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);

      const script = document.createElement("script");
      script.src = LEAFLET_JS;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Carte indisponible hors-ligne."));
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  async function ensureMap() {
    await loadLib();
    if (!map) {
      map = window.L.map("map");
      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      layerGroup = window.L.layerGroup().addTo(map);
    }
    return map;
  }

  async function render(stops, start) {
    try {
      await ensureMap();
    } catch (e) {
      return; // pas de réseau : on garde juste la liste des arrêts
    }
    layerGroup.clearLayers();
    const points = [];

    if (start && start.lat && start.lon) {
      window.L.marker([start.lat, start.lon], {
        title: "Départ",
      })
        .bindPopup("Départ")
        .addTo(layerGroup);
      points.push([start.lat, start.lon]);
    }

    stops.forEach((s, i) => {
      if (s.lat == null || s.lon == null) return;
      const color = s.status === "delivered" ? "#34d399" : s.status === "failed" ? "#f87171" : "#38bdf8";
      const icon = window.L.divIcon({
        className: "",
        html: `<div style="background:${color};color:#06202f;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font:bold 12px sans-serif;border:2px solid #0f172a;">${i + 1}</div>`,
      });
      window.L.marker([s.lat, s.lon], { icon }).bindPopup(s.address).addTo(layerGroup);
      points.push([s.lat, s.lon]);
    });

    if (points.length) {
      window.L.polyline(points, { color: "#38bdf8", weight: 3, opacity: 0.6 }).addTo(layerGroup);
      map.fitBounds(points, { padding: [24, 24] });
    }
  }

  function clear() {
    if (layerGroup) layerGroup.clearLayers();
  }

  return { render, clear };
})();
