// Saisie manuelle + autocomplete + branchement OCR/dictée sur le même
// champ éditable. Rien n'est jamais ajouté silencieusement : l'OCR et la
// dictée ne font que pré-remplir le champ, le livreur valide avant d'ajouter.

const AddAddress = (() => {
  const input = document.getElementById("address-input");
  const suggestionsBox = document.getElementById("suggestions");
  const addBtn = document.getElementById("add-btn");
  const micBtn = document.getElementById("mic-btn");
  const scanBtn = document.getElementById("scan-btn");
  const scanInput = document.getElementById("scan-input");
  const ocrStatus = document.getElementById("ocr-status");
  const startInput = document.getElementById("start-input");
  const draftListEl = document.getElementById("draft-list");
  const draftEmptyEl = document.getElementById("draft-empty");
  const draftCountEl = document.getElementById("draft-count");

  let selectedSuggestion = null; // { label, lat, lon } si l'utilisateur a choisi une suggestion
  let debounceTimer = null;
  let recognition = null;

  function hideSuggestions() {
    suggestionsBox.hidden = true;
    suggestionsBox.innerHTML = "";
  }

  function showSuggestions(list) {
    if (!list.length) return hideSuggestions();
    suggestionsBox.innerHTML = "";
    list.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = s.label;
      btn.addEventListener("click", () => {
        input.value = s.label;
        selectedSuggestion = s;
        hideSuggestions();
      });
      suggestionsBox.appendChild(btn);
    });
    suggestionsBox.hidden = false;
  }

  input.addEventListener("input", () => {
    selectedSuggestion = null;
    clearTimeout(debounceTimer);
    const query = input.value;
    debounceTimer = setTimeout(async () => {
      try {
        const results = await Api.geocode(query);
        showSuggestions(results);
      } catch (e) {
        // Pas de réseau ou backend indisponible : pas grave, l'ajout
        // manuel fonctionne quand même, le géocodage se refera à l'optimisation.
        hideSuggestions();
      }
    }, 350);
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".input-row")) hideSuggestions();
  });

  async function refreshDraftList() {
    const addresses = await Storage.getDraft();
    draftListEl.innerHTML = "";
    draftCountEl.textContent = addresses.length;
    draftEmptyEl.hidden = addresses.length > 0;
    addresses.forEach((a) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = a.text;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", async () => {
        await Storage.removeDraftAddress(a.id);
        refreshDraftList();
      });
      li.appendChild(span);
      li.appendChild(removeBtn);
      draftListEl.appendChild(li);
    });
  }

  async function addCurrentInput() {
    const text = input.value.trim();
    if (!text) return;
    const addresses = await Storage.getDraft();
    addresses.push({
      id: crypto.randomUUID(),
      text,
      lat: selectedSuggestion ? selectedSuggestion.lat : undefined,
      lon: selectedSuggestion ? selectedSuggestion.lon : undefined,
    });
    await Storage.saveDraft(addresses, await Storage.getDraftStart());
    input.value = "";
    selectedSuggestion = null;
    hideSuggestions();
    await refreshDraftList();
    input.focus();
  }

  addBtn.addEventListener("click", addCurrentInput);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCurrentInput();
    }
  });

  // --- Dictée vocale ---

  micBtn.addEventListener("click", () => {
    if (recognition) {
      recognition.stop();
      return;
    }
    if (!Speech.isSupported()) {
      App.toast("Dictée vocale non supportée sur ce navigateur.");
      return;
    }
    micBtn.classList.add("recording");
    recognition = Speech.start(
      (text) => {
        input.value = text;
      },
      () => {
        recognition = null;
        micBtn.classList.remove("recording");
      },
      (err) => {
        recognition = null;
        micBtn.classList.remove("recording");
        App.toast("Erreur dictée : " + err);
      }
    );
  });

  // --- Scan OCR ---

  scanBtn.addEventListener("click", () => scanInput.click());

  scanInput.addEventListener("change", async () => {
    const file = scanInput.files[0];
    scanInput.value = "";
    if (!file) return;
    ocrStatus.hidden = false;
    ocrStatus.textContent = "Lecture de l'étiquette…";
    try {
      const text = await Ocr.recognize(file, (status, progress) => {
        ocrStatus.textContent = `${status}… ${Math.round((progress || 0) * 100)}%`;
      });
      // Le texte OCR est brut : on le met dans le champ pour correction
      // manuelle avant ajout, jamais ajouté directement.
      input.value = text.replace(/\n+/g, ", ");
      ocrStatus.textContent = "Vérifie/corrige l'adresse détectée avant d'ajouter.";
      input.focus();
    } catch (e) {
      ocrStatus.textContent = "Échec de la lecture : " + e.message;
    }
  });

  // --- Point de départ ---

  startInput.addEventListener("change", () => {
    Storage.setDraftStart(startInput.value.trim());
  });

  async function init() {
    startInput.value = await Storage.getDraftStart();
    await refreshDraftList();
  }

  return { init, refreshDraftList };
})();
