/* scripts.js (vanilla)
   Objetivos:
   - Home: redirecionar busca para search.html com querystring
   - Home: renderizar curadoria (3 grupos)
   - Search: ler querystring, aplicar filtros + ordenar, renderizar cards
   - Property: ler id, renderizar detalhes + galeria + WhatsApp com mensagem pronta
   - Landing: renderizar lista reduzida por campanha
   - Contato: gerar mensagem e abrir WhatsApp
*/

(function () {
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function parseQS() {
    var qs = {};
    var s = window.location.search.replace("?", "");
    if (!s) return qs;
    s.split("&").forEach(function (p) {
      var parts = p.split("=");
      var k = decodeURIComponent(parts[0] || "");
      var v = decodeURIComponent((parts[1] || "").replace(/\+/g, " "));
      if (!k) return;
      qs[k] = v;
    });
    return qs;
  }

  function toNumber(v, fallback) {
    var n = Number(v);
    return isNaN(n) ? (fallback || 0) : n;
  }

  function formatMoneyBRL(n) {
    try {
      return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    } catch (e) {
      return "R$ " + String(n);
    }
  }

  function safeText(s) {
    return String(s == null ? "" : s)
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function getPropertyById(id) {
    return (window.PROPERTIES || []).find(function (p) { return p.id === id; }) || null;
  }

  function normalize(str) {
    return String(str || "")
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function includesLoose(hay, needle) {
    if (!needle) return true;
    return normalize(hay).indexOf(normalize(needle)) !== -1;
  }

  function hasAllSelectedFeatures(prop, selectedFeatures, selectedCondoFeatures) {
    // selectedFeatures e selectedCondoFeatures são arrays de strings
    var ok1 = selectedFeatures.every(function (f) {
      return (prop.features || []).indexOf(f) !== -1;
    });
    var ok2 = selectedCondoFeatures.every(function (f) {
      return (prop.condoFeatures || []).indexOf(f) !== -1;
    });
    return ok1 && ok2;
  }

  function sortProperties(list, sortKey) {
    var arr = list.slice();
    if (sortKey === "priceAsc") arr.sort(function (a,b){ return a.price - b.price; });
    else if (sortKey === "priceDesc") arr.sort(function (a,b){ return b.price - a.price; });
    else if (sortKey === "areaDesc") arr.sort(function (a,b){ return b.area - a.area; });
    else if (sortKey === "recent") arr.sort(function (a,b){ return String(b.createdAt).localeCompare(String(a.createdAt)); });
    else {
      // relevance: simples (mais suítes + vagas + área)
      arr.sort(function (a,b){
        var ra = (a.suites*3) + (a.parking*2) + (a.area/50);
        var rb = (b.suites*3) + (b.parking*2) + (b.area/50);
        return rb - ra;
      });
    }
    return arr;
  }

  function buildCard(prop) {
    var img = (prop.images && prop.images[0]) ? prop.images[0] : "";
    var price = formatMoneyBRL(prop.price);

    var pills = [
      prop.bedrooms + " dorm",
      prop.suites + " suítes",
      prop.parking + " vagas",
      prop.area + " m²"
    ];

    return '' +
      '<article class="card" aria-label="Imóvel ' + safeText(prop.id) + '">' +
        '<a href="property.html?id=' + encodeURIComponent(prop.id) + '" class="card-link" style="text-decoration:none">' +
          '<div class="card-media">' +
            '<span class="badge">' + safeText(prop.type) + '</span>' +
            '<img loading="lazy" src="' + safeText(img) + '" alt="Foto do imóvel ' + safeText(prop.id) + '" />' +
          '</div>' +
          '<div class="card-body">' +
            '<h3 class="card-title">' + safeText(prop.title) + '</h3>' +
            '<p class="card-meta">' + safeText(prop.neighborhood) + ' · ' + safeText(prop.city) + '</p>' +
            '<p class="card-price">' + safeText(price) + '</p>' +
            '<div class="card-pills">' +
              pills.map(function (t) { return '<span class="pill">' + safeText(t) + '</span>'; }).join("") +
            '</div>' +
            '<div class="card-actions" style="margin-top:10px">' +
              '<span class="btn btn-ghost" aria-hidden="true">Ver detalhes</span>' +
              '<span class="btn btn-primary" aria-hidden="true">Agendar</span>' +
            '</div>' +
          '</div>' +
        '</a>' +
      '</article>';
  }

  function setTabsBehavior() {
    var tabs = $all(".tab");
    if (!tabs.length) return;

    tabs.forEach(function (btn) {
      btn.addEventListener("click", function () {
        tabs.forEach(function (t) { t.classList.remove("is-active"); t.setAttribute("aria-selected", "false"); });
        btn.classList.add("is-active");
        btn.setAttribute("aria-selected", "true");
        renderCuradoria(btn.getAttribute("data-curadoria"));
      });
    });
  }

  function renderCuradoria(kind) {
    var grid = $("#curadoriaGrid");
    if (!grid) return;

    var list = (window.PROPERTIES || []).slice();

    // Curadoria: regras simples para o MVP
    var filtered;
    if (kind === "condominio") {
      filtered = list.filter(function (p) {
        return (p.features || []).indexOf("Condomínio fechado") !== -1 || (p.features || []).indexOf("Portaria 24h") !== -1;
      });
    } else if (kind === "3quartos") {
      filtered = list.filter(function (p) { return p.bedrooms >= 3; });
    } else if (kind === "pronto") {
      filtered = list.filter(function (p) { return p.status === "Pronto para morar"; });
    } else {
      filtered = list;
    }

    filtered = sortProperties(filtered, "relevance").slice(0, 6);
    grid.innerHTML = filtered.map(buildCard).join("");
  }

  function wireHome() {
    var form = $("#homeSearchForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();

        var neighborhood = $("#qBairro").value || "";
        var type = $("#qTipo").value || "";
        var pricePreset = $("#qPreco").value || "600000-999999999";
        var bedroomsMin = $("#qDorms").value || "0";

        var parts = pricePreset.split("-");
        var priceMin = parts[0] || "600000";
        var priceMax = parts[1] || "999999999";

        var url =
          "search.html?neighborhood=" + encodeURIComponent(neighborhood) +
          "&type=" + encodeURIComponent(type) +
          "&priceMin=" + encodeURIComponent(priceMin) +
          "&priceMax=" + encodeURIComponent(priceMax) +
          "&bedroomsMin=" + encodeURIComponent(bedroomsMin);

        window.location.href = url;
      });
    }

    setTabsBehavior();
    renderCuradoria("condominio");
  }

  function wireSearch() {
    var form = $("#filtersForm");
    var moreBtn = $("#toggleMoreFilters");
    var moreBox = $("#moreFilters");
    var clearBtn = $("#clearFilters");

    if (moreBtn && moreBox) {
      moreBtn.addEventListener("click", function () {
        var isHidden = moreBox.hasAttribute("hidden");
        if (isHidden) moreBox.removeAttribute("hidden");
        else moreBox.setAttribute("hidden", "hidden");
      });
    }

    // Pré-preencher filtros a partir da querystring (ex.: vindo da Home)
    var qs = parseQS();
    if (form) {
      if (qs.type) $("#fType").value = qs.type;
      if (qs.neighborhood) $("#fNeighborhood").value = qs.neighborhood;
      if (qs.priceMin) $("#fPriceMin").value = qs.priceMin;
      if (qs.priceMax) $("#fPriceMax").value = qs.priceMax;
      if (qs.bedroomsMin) $("#fBedroomsMin").value = qs.bedroomsMin;
    }

    function readSelectedValues(name) {
      return $all('input[name="' + name + '"]:checked', form).map(function (el) { return el.value; });
    }

    function apply() {
      var type = $("#fType").value;
      var neighborhood = $("#fNeighborhood").value;

      var priceMin = toNumber($("#fPriceMin").value, 600000);
      var priceMax = toNumber($("#fPriceMax").value, 999999999);

      // regra do seu nicho: se usuário apagou e deixou vazio, ainda assim manter piso 600k
      if (!$("#fPriceMin").value) priceMin = 600000;

      var bedroomsMin = toNumber($("#fBedroomsMin").value, 0);
      var suitesMin = toNumber($("#fSuitesMin").value, 0);
      var parkingMin = toNumber($("#fParkingMin").value, 0);
      var areaMin = toNumber($("#fAreaMin").value, 0);

      var status = $("#fStatus").value;
      var sortKey = $("#fSort").value;

      var selectedFeatures = readSelectedValues("feature");
      var selectedCondoFeatures = readSelectedValues("condoFeature");

      var list = (window.PROPERTIES || []).slice();

      var filtered = list.filter(function (p) {
        if (type && p.type !== type) return false;
        if (neighborhood && !includesLoose(p.neighborhood, neighborhood)) return false;

        if (p.price < priceMin) return false;
        if (p.price > priceMax) return false;

        if (p.bedrooms < bedroomsMin) return false;
        if (p.suites < suitesMin) return false;
        if (p.parking < parkingMin) return false;
        if (p.area < areaMin) return false;

        if (status && p.status !== status) return false;

        if (!hasAllSelectedFeatures(p, selectedFeatures, selectedCondoFeatures)) return false;

        return true;
      });

      filtered = sortProperties(filtered, sortKey);

      renderResults(filtered);
    }

    function renderResults(list) {
      var grid = $("#resultsGrid");
      var count = $("#resultsCount");
      var empty = $("#resultsEmpty");

      if (!grid || !count || !empty) return;

      count.textContent = list.length + " imóvel(eis) encontrado(s)";
      grid.innerHTML = list.map(buildCard).join("");

      if (list.length === 0) empty.removeAttribute("hidden");
      else empty.setAttribute("hidden", "hidden");
    }

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        apply();
      });

      // UX: aplicar ao mudar (sem ficar “pesado”)
      form.addEventListener("change", function () {
        apply();
      });
    }

    if (clearBtn && form) {
      clearBtn.addEventListener("click", function () {
        form.reset();
        $("#fPriceMin").value = 600000;
        $("#fPriceMax").value = "";
        apply();
      });
    }

    apply();
  }

  function wireProperty() {
    var shell = $("#propertyShell");
    if (!shell) return;

    var qs = parseQS();
    var id = qs.id || "";
    var prop = getPropertyById(id);

    if (!prop) {
      shell.innerHTML = '<div class="box"><h2>Imóvel não encontrado</h2><p>Volte para a busca e tente novamente.</p><p><a class="btn btn-primary" href="search.html">Ir para a busca</a></p></div>';
      return;
    }

    // Monta mapa (placeholder) com base em lat/lng
    var mapSrc = "https://www.google.com/maps?q=" + encodeURIComponent(prop.lat + "," + prop.lng) + "&z=15&output=embed";

    shell.innerHTML =
      '<section class="property-top">' +
        '<div class="gallery" aria-label="Galeria de fotos">' +
          '<div class="gallery-main">' +
            '<img id="mainImg" loading="eager" src="' + safeText(prop.images[0]) + '" alt="Foto principal do imóvel ' + safeText(prop.id) + '">' +
            '<div class="gallery-controls" aria-label="Controles da galeria">' +
              '<button type="button" id="prevImg" aria-label="Foto anterior">◀</button>' +
              '<button type="button" id="nextImg" aria-label="Próxima foto">▶</button>' +
            '</div>' +
          '</div>' +
          '<div class="thumbs" id="thumbs"></div>' +
        '</div>' +

        '<div class="property-card" aria-label="Resumo do imóvel">' +
          '<h1 class="prop-title">' + safeText(prop.title) + '</h1>' +
          '<p class="prop-loc">' + safeText(prop.neighborhood) + ' · ' + safeText(prop.city) + '</p>' +
          '<p class="prop-price">' + safeText(formatMoneyBRL(prop.price)) + '</p>' +
          '<div class="prop-facts">' +
            '<span class="fact">' + safeText(prop.bedrooms) + ' dorm</span>' +
            '<span class="fact">' + safeText(prop.suites) + ' suítes</span>' +
            '<span class="fact">' + safeText(prop.parking) + ' vagas</span>' +
            '<span class="fact">' + safeText(prop.area) + ' m²</span>' +
          '</div>' +
          '<p class="prop-ids">Código do imóvel: <strong>' + safeText(prop.id) + '</strong> · Status: <strong>' + safeText(prop.status) + '</strong></p>' +
          '<div style="margin-top:12px;display:grid;gap:10px">' +
            '<div class="fact">Condomínio: ' + safeText(formatMoneyBRL(prop.condoFee)) + '</div>' +
            '<div class="fact">IPTU: ' + safeText(formatMoneyBRL(prop.iptu)) + '</div>' +
          '</div>' +
          '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap">' +
            '<a class="btn btn-primary" id="whatsTop" href="#" rel="noopener">Chamar no WhatsApp</a>' +
            '<a class="btn btn-ghost" href="contact.html">Agendar visita</a>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<section class="prop-sections">' +
        '<div class="box">' +
          '<h2>Diferenciais do imóvel</h2>' +
          (prop.features && prop.features.length ? '<ul class="list">' + prop.features.map(function (f) { return '<li>' + safeText(f) + '</li>'; }).join("") + '</ul>' : '<p>Sem diferenciais cadastrados.</p>') +
        '</div>' +
        '<div class="box">' +
          '<h2>Diferenciais do condomínio</h2>' +
          (prop.condoFeatures && prop.condoFeatures.length ? '<ul class="list">' + prop.condoFeatures.map(function (f) { return '<li>' + safeText(f) + '</li>'; }).join("") + '</ul>' : '<p>Não se aplica ou não informado.</p>') +
        '</div>' +
      '</section>' +

      '<section class="box" style="margin-top:12px">' +
        '<h2>Descrição</h2>' +
        '<p>Descrição ilustrativa do MVP. Em produção, use um texto completo e fiel ao imóvel, destacando conforto, planta, localização, escolas e pontos de interesse.</p>' +
      '</section>' +

      '<section class="map" aria-label="Mapa">' +
        '<iframe title="Mapa da região (aproximado)" loading="lazy" src="' + safeText(mapSrc) + '"></iframe>' +
      '</section>';

    // Galeria
    var currentIndex = 0;
    var mainImg = $("#mainImg");
    var thumbs = $("#thumbs");
    var prevBtn = $("#prevImg");
    var nextBtn = $("#nextImg");

    function renderThumbs() {
      thumbs.innerHTML = prop.images.map(function (src, idx) {
        var active = idx === currentIndex ? "thumb is-active" : "thumb";
        return (
          '<div class="' + active + '" data-idx="' + idx + '" role="button" tabindex="0" aria-label="Ver foto ' + (idx + 1) + '">' +
            '<img loading="lazy" src="' + safeText(src) + '" alt="Miniatura ' + (idx + 1) + '">' +
          '</div>'
        );
      }).join("");

      $all(".thumb", thumbs).forEach(function (t) {
        t.addEventListener("click", function () {
          var idx = toNumber(t.getAttribute("data-idx"), 0);
          setIndex(idx);
        });
        t.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            var idx = toNumber(t.getAttribute("data-idx"), 0);
            setIndex(idx);
          }
        });
      });
    }

    function setIndex(idx) {
      currentIndex = (idx + prop.images.length) % prop.images.length;
      mainImg.src = prop.images[currentIndex];
      renderThumbs();
    }

    if (prevBtn) prevBtn.addEventListener("click", function () { setIndex(currentIndex - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { setIndex(currentIndex + 1); });
    renderThumbs();

    // WhatsApp (mensagem com código)
    var phone = "5547999999999"; // Troque para o número real (DDD + número, só dígitos)
    var msg = "Olá! Tenho interesse no imóvel " + prop.id + " (" + prop.type + " em " + prop.neighborhood + "). Podemos agendar uma visita?";
    var waLink = "https://wa.me/" + phone + "?text=" + encodeURIComponent(msg);

    var w1 = $("#whatsBtn");
    var w2 = $("#whatsTop");
    if (w1) w1.href = waLink;
    if (w2) w2.href = waLink;
  }

  function wireLanding() {
    var grid = $("#landingGrid");
    if (!grid) return;

    var title = $("#landingTitle");
    var subtitle = $("#landingSubtitle");

    var qs = parseQS();
    var camp = qs.campanha || "premium";

    var list = (window.PROPERTIES || []).slice();

    var filtered = list;
    if (camp === "condominio") {
      filtered = list.filter(function (p) {
        return (p.features || []).indexOf("Condomínio fechado") !== -1 || (p.features || []).indexOf("Portaria 24h") !== -1;
      });
      if (title) title.textContent = "Casas em condomínio (seleção)";
      if (subtitle) subtitle.textContent = "Segurança e lazer para a família, com agendamento rápido.";
    } else if (camp === "3quartos") {
      filtered = list.filter(function (p) { return p.bedrooms >= 3; });
      if (title) title.textContent = "Imóveis com 3+ quartos (seleção)";
      if (subtitle) subtitle.textContent = "Mais espaço para sua família, com curadoria premium.";
    } else {
      if (title) title.textContent = "Seleção premium (Joinville)";
      if (subtitle) subtitle.textContent = "Lista reduzida para comparar e agendar visita.";
    }

    filtered = sortProperties(filtered, "relevance").slice(0, 20);
    grid.innerHTML = filtered.map(buildCard).join("");
  }

  function wireContact() {
    var form = $("#contactForm");
    if (!form) return;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      var name = $("#cName").value || "";
      var whats = $("#cWhats").value || "";
      var intent = $("#cIntent").value || "";
      var message = $("#cMessage").value || "";

      // Ajuste para o número real do atendimento
      var phone = "5547999999999";

      var text =
        "Olá! Meu nome é " + name + ".\n" +
        "WhatsApp: " + whats + "\n" +
        "Objetivo: " + intent + "\n" +
        (message ? ("Detalhes: " + message) : "");

      var link = "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
      window.open(link, "_blank");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Identifica página (sem depender de path exato, pois pode variar)
    var href = window.location.href;

    if (href.indexOf("index.html") !== -1 || href.endsWith("/") || href.indexOf("portal-imobiliario") !== -1 && href.indexOf(".html") === -1) {
      // Home
      if ($("#homeSearchForm") || $("#curadoriaGrid")) wireHome();
    }
    if (href.indexOf("search.html") !== -1) wireSearch();
    if (href.indexOf("property.html") !== -1) wireProperty();
    if (href.indexOf("landing.html") !== -1) wireLanding();
    if (href.indexOf("contact.html") !== -1) wireContact();
  });
})();