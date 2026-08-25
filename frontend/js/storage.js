// Stockage local (IndexedDB) : brouillon d'adresses + tournée du jour.
// Permet de consulter/modifier la tournée hors-ligne une fois calculée.

const Storage = (() => {
  const DB_NAME = "tooglemaps-db";
  const DB_VERSION = 1;
  const STORE_DRAFT = "draft";
  const STORE_ROUTES = "routes";

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_DRAFT)) {
          db.createObjectStore(STORE_DRAFT, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE_ROUTES)) {
          db.createObjectStore(STORE_ROUTES, { keyPath: "date" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function tx(storeName, mode) {
    const db = await openDB();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  // --- Brouillon (liste d'adresses avant optimisation) ---

  async function getDraft() {
    const store = await tx(STORE_DRAFT, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.get("current");
      req.onsuccess = () => resolve(req.result ? req.result.addresses : []);
      req.onerror = () => reject(req.error);
    });
  }

  async function getDraftStart() {
    const store = await tx(STORE_DRAFT, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.get("current");
      req.onsuccess = () => resolve(req.result ? req.result.start || "" : "");
      req.onerror = () => reject(req.error);
    });
  }

  async function saveDraft(addresses, start) {
    const store = await tx(STORE_DRAFT, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put({ key: "current", addresses, start: start || "" });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function addDraftAddress(text) {
    const addresses = await getDraft();
    addresses.push({ id: crypto.randomUUID(), text });
    const start = await getDraftStart();
    await saveDraft(addresses, start);
    return addresses;
  }

  async function removeDraftAddress(id) {
    const addresses = (await getDraft()).filter((a) => a.id !== id);
    const start = await getDraftStart();
    await saveDraft(addresses, start);
    return addresses;
  }

  async function setDraftStart(start) {
    const addresses = await getDraft();
    await saveDraft(addresses, start);
  }

  async function clearDraft() {
    await saveDraft([], "");
  }

  // --- Tournée calculée (arrêts ordonnés + statuts) ---

  async function saveRoute(route) {
    const store = await tx(STORE_ROUTES, "readwrite");
    return new Promise((resolve, reject) => {
      const req = store.put(route);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function getRoute(date) {
    const store = await tx(STORE_ROUTES, "readonly");
    return new Promise((resolve, reject) => {
      const req = store.get(date);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getTodayRoute() {
    return getRoute(todayKey());
  }

  async function updateStopStatus(date, stopId, status, note) {
    const route = await getRoute(date);
    if (!route) return null;
    const stop = route.stops.find((s) => s.id === stopId);
    if (!stop) return route;
    stop.status = status;
    if (note !== undefined) stop.note = note;
    await saveRoute(route);
    return route;
  }

  return {
    todayKey,
    getDraft,
    getDraftStart,
    saveDraft,
    addDraftAddress,
    removeDraftAddress,
    setDraftStart,
    clearDraft,
    saveRoute,
    getRoute,
    getTodayRoute,
    updateStopStatus,
  };
})();
