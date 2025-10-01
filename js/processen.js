(function () {
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
      id: "quote-to-cash",
      title: "Quote to Cash (Validatieproces Sales)",
      requirement:
        "Workflow voor offertes en orderbevestigingen vanuit Salesforce waarbij documenten beoordeeld, goedgekeurd en automatisch verstuurd of geüpload worden.",
      appSupport:
        "Er is geen koppeling met Salesforce of een validatieworkflow voor salesdocumenten in de huidige applicatie.",
      status: "missing",
      improvements: [
        "Validatie- en goedkeuringsworkflow voor salesdocumenten integreren.",
        "API-koppeling met Salesforce of uploadmechanisme voor documenten realiseren.",
      ],
    },
    {
      id: "validation-used",
      title: "Validation Process Used",
      requirement:
        "Afzonderlijk validatieproces voor de afdeling Used, zichtbaar als apart proces in de inbox.",
      appSupport:
        "Er is nog geen specifieke inbox of workflow voor de afdeling Used aanwezig.",
      status: "missing",
      improvements: [
        "Inrichting van een aparte Used-workflow met eigen inbox en taken toevoegen.",
        "Configuratie van statusovergangen en notificaties per Used-proces definiëren.",
      ],
    },
    {
      id: "matching-order-confirmations",
      title: "Matching Order Confirmations",
      requirement:
        "Automatisch matchen van orderbevestigingen met inkooporders, met automatische afsluiting bij match en verplichte actie inclusief reden bij no-match.",
      appSupport:
        "Ordermatching gebeurt nu niet automatisch; medewerkers passen handmatig statussen aan in de orders-tabel zonder verplichte afsluitreden.",
      status: "missing",
      improvements: [
        "Automatische matching tussen binnenkomende orderbevestigingen en inkooporders opzetten.",
        "Dialoog voor verplichte afsluitreden bij no-match toevoegen.",
      ],
    },
    {
      id: "manage-delivery-dates",
      title: "Manage Delivery Dates (Update leverweek)",
      requirement:
        "Wekelijks proces dat afwijkingen in leverweken signaleert, klanten een gebundelde update stuurt en de Opportunity Owner een keuze geeft om zelf of automatisch te communiceren.",
      appSupport:
        "De orderspagina toont leverdatums, maar er is geen geautomatiseerde weekcontrole of e-mailworkflow naar klanten en Opportunity Owners.",
      status: "missing",
      improvements: [
        "Signalering van leverweekafwijkingen en dashboards voor Opportunity Owners implementeren.",
        "Automatische bundelmail naar klanten met gewijzigde leveringen realiseren.",
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
    const container = document.getElementById(targetId);
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
    const container = document.getElementById(targetId);
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
    const filters = document.querySelectorAll(".status-filter");
    filters.forEach((filter) => {
      filter.addEventListener("change", () => applyFilter(filter));
      applyFilter(filter);
    });
  }

  function renderActions(items) {
    const actionList = document.getElementById("actionList");
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

  document.addEventListener("DOMContentLoaded", () => {
    renderList("processList", PROCESS_DATA);
    renderList("coreList", CORE_DATA);
    setupFilters();
    renderActions([...PROCESS_DATA, ...CORE_DATA]);
  });
})();
