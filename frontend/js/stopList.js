// Liste ordonnée des arrêts de la tournée : statut livré/échec/note, et
// bouton "Naviguer" qui délègue la navigation réelle à Waze/Google Maps
// (on ne réimplémente pas de guidage turn-by-turn ici).

const StopList = (() => {
  const stopListEl = document.getElementById("stop-list");
  const routeEmptyEl = document.getElementById("route-empty");
  const failedCard = document.getElementById("failed-card");
  const failedListEl = document.getElementById("failed-list");

  function wazeUrl(lat, lon) {
    return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`;
  }

  function googleMapsUrl(lat, lon) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  }

  function renderFailed(failed) {
    failedListEl.innerHTML = "";
    if (!failed || !failed.length) {
      failedCard.hidden = true;
      return;
    }
    failedCard.hidden = false;
    failed.forEach((text) => {
      const li = document.createElement("li");
      const span = document.createElement("span");
      span.textContent = text;
      const retryBtn = document.createElement("button");
      retryBtn.type = "button";
      retryBtn.textContent = "✎";
      retryBtn.title = "Corriger dans l'onglet Adresses";
      retryBtn.addEventListener("click", async () => {
        await Storage.addDraftAddress(text);
        App.showView("add");
        App.toast("Adresse ajoutée au brouillon, corrige-la puis relance l'optimisation.");
      });
      li.appendChild(span);
      li.appendChild(retryBtn);
      failedListEl.appendChild(li);
    });
  }

  async function render() {
    const route = await Storage.getTodayRoute();
    stopListEl.innerHTML = "";

    if (!route || !route.stops || !route.stops.length) {
      routeEmptyEl.hidden = false;
      renderFailed(route ? route.failed : []);
      Map.clear();
      return;
    }
    routeEmptyEl.hidden = true;
    renderFailed(route.failed);

    route.stops.forEach((stop, i) => {
      const li = document.createElement("li");
      li.className = "stop " + stop.status;

      const header = document.createElement("div");
      header.className = "stop-header";

      const badge = document.createElement("span");
      badge.className = "stop-badge";
      badge.textContent = String(i + 1);

      const addr = document.createElement("span");
      addr.className = "stop-address";
      addr.textContent = stop.address;

      const pill = document.createElement("span");
      pill.className = "status-pill";
      pill.textContent =
        stop.status === "delivered" ? "Livré" : stop.status === "failed" ? "Échec" : "En attente";

      header.appendChild(badge);
      header.appendChild(addr);
      header.appendChild(pill);

      const actions = document.createElement("div");
      actions.className = "stop-actions";

      const wazeBtn = document.createElement("a");
      wazeBtn.className = "btn secondary small";
      wazeBtn.textContent = "🧭 Waze";
      wazeBtn.href = wazeUrl(stop.lat, stop.lon);
      wazeBtn.target = "_blank";
      wazeBtn.rel = "noopener";

      const mapsBtn = document.createElement("a");
      mapsBtn.className = "btn secondary small";
      mapsBtn.textContent = "📍 Maps";
      mapsBtn.href = googleMapsUrl(stop.lat, stop.lon);
      mapsBtn.target = "_blank";
      mapsBtn.rel = "noopener";

      const deliveredBtn = document.createElement("button");
      deliveredBtn.type = "button";
      deliveredBtn.className = "btn small";
      deliveredBtn.textContent = "✔ Livré";
      deliveredBtn.addEventListener("click", async () => {
        await Storage.updateStopStatus(route.date, stop.id, "delivered");
        render();
      });

      const failedBtn = document.createElement("button");
      failedBtn.type = "button";
      failedBtn.className = "btn secondary small";
      failedBtn.textContent = "✕ Échec";
      failedBtn.addEventListener("click", async () => {
        const note = prompt("Raison de l'échec (optionnel) :", stop.note || "");
        await Storage.updateStopStatus(route.date, stop.id, "failed", note || "");
        render();
      });

      actions.appendChild(wazeBtn);
      actions.appendChild(mapsBtn);
      actions.appendChild(deliveredBtn);
      actions.appendChild(failedBtn);

      li.appendChild(header);
      li.appendChild(actions);

      if (stop.note) {
        const note = document.createElement("span");
        note.className = "field-label";
        note.textContent = "Note : " + stop.note;
        li.appendChild(note);
      }

      stopListEl.appendChild(li);
    });

    Map.render(route.stops, route.start);
  }

  return { render };
})();
