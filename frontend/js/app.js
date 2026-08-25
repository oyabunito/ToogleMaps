// App shell : navigation entre les deux vues, toasts, et orchestration de
// l'optimisation de tournée.

const App = (() => {
  const tabAdd = document.getElementById("tab-add");
  const tabRoute = document.getElementById("tab-route");
  const viewAdd = document.getElementById("view-add");
  const viewRoute = document.getElementById("view-route");
  const optimizeBtn = document.getElementById("optimize-btn");
  const toastEl = document.getElementById("toast");

  let toastTimer = null;

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3500);
  }

  function showView(name) {
    const isAdd = name === "add";
    viewAdd.classList.toggle("active", isAdd);
    viewRoute.classList.toggle("active", !isAdd);
    tabAdd.classList.toggle("active", isAdd);
    tabRoute.classList.toggle("active", !isAdd);
    if (!isAdd) StopList.render();
  }

  tabAdd.addEventListener("click", () => showView("add"));
  tabRoute.addEventListener("click", () => showView("route"));

  function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) return reject(new Error("Géolocalisation non disponible."));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  async function resolveStart() {
    const startText = (await Storage.getDraftStart()).trim();
    if (startText) return startText; // le backend géocodera cette adresse
    try {
      return await getCurrentPosition();
    } catch (e) {
      throw new Error(
        "Impossible d'obtenir ta position et aucune adresse de départ saisie. " +
          "Renseigne un point de départ ou active la géolocalisation."
      );
    }
  }

  async function runOptimize() {
    const draft = await Storage.getDraft();
    if (!draft.length) {
      toast("Ajoute au moins une adresse avant d'optimiser.");
      return;
    }
    optimizeBtn.disabled = true;
    optimizeBtn.textContent = "Optimisation en cours…";
    try {
      const start = await resolveStart();
      const addresses = draft.map((a) => a.text);
      const result = await Api.optimize(addresses, start);

      const stops = result.ordered.map((o) => ({
        id: crypto.randomUUID(),
        address: o.address,
        lat: o.lat,
        lon: o.lon,
        originalIndex: o.originalIndex,
        status: "pending",
        note: "",
      }));

      const route = {
        date: Storage.todayKey(),
        start: typeof start === "object" ? start : null,
        startLabel: typeof start === "string" ? start : "Position actuelle",
        stops,
        failed: result.failed || [],
        computedAt: new Date().toISOString(),
      };

      await Storage.saveRoute(route);
      await Storage.clearDraft();
      await AddAddress.refreshDraftList();
      toast(`Tournée optimisée : ${stops.length} arrêt(s)${route.failed.length ? `, ${route.failed.length} à vérifier` : ""}.`);
      showView("route");
    } catch (e) {
      toast("Erreur : " + e.message);
    } finally {
      optimizeBtn.disabled = false;
      optimizeBtn.textContent = "Optimiser la tournée";
    }
  }

  optimizeBtn.addEventListener("click", runOptimize);

  async function init() {
    await AddAddress.init();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
  }

  init();

  return { showView, toast };
})();
