(function () {
  window.Pages = window.Pages || {};

  const STATUS_META = {
    covered: { label: "Gedekt", className: "status-badge success" },
    partial: { label: "Gedeeltelijk", className: "status-badge warning" },
    missing: { label: "Ontbreekt", className: "status-badge danger" },
  };

  const PROCESS_DATA = [
    {
      id: "create-transport-order",
      title: "Create Transport Order",
      requirement:
        "Aanmaken en wijzigen van transportopdrachten, inclusief doorbrenger en retouropdrachten in één flow, met zichtbaarheid in het planner-dashboard en e-mailnotificaties bij wijzigingen.",
      appSupport:
        "De module Nieuwe aanvraag voorziet in uitgebreide orderinvoer en de orders-tabel laat status, carrier en planning aanpassen. De planning- en routepagina visualiseren opdrachten. Er ontbreekt nog ondersteuning voor gecombineerde doorbreng-/retourstromen en automatische e-mailmeldingen.",
      status: "partial",
      improvements: [
        "Ondersteuning voor doorbrenger en retouropdrachten binnen één orderflow toevoegen.",
        "Automatische e-mailnotificaties bij aanmaak, wijziging en annulering configureren.",
      ],
    },
    {
      id: "create-transport-list",
      title: "Create Transport List (Rittenlijst & CMR)",
      requirement:
        "Geautomatiseerde generatie van rittenlijsten en CMR-documenten als PDF en distributie naar vooraf ingestelde e-maillijsten.",
      appSupport:
        "De huidige app biedt nog geen documentgeneratie of e-maildistributie voor rittenlijsten en CMR's.",
      status: "missing",
      improvements: [
        "PDF-export voor rittenlijsten en CMR-documenten ontwikkelen.",
        "Distributielijstbeheer en automatische verzending van documenten toevoegen.",
      ],
    },
    {
      id: "supporting-processes",
      title: "Overige ondersteunende processen",
      requirement:
        "Data Save, Customer Request, Manage Accounts, Manage Instructions, Service Notification en Overview Service Requests vanuit het serviceportaal.",
      appSupport:
        "Gebruikersbeheer is aanwezig via de pagina Gebruikers, maar overige serviceportaalprocessen en notificaties ontbreken nog.",
      status: "partial",
      improvements: [
        "Integratie met serviceportaal voor klantaanvragen en servicemeldingen bouwen.",
        "Beheer van instructies en taken voor serviceplanners toevoegen.",
        "Opslag van dashboardwijzigingen synchroniseren tussen serviceportaal en planner.",
      ],
    },
  ];

  const CORE_DATA = [
    {
      id: "core-transport-orders",
      title: "Transportopdrachten",
      requirement:
        "Invoer en wijziging van transportopdrachten met minimale dubbele registratie.",
      appSupport:
        "De app ondersteunt aanmaken en bijwerken via Nieuwe aanvraag en Orders, maar er is nog geen gecombineerde doorbreng-/retourflow of automatische synchronisatie tussen afdelingen.",
      status: "partial",
      improvements: [
        "Doorvoer van gecombineerde doorbreng-/retour-opdrachten vereenvoudigen.",
        "Automatische synchronisatie van orderupdates richting andere processen toevoegen.",
      ],
    },
    {
      id: "core-planning",
      title: "Planning",
      requirement: "Kanban-dashboard gecombineerd met kaartintegratie voor routeplanning.",
      appSupport:
        "Het planbord biedt Kanban-drag-and-drop en de routekaart visualiseert ritten, waarmee dit onderdeel functioneel wordt gedekt.",
      status: "covered",
      improvements: [],
    },
    {
      id: "core-documents",
      title: "Documenten",
      requirement: "Automatisch genereren en mailen van rittenlijsten en CMR in PDF.",
      appSupport:
        "Documentgeneratie ontbreekt nog; er zijn geen export- of verzendopties voor rittenlijsten en CMR's.",
      status: "missing",
      improvements: [
        "PDF-generator voor rittenlijsten en CMR koppelen aan planning en orders.",
        "Automatische e-maildistributie met beheerbare sjablonen toevoegen.",
      ],
    },
    {
      id: "core-validation",
      title: "Validatie",
      requirement: "Geautomatiseerde processen voor offertes, orderbevestigingen en leverweken.",
      appSupport:
        "Er is geen workflow-engine of validatieproces; controles en verzending verlopen handmatig buiten de app.",
      status: "missing",
      improvements: [
        "Workflows voor offerte- en ordervalidatie toevoegen met taken en notificaties.",
        "Integratie voor automatische leverweekvalidatie realiseren.",
      ],
    },
    {
      id: "core-matching",
      title: "Matching",
      requirement:
        "Automatische controle tussen orderbevestigingen en inkooporders met opvolgacties.",
      appSupport:
        "Het systeem biedt alleen handmatige statuswijziging; matching en opvolgacties ontbreken.",
      status: "missing",
      improvements: [
        "Matchingregels en automatische afsluiting bij geslaagde matches implementeren.",
        "Afhandelingsflow met verplicht commentaar bij no-match toevoegen.",
      ],
    },
    {
      id: "core-communication",
      title: "Communicatie",
      requirement: "Automatische e-mails naar klanten, leveranciers en interne medewerkers.",
      appSupport:
        "Notificaties zijn nog niet geautomatiseerd; communicatie gebeurt buiten de applicatie.",
      status: "missing",
      improvements: [
        "Configurabele e-mailtemplates en triggers voor klanten en leveranciers opzetten.",
        "In-app notificaties of taken voor interne medewerkers toevoegen.",
      ],
    },
    {
      id: "core-service-portal",
      title: "Serviceportaal",
      requirement: "Aanvragen, meldingen, accountbeheer en instructiebeheer vanuit één portaal.",
      appSupport:
        "Beheerders kunnen accounts beheren, maar er is geen klantgericht serviceportaal met meldingen en instructies.",
      status: "partial",
      improvements: [
        "Serviceportaal voor klanten lanceren met inzage en wijzigingsmogelijkheden.",
        "Module voor instructiebeheer en overzicht van servicemeldingen toevoegen.",
      ],
    },
  ];

  let pageRoot = null;
  const listeners = [];

  function getRoot() {
    return pageRoot || document;
  }

  function addListener(element, type, handler) {
    if (!element || typeof element.addEventListener !== "function") return;
    element.addEventListener(type, handler);
    listeners.push({ element, type, handler });
  }

  function removeListeners() {
    while (listeners.length) {
      const { element, type, handler } = listeners.pop();
      if (element && typeof element.removeEventListener === "function") {
        element.removeEventListener(type, handler);
      }
    }
  }

  function createProcessCard(item) {
    const article = document.createElement("article");
    article.className = "process-card";
    article.dataset.status = item.status;

    const header = document.createElement("header");
    header.className = "process-card-header";

    const title = document.createElement("h3");
    title.textContent = item.title;
    header.appendChild(title);

    const meta = STATUS_META[item.status] || STATUS_META.partial;
    const badge = document.createElement("span");
    badge.className = meta.className;
    badge.textContent = meta.label;
    header.appendChild(badge);

    article.appendChild(header);

    const requirement = document.createElement("p");
    requirement.className = "process-requirement";
    requirement.textContent = item.requirement;
    article.appendChild(requirement);

    const support = document.createElement("p");
    support.className = "process-support";
    support.textContent = item.appSupport;
    article.appendChild(support);

    if (Array.isArray(item.improvements) && item.improvements.length > 0) {
      const listTitle = document.createElement("h4");
      listTitle.textContent = "Aanvullende acties";
      article.appendChild(listTitle);

      const list = document.createElement("ul");
      list.className = "improvement-list";
      item.improvements.forEach((text) => {
        const li = document.createElement("li");
        li.textContent = text;
        list.appendChild(li);
      });
      article.appendChild(list);
    }

    return article;
  }

  function renderList(targetId, items) {
    const root = getRoot();
    const container = root.querySelector(`#${targetId}`);
    if (!container) return;
    container.innerHTML = "";
    items.forEach((item) => {
      container.appendChild(createProcessCard(item));
    });
  }

  function applyFilter(selectEl) {
    if (!selectEl) return;
    const targetId = selectEl.getAttribute("data-target");
    if (!targetId) return;
    const value = selectEl.value;
    const root = getRoot();
    const container = root.querySelector(`#${targetId}`);
    if (!container) return;
    const cards = container.querySelectorAll(".process-card");
    cards.forEach((card) => {
      if (value === "all") {
        card.hidden = false;
      } else {
        card.hidden = card.dataset.status !== value;
      }
    });
  }

  function setupFilters() {
    const root = getRoot();
    const filters = root.querySelectorAll(".status-filter");
    filters.forEach((filter) => {
      addListener(filter, "change", () => applyFilter(filter));
      applyFilter(filter);
    });
  }

  function renderActions(items) {
    const root = getRoot();
    const actionList = root.querySelector("#actionList");
    if (!actionList) return;
    const actionMap = new Map();

    items.forEach((item) => {
      if (!Array.isArray(item.improvements)) return;
      item.improvements.forEach((text) => {
        const key = text.trim();
        if (!key) return;
        if (!actionMap.has(key)) {
          actionMap.set(key, new Set());
        }
        actionMap.get(key).add(item.title);
      });
    });

    actionList.innerHTML = "";

    if (actionMap.size === 0) {
      const li = document.createElement("li");
      li.textContent = "Geen actiepunten toegevoegd.";
      actionList.appendChild(li);
      return;
    }

    actionMap.forEach((sources, text) => {
      const li = document.createElement("li");
      const spanText = document.createElement("span");
      spanText.textContent = text;
      li.appendChild(spanText);

      if (sources.size > 0) {
        const source = document.createElement("span");
        source.className = "action-sources";
        source.textContent = `(${Array.from(sources).join(", ")})`;
        li.appendChild(source);
      }

      actionList.appendChild(li);
    });
  }

  function init(context = {}) {
    pageRoot = context.root || document;
    removeListeners();
    renderList("processList", PROCESS_DATA);
    renderList("coreList", CORE_DATA);
    setupFilters();
    renderActions([...PROCESS_DATA, ...CORE_DATA]);
  }

  function destroy() {
    removeListeners();
    pageRoot = null;
  }

  window.Pages.processen = {
    init,
    destroy,
  };
})();
