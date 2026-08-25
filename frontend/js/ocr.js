// Scan d'étiquette (OCR) via Tesseract.js, 100% côté client, gratuit.
// La lib n'est chargée depuis le CDN qu'à la première utilisation, pour ne
// pas alourdir le chargement initial de l'app.

const Ocr = (() => {
  const CDN_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  let loadPromise = null;

  function loadLib() {
    if (window.Tesseract) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = CDN_URL;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Impossible de charger l'OCR (hors-ligne ?)."));
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  // file: File (photo prise via <input type="file" capture="environment">)
  // onProgress(status, progress 0..1)
  async function recognize(file, onProgress) {
    await loadLib();
    const { data } = await window.Tesseract.recognize(file, "fra", {
      logger: (m) => {
        if (onProgress) onProgress(m.status, m.progress);
      },
    });
    return data.text.trim();
  }

  return { recognize };
})();
