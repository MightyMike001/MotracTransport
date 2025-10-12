(function () {
  const MM_TO_PT = 72 / 25.4;
  const A4_WIDTH = 210 * MM_TO_PT;
  const A4_HEIGHT = 297 * MM_TO_PT;
  const DEFAULT_MARGIN = 18 * MM_TO_PT;

  const FONT_KEYS = {
    normal: "F1",
    bold: "F2",
  };

  const DEFAULT_LINE_HEIGHT_FACTOR = 1.32;

  const ESCAPE_MAP = {
    "\\": "\\\\",
    "(": "\\(",
    ")": "\\)",
  };

  function escapePdfString(value) {
    return value.replace(/[\\()]/g, (char) => ESCAPE_MAP[char] || char);
  }

  function stripDiacritics(value) {
    if (typeof value.normalize === "function") {
      return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    }
    return value;
  }

  function sanitizeText(value) {
    if (value === null || value === undefined) {
      return "";
    }
    const text = String(value)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .trim();
    if (!text) {
      return "";
    }
    const ascii = stripDiacritics(text).replace(/[^\x20-\x7E\n]+/g, "");
    return ascii;
  }

  function splitLines(value) {
    const clean = sanitizeText(value);
    if (!clean) return [];
    return clean.split(/\n+/);
  }

  function approximateCharWidth(fontSize) {
    return fontSize * 0.53;
  }

  function wrapSingleLine(text, maxWidth, fontSize) {
    const safeText = sanitizeText(text);
    if (!safeText) return [""];
    if (!maxWidth || maxWidth <= 0) {
      return [safeText];
    }
    const approximateWidth = approximateCharWidth(fontSize);
    const maxChars = Math.max(1, Math.floor(maxWidth / approximateWidth));
    if (safeText.length <= maxChars) {
      return [safeText];
    }
    const words = safeText.split(/\s+/);
    const lines = [];
    let current = "";
    for (const word of words) {
      if (!current) {
        current = word;
        continue;
      }
      if ((current + " " + word).length <= maxChars) {
        current += " " + word;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) {
      lines.push(current);
    }
    return lines;
  }

  function wrapText(text, maxWidth, fontSize) {
    const sourceLines = splitLines(text);
    if (!sourceLines.length) {
      return [""];
    }
    const wrapped = [];
    for (const line of sourceLines) {
      const segments = wrapSingleLine(line, maxWidth, fontSize);
      wrapped.push(...segments);
    }
    return wrapped;
  }

  function sum(array, endIndex) {
    let total = 0;
    for (let i = 0; i < array.length && (endIndex === undefined || i < endIndex); i += 1) {
      total += array[i];
    }
    return total;
  }

  class PdfPage {
    constructor(width, height, margin) {
      this.width = width;
      this.height = height;
      this.margin = margin;
      this.cursorY = height - margin;
      this.content = [];
    }

    ensureSpace(amount) {
      return this.cursorY - amount >= this.margin;
    }

    moveCursor(amount) {
      this.cursorY -= amount;
    }

    write(operation) {
      this.content.push(operation);
    }

    getContentStream() {
      return this.content.join("\n");
    }
  }

  class SimplePdf {
    constructor(options = {}) {
      this.width = options.width || A4_WIDTH;
      this.height = options.height || A4_HEIGHT;
      this.margin = options.margin || DEFAULT_MARGIN;
      this.pages = [];
    }

    getCurrentPage(requiredSpace = 0) {
      let page = this.pages[this.pages.length - 1];
      if (!page || (requiredSpace && !page.ensureSpace(requiredSpace))) {
        page = new PdfPage(this.width, this.height, this.margin);
        this.pages.push(page);
      }
      return page;
    }

    addSpacing(amount) {
      const page = this.getCurrentPage();
      page.moveCursor(amount);
    }

    addText(text, options = {}) {
      const fontSize = options.fontSize || 12;
      const fontKey = options.font === "bold" ? FONT_KEYS.bold : FONT_KEYS.normal;
      const lineHeight = fontSize * (options.lineHeightFactor || DEFAULT_LINE_HEIGHT_FACTOR);
      const indent = options.indent || 0;
      const maxWidth = this.width - this.margin * 2 - indent;
      const lines = wrapText(text, maxWidth, fontSize);
      const blockHeight = lineHeight * lines.length;
      const page = this.getCurrentPage(blockHeight + lineHeight * 0.25);
      const baseY = page.cursorY;
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i];
        const textY = baseY - fontSize - i * lineHeight + fontSize * 0.3;
        const escaped = escapePdfString(line);
        page.write(`BT /${fontKey} ${fontSize} Tf 1 0 0 1 ${Math.round((this.margin + indent) * 100) / 100} ${Math.round(textY * 100) / 100} Tm (${escaped}) Tj ET`);
      }
      page.cursorY = baseY - blockHeight - lineHeight * 0.3;
    }

    addTitle(text) {
      this.addText(text, { fontSize: 20, font: "bold", lineHeightFactor: 1.18 });
      this.addSpacing(8);
    }

    addSubtitle(text) {
      this.addText(text, { fontSize: 14, font: "bold", lineHeightFactor: 1.2 });
      this.addSpacing(4);
    }

    addSectionTitle(text) {
      this.addSpacing(6);
      this.addText(text, { fontSize: 13, font: "bold", lineHeightFactor: 1.2 });
      this.addSpacing(4);
    }

    addParagraph(text, options = {}) {
      this.addText(text, { fontSize: options.fontSize || 11, lineHeightFactor: 1.3, indent: options.indent || 0 });
      this.addSpacing(options.spacingAfter || 6);
    }

    addKeyValueRows(rows, options = {}) {
      if (!Array.isArray(rows) || !rows.length) {
        return;
      }
      const fontSize = options.fontSize || 11;
      const labelWidth = options.labelWidth || 120;
      const spacing = options.spacingAfter || 6;
      const lineHeight = fontSize * DEFAULT_LINE_HEIGHT_FACTOR;
      const contentWidth = this.width - this.margin * 2 - labelWidth - 12;
      for (const row of rows) {
        const label = row.term || row.label || "";
        const value = row.value || "";
        const valueLines = wrapText(value, contentWidth, fontSize);
        const blockHeight = Math.max(lineHeight, valueLines.length * lineHeight);
        const page = this.getCurrentPage(blockHeight + fontSize);
        const baseY = page.cursorY;
        const labelY = baseY - fontSize + fontSize * 0.25;
        const labelText = escapePdfString(sanitizeText(label));
        page.write(`BT /${FONT_KEYS.bold} ${fontSize} Tf 1 0 0 1 ${Math.round(this.margin * 100) / 100} ${Math.round(labelY * 100) / 100} Tm (${labelText}) Tj ET`);
        for (let i = 0; i < valueLines.length; i += 1) {
          const line = valueLines[i];
          const lineY = baseY - fontSize - i * lineHeight + fontSize * 0.3;
          const escaped = escapePdfString(line);
          page.write(`BT /${FONT_KEYS.normal} ${fontSize} Tf 1 0 0 1 ${Math.round((this.margin + labelWidth + 12) * 100) / 100} ${Math.round(lineY * 100) / 100} Tm (${escaped}) Tj ET`);
        }
        page.cursorY = baseY - blockHeight - fontSize * 0.3;
      }
      this.addSpacing(spacing);
    }

    addTable({ headers, rows, columnWidths, fontSize = 10, spacingAfter = 10 }) {
      if (!Array.isArray(headers) || !headers.length) {
        return;
      }
      const columns = headers.length;
      const availableWidth = this.width - this.margin * 2;
      let widths = columnWidths;
      if (!Array.isArray(widths) || widths.length !== columns) {
        const evenWidth = availableWidth / columns;
        widths = new Array(columns).fill(evenWidth);
      }
      const normalizedWidths = widths.map((width) => Math.max(40, width));
      const totalWidth = normalizedWidths.reduce((acc, value) => acc + value, 0);
      const scale = availableWidth / totalWidth;
      const scaledWidths = normalizedWidths.map((width) => width * scale);
      const paddingX = 6;
      const paddingY = 4;
      const lineHeight = fontSize * DEFAULT_LINE_HEIGHT_FACTOR;

      const wrapRow = (row, isHeader = false) => {
        const cells = [];
        for (let i = 0; i < columns; i += 1) {
          const raw = row[i] ?? "";
          const lines = wrapText(raw, scaledWidths[i] - paddingX * 2, fontSize);
          cells.push({
            text: lines,
            font: isHeader ? FONT_KEYS.bold : FONT_KEYS.normal,
          });
        }
        return cells;
      };

      const headerCells = wrapRow(headers, true);
      const headerHeight = headerCells.reduce((max, cell) => Math.max(max, cell.text.length), 1) * lineHeight + paddingY * 2;
      let page = this.getCurrentPage(headerHeight + fontSize);
      if (!page.ensureSpace(headerHeight + fontSize)) {
        page = this.getCurrentPage(headerHeight + fontSize);
      }
      let currentY = page.cursorY;
      for (let i = 0; i < columns; i += 1) {
        const cell = headerCells[i];
        const cellX = this.margin + sum(scaledWidths, i);
        for (let lineIndex = 0; lineIndex < cell.text.length; lineIndex += 1) {
          const line = cell.text[lineIndex];
          const lineY = currentY - paddingY - fontSize - lineIndex * lineHeight + fontSize * 0.3;
          const escaped = escapePdfString(line);
          page.write(`BT /${cell.font} ${fontSize} Tf 1 0 0 1 ${Math.round((cellX + paddingX) * 100) / 100} ${Math.round(lineY * 100) / 100} Tm (${escaped}) Tj ET`);
        }
      }
      currentY -= headerHeight;
      page.cursorY = currentY;

      if (!Array.isArray(rows)) {
        rows = [];
      }
      for (const row of rows) {
        const wrappedRow = wrapRow(row, false);
        const rowHeight = wrappedRow.reduce((max, cell) => Math.max(max, cell.text.length), 1) * lineHeight + paddingY * 2;
        page = this.getCurrentPage(rowHeight + fontSize);
        currentY = page.cursorY;
        for (let i = 0; i < columns; i += 1) {
          const cell = wrappedRow[i];
          const cellX = this.margin + sum(scaledWidths, i);
          for (let lineIndex = 0; lineIndex < cell.text.length; lineIndex += 1) {
            const line = cell.text[lineIndex];
            const lineY = currentY - paddingY - fontSize - lineIndex * lineHeight + fontSize * 0.3;
            const escaped = escapePdfString(line);
            page.write(`BT /${cell.font} ${fontSize} Tf 1 0 0 1 ${Math.round((cellX + paddingX) * 100) / 100} ${Math.round(lineY * 100) / 100} Tm (${escaped}) Tj ET`);
          }
        }
        page.cursorY = currentY - rowHeight;
      }
      this.addSpacing(spacingAfter);
    }

    async toBlob() {
      if (!this.pages.length) {
        this.getCurrentPage();
      }
      const objects = [];
      const offsets = [];

      const pushObject = (body = "") => {
        const id = objects.length + 1;
        objects.push({ id, body });
        return id;
      };

      const catalogId = pushObject();
      const pagesTreeId = pushObject();
      const contentIds = [];
      const pageIds = [];
      for (let i = 0; i < this.pages.length; i += 1) {
        contentIds.push(pushObject());
        pageIds.push(pushObject());
      }
      const fontNormalId = pushObject();
      const fontBoldId = pushObject();

      for (let i = 0; i < this.pages.length; i += 1) {
        const page = this.pages[i];
        const contentStream = page.getContentStream();
        const contentBody = `<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream`;
        objects[contentIds[i] - 1].body = contentBody;
        const pageBody = [
          "<<",
          " /Type /Page",
          ` /Parent ${pagesTreeId} 0 R`,
          ` /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}]`,
          " /Resources << /Font <<",
          `  /${FONT_KEYS.normal} ${fontNormalId} 0 R`,
          `  /${FONT_KEYS.bold} ${fontBoldId} 0 R`,
          " >> >>",
          ` /Contents ${contentIds[i]} 0 R`,
          " >>",
        ].join("\n");
        objects[pageIds[i] - 1].body = pageBody;
      }

      const pagesBody = `<< /Type /Pages /Count ${this.pages.length} /Kids [${pageIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] >>`;
      objects[pagesTreeId - 1].body = pagesBody;
      objects[catalogId - 1].body = `<< /Type /Catalog /Pages ${pagesTreeId} 0 R >>`;
      objects[fontNormalId - 1].body = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
      objects[fontBoldId - 1].body = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>";

      let pdf = "%PDF-1.4\n";
      for (const object of objects) {
        offsets.push(pdf.length);
        pdf += `${object.id} 0 obj\n${object.body}\nendobj\n`;
      }
      const xrefStart = pdf.length;
      pdf += "xref\n";
      pdf += `0 ${objects.length + 1}\n`;
      pdf += "0000000000 65535 f \n";
      for (const offset of offsets) {
        const padded = offset.toString().padStart(10, "0");
        pdf += `${padded} 00000 n \n`;
      }
      pdf += "trailer\n";
      pdf += `<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\n`;
      pdf += "startxref\n";
      pdf += `${xrefStart}\n`;
      pdf += "%%EOF";

      return new Blob([pdf], { type: "application/pdf" });
    }
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function joinNonEmpty(values, separator = " ") {
    if (!Array.isArray(values)) {
      return "";
    }
    const filtered = values
      .map((value) => sanitizeText(value))
      .filter((value) => value && value.trim().length);
    return filtered.join(separator);
  }

  function formatDate(value) {
    if (!value && value !== 0) return "";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      const text = sanitizeText(value);
      return text || "";
    }
    const day = String(parsed.getDate()).padStart(2, "0");
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const year = parsed.getFullYear();
    return `${day}-${month}-${year}`;
  }

  function formatDateTime(value) {
    if (!value && value !== 0) return "";
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) {
      const text = sanitizeText(value);
      return text || "";
    }
    const datePart = formatDate(parsed);
    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return `${datePart} ${hours}:${minutes}`;
  }

  function formatStopDetails(stop) {
    if (!stop || typeof stop !== "object") {
      return "";
    }
    const location = sanitizeText(stop.location);
    const date = stop.date ? formatDate(stop.date) : "";
    const slot = sanitizeText(stop.slot) || joinNonEmpty([stop.time_from, stop.time_to], " - ");
    return joinNonEmpty([
      location,
      joinNonEmpty([date, slot], " • "),
    ], "\n");
  }

  function buildRouteRows(group) {
    if (!group || !Array.isArray(group.stops)) {
      return [];
    }
    return group.stops.map((stop, index) => {
      const order = stop.order || {};
      const details = stop.details || {};
      const reference = sanitizeText(
        order.request_reference ||
          order.reference ||
          order.customer_order_number ||
          order.customer_name ||
          (order.id ? `Order #${order.id}` : "Opdracht")
      );
      const customer = sanitizeText(order.customer_name);
      const addressLines = [];
      const pickup = formatStopDetails(details.pickup);
      if (pickup) {
        addressLines.push(`Laad: ${pickup}`);
      }
      const delivery = formatStopDetails(details.delivery);
      if (delivery) {
        addressLines.push(`Los: ${delivery}`);
      }
      const planningDate = order.planned_date ? formatDate(order.planned_date) : formatDate(details.delivery?.date);
      const planningSlot = sanitizeText(order.planned_slot) || sanitizeText(details.delivery?.slot);
      const dueDate = order.due_date ? formatDate(order.due_date) : "";
      const planningLines = [];
      if (planningDate || planningSlot) {
        planningLines.push(joinNonEmpty([planningDate, planningSlot], " • "));
      }
      if (dueDate && dueDate !== planningDate) {
        planningLines.push(`Gewenste levering: ${dueDate}`);
      }
      const firstWorkLabel = typeof details.firstWork === "boolean"
        ? details.firstWork
          ? "Ja"
          : "Nee"
        : "";
      if (firstWorkLabel) {
        planningLines.push(`Eerste werk: ${firstWorkLabel}`);
      }
      const contact = joinNonEmpty([
        details.contactName,
        details.contactPhone,
        details.contactEmail,
      ], "\n");
      return [
        String(index + 1),
        joinNonEmpty([reference, customer], "\n"),
        addressLines.join("\n"),
        planningLines.join("\n") || "-",
        contact || "-",
      ];
    });
  }

  function countStops(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.groups)) {
      return 0;
    }
    return snapshot.groups.reduce((sum, group) => sum + (Array.isArray(group.stops) ? group.stops.length : 0), 0);
  }

  async function generateRouteListPdf(snapshot, options = {}) {
    const pdf = new SimplePdf();
    const dateLabel = snapshot?.date ? formatDate(snapshot.date) : "Onbekende datum";
    const title = `Rittenlijst ${dateLabel}`;
    pdf.addTitle(title);
    const totalRoutes = Array.isArray(snapshot?.groups) ? snapshot.groups.length : 0;
    const totalStops = countStops(snapshot);
    const backlogCount = Array.isArray(snapshot?.backlog) ? snapshot.backlog.length : 0;
    const generatedLabel = snapshot?.generatedAt ? formatDateTime(snapshot.generatedAt) : formatDateTime(new Date().toISOString());
    pdf.addParagraph(
      `Gegenereerd: ${generatedLabel || "-"}. Routes: ${totalRoutes}. Stops: ${totalStops}. Backlog: ${backlogCount}.`,
      { fontSize: 11, spacingAfter: 12 }
    );

    if (Array.isArray(snapshot?.groups) && snapshot.groups.length) {
      snapshot.groups.forEach((group, groupIndex) => {
        const label = sanitizeText(group.label || group.carrier) || `Route ${groupIndex + 1}`;
        pdf.addSectionTitle(`${groupIndex + 1}. ${label}`);
        const metaParts = [];
        if (group.carrier) {
          metaParts.push(`Carrier: ${sanitizeText(group.carrier)}`);
        }
        if (safeNumber(group.distance) !== null) {
          metaParts.push(`Geschatte afstand: ${safeNumber(group.distance).toFixed(1)} km`);
        }
        metaParts.push(`Stops: ${Array.isArray(group.stops) ? group.stops.length : 0}`);
        pdf.addParagraph(metaParts.join(" • "), { fontSize: 10, spacingAfter: 4 });
        const rows = buildRouteRows(group);
        pdf.addTable({
          headers: ["#", "Opdracht", "Adressen", "Planning", "Contact"],
          rows: rows.length ? rows : [["-", "Geen opdrachten", "", "", ""]],
          columnWidths: [28, 160, 160, 110, 110],
        });
      });
    } else {
      pdf.addParagraph("Geen routes beschikbaar voor de geselecteerde datum.", { fontSize: 11 });
    }

    if (Array.isArray(snapshot?.backlog) && snapshot.backlog.length) {
      pdf.addSectionTitle("Backlog / nog te plannen");
      const backlogRows = buildRouteRows({ stops: snapshot.backlog });
      pdf.addTable({
        headers: ["#", "Opdracht", "Adressen", "Planning", "Contact"],
        rows: backlogRows,
        columnWidths: [28, 160, 160, 110, 110],
      });
    }

    pdf.addParagraph("Automatisch gegenereerd vanuit de routekaart.", { fontSize: 9, spacingAfter: 0 });

    return pdf.toBlob();
  }

  function buildGoodsTableRows(lines) {
    if (!Array.isArray(lines) || !lines.length) {
      return [["-", "Geen goederen geregistreerd", "", ""]];
    }
    return lines.map((line, index) => {
      const quantity = line.quantity !== null && line.quantity !== undefined ? String(line.quantity) : "-";
      return [
        String(index + 1),
        sanitizeText(line.product) || "-",
        quantity,
        sanitizeText(line.serialNumber) || "-",
      ];
    });
  }

  async function generateCmrPdf(order, details, lines = [], options = {}) {
    const pdf = new SimplePdf();
    const safeOrder = order || {};
    const safeDetails = details || {};
    const reference = sanitizeText(
      safeDetails.reference ||
        safeOrder.request_reference ||
        safeOrder.reference ||
        safeOrder.customer_order_number ||
        (safeOrder.id ? `Order #${safeOrder.id}` : "Transportopdracht")
    );

    pdf.addTitle("CMR / Vrachtbrief");
    pdf.addSubtitle(reference || "Onbekende referentie");
    const summaryParts = [];
    if (safeOrder.customer_name) {
      summaryParts.push(`Klant: ${sanitizeText(safeOrder.customer_name)}`);
    }
    if (safeOrder.order_reference) {
      summaryParts.push(`Orderref: ${sanitizeText(safeOrder.order_reference)}`);
    }
    if (safeOrder.customer_order_number || safeDetails.customerOrderNumber) {
      summaryParts.push(`PO: ${sanitizeText(safeOrder.customer_order_number || safeDetails.customerOrderNumber)}`);
    }
    if (safeOrder.assigned_carrier) {
      summaryParts.push(`Vervoerder: ${sanitizeText(safeOrder.assigned_carrier)}`);
    }
    if (summaryParts.length) {
      pdf.addParagraph(summaryParts.join(" • "), { fontSize: 11, spacingAfter: 8 });
    }

    const plannedDate = safeOrder.planned_date || safeDetails.pickup?.date;
    const deliveryDate = safeOrder.due_date || safeDetails.delivery?.date;
    pdf.addKeyValueRows(
      [
        { term: "Geplande datum", value: formatDate(plannedDate) || "-" },
        { term: "Gewenste levering", value: formatDate(deliveryDate) || "-" },
      ],
      { spacingAfter: 10 }
    );

    pdf.addSectionTitle("Afzender / laadadres");
    pdf.addKeyValueRows(
      [
        { term: "Adres", value: formatStopDetails(safeDetails.pickup) || "-" },
        {
          term: "Contact",
          value:
            joinNonEmpty(
              [safeDetails.pickup?.contact, safeDetails.pickup?.phone],
              " \u2022 "
            ) || "-",
        },
      ],
      { spacingAfter: 8 }
    );

    pdf.addSectionTitle("Geadresseerde / losadres");
    pdf.addKeyValueRows(
      [
        { term: "Adres", value: formatStopDetails(safeDetails.delivery) || "-" },
        {
          term: "Contact",
          value:
            joinNonEmpty(
              [safeDetails.delivery?.contact, safeDetails.delivery?.phone],
              " \u2022 "
            ) || "-",
        },
      ],
      { spacingAfter: 8 }
    );

    pdf.addSectionTitle("Goederen");
    pdf.addTable({
      headers: ["#", "Omschrijving", "Aantal", "Serienummer of ref nummer"],
      rows: buildGoodsTableRows(lines),
      columnWidths: [30, 260, 80, 120],
    });

    pdf.addSectionTitle("Instructies en opmerkingen");
    const instructions = safeDetails.instructions || safeOrder.notes;
    pdf.addParagraph(instructions ? sanitizeText(instructions) : "Geen aanvullende instructies bekend.", {
      fontSize: 10,
      spacingAfter: 12,
    });

    pdf.addSectionTitle("Handtekeningen");
    pdf.addParagraph(
      [
        "Handtekening afzender: ________________________________",
        "Handtekening vervoerder: ______________________________",
        "Handtekening geadresseerde: ___________________________",
      ].join("\n"),
      { fontSize: 10, spacingAfter: 12 }
    );

    pdf.addParagraph("Automatisch gegenereerde CMR op basis van ordergegevens.", {
      fontSize: 9,
      spacingAfter: 0,
    });

    return pdf.toBlob();
  }

  window.TransportDocuments = {
    generateRouteListPdf,
    generateCmrPdf,
  };
})();
