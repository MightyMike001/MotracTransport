(function () {
  const config = window.APP_CONFIG || {};
  const templates = Array.isArray(config.DOCUMENT_EMAIL_TEMPLATES)
    ? config.DOCUMENT_EMAIL_TEMPLATES
    : [];
  const lists = Array.isArray(config.DOCUMENT_EMAIL_LISTS)
    ? config.DOCUMENT_EMAIL_LISTS
    : [];

  const dialog = document.getElementById("documentMailDialog");
  const form = document.getElementById("documentMailForm");
  if (!dialog || !form) {
    window.DocumentMail = {
      open() {
        window.alert("E-mailmodule is niet beschikbaar in deze omgeving.");
        return Promise.resolve({ ok: false, reason: "unavailable" });
      },
    };
    return;
  }

  const els = {
    title: document.getElementById("documentMailTitle"),
    description: document.getElementById("documentMailDescription"),
    template: document.getElementById("documentMailTemplate"),
    list: document.getElementById("documentMailList"),
    listInfo: document.getElementById("documentMailListInfo"),
    subject: document.getElementById("documentMailSubject"),
    body: document.getElementById("documentMailBody"),
    additional: document.getElementById("documentMailAdditional"),
    status: document.getElementById("documentMailStatus"),
    submit: document.getElementById("documentMailSubmit"),
  };

  const state = {
    resolver: null,
    rejecter: null,
    options: null,
    result: null,
    sending: false,
  };

  function sanitizeString(value) {
    if (!value && value !== 0) return "";
    return String(value).trim();
  }

  function normalizeEmail(value) {
    const text = sanitizeString(value).toLowerCase();
    if (!text || !text.includes("@")) {
      return null;
    }
    return text;
  }

  function parseRecipients(value) {
    if (!value) return [];
    const parts = String(value)
      .split(/[;,\n\s]+/)
      .map((part) => normalizeEmail(part))
      .filter(Boolean);
    const unique = [];
    const seen = new Set();
    for (const email of parts) {
      if (seen.has(email)) continue;
      seen.add(email);
      unique.push(email);
    }
    return unique;
  }

  function getTemplatesForType(type) {
    const lowerType = type ? String(type).toLowerCase() : null;
    return templates.filter((tpl) => {
      if (!tpl || typeof tpl !== "object") {
        return false;
      }
      if (!tpl.type) {
        return true;
      }
      return String(tpl.type).toLowerCase() === lowerType;
    });
  }

  function getTemplateById(id) {
    const lookup = sanitizeString(id).toLowerCase();
    return templates.find((tpl) => sanitizeString(tpl.id).toLowerCase() === lookup) || null;
  }

  function getListById(id) {
    const lookup = sanitizeString(id).toLowerCase();
    return lists.find((list) => sanitizeString(list.id).toLowerCase() === lookup) || null;
  }

  function buildTemplateOptions(type) {
    const available = getTemplatesForType(type);
    const options = available.length ? available : templates;
    return Array.isArray(options) ? options : [];
  }

  function buildListOptions() {
    return Array.isArray(lists) ? lists : [];
  }

  function fillSelect(select, items, getValue, getLabel) {
    if (!select) return;
    select.innerHTML = "";
    if (!Array.isArray(items) || !items.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "Geen opties";
      select.appendChild(option);
      select.setAttribute("disabled", "disabled");
      return;
    }
    select.removeAttribute("disabled");
    for (const item of items) {
      const option = document.createElement("option");
      option.value = getValue(item);
      option.textContent = getLabel(item);
      select.appendChild(option);
    }
  }

  function setStatus(message, variant = "") {
    if (!els.status) return;
    els.status.textContent = message || "";
    els.status.classList.remove("is-error", "is-success");
    if (variant === "error") {
      els.status.classList.add("is-error");
    } else if (variant === "success") {
      els.status.classList.add("is-success");
    }
  }

  function setDisabled(disabled) {
    if (disabled) {
      els.submit?.setAttribute("disabled", "disabled");
      els.submit?.setAttribute("aria-disabled", "true");
    } else {
      els.submit?.removeAttribute("disabled");
      els.submit?.removeAttribute("aria-disabled");
    }
  }

  function formatListRecipients(list) {
    if (!list || typeof list !== "object") {
      return "Geen vaste ontvangers";
    }
    const recipients = Array.isArray(list.recipients) ? list.recipients : [];
    if (!recipients.length) {
      return "Geen vaste ontvangers";
    }
    return `Ontvangers: ${recipients.join(", ")}`;
  }

  function formatDescription(options) {
    if (!options || typeof options !== "object") {
      return "";
    }
    if (options.description) {
      return options.description;
    }
    const type = sanitizeString(options.documentType).toLowerCase();
    if (type === "rittenlijst") {
      const dateLabel = sanitizeString(options.context?.dateLabel) || sanitizeString(options.context?.date);
      return dateLabel ? `Rittenlijst voor ${dateLabel}` : "Rittenlijst versturen";
    }
    if (type === "cmr") {
      const reference = sanitizeString(options.context?.reference);
      const customer = sanitizeString(options.context?.customer);
      const parts = [];
      if (reference) parts.push(reference);
      if (customer) parts.push(customer);
      return parts.length ? `CMR voor ${parts.join(" — ")}` : "CMR versturen";
    }
    return "Document verzenden";
  }

  function fillTemplate(template, context = {}) {
    if (!template || typeof template !== "object") {
      return { subject: "", body: "" };
    }
    const replacements = {
      date: sanitizeString(context.dateLabel || context.date || ""),
      reference: sanitizeString(context.reference || ""),
      customer: sanitizeString(context.customer || ""),
      plannedDate: sanitizeString(context.plannedDate || ""),
      deliveryDate: sanitizeString(context.deliveryDate || ""),
      routeCount: sanitizeString(context.routeCount || ""),
      stopCount: sanitizeString(context.stopCount || ""),
      backlogCount: sanitizeString(context.backlogCount || ""),
      generatedAt: sanitizeString(context.generatedAt || ""),
    };

    const replaceTokens = (text) => {
      if (!text && text !== 0) return "";
      return String(text).replace(/\{(\w+)\}/g, (match, key) => {
        const normalized = key ? String(key).trim() : "";
        if (!normalized) return match;
        const value = replacements[normalized];
        return value !== undefined && value !== null && value !== "" ? value : match;
      });
    };

    return {
      subject: replaceTokens(template.subject || ""),
      body: replaceTokens(template.body || ""),
    };
  }

  function uniqueRecipients(list, additional, override) {
    const emails = new Set();
    const combined = [];
    const push = (value) => {
      const normalized = normalizeEmail(value);
      if (!normalized || emails.has(normalized)) return;
      emails.add(normalized);
      combined.push(normalized);
    };
    if (Array.isArray(list)) {
      list.forEach(push);
    }
    if (Array.isArray(additional)) {
      additional.forEach(push);
    }
    if (Array.isArray(override)) {
      override.forEach(push);
    }
    return combined;
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const base64 = result.includes(",") ? result.split(",").pop() : result;
        resolve(base64 || "");
      };
      reader.onerror = () => reject(reader.error || new Error("blob-read"));
      reader.readAsDataURL(blob);
    });
  }

  async function prepareAttachments(options) {
    if (!options || !Array.isArray(options.attachments)) {
      return [];
    }
    const attachments = [];
    for (const attachment of options.attachments) {
      if (!attachment || !attachment.blob) continue;
      const filename = sanitizeString(attachment.filename) || "document.pdf";
      const type = sanitizeString(attachment.contentType) || attachment.blob.type || "application/pdf";
      try {
        const content = await blobToBase64(attachment.blob);
        attachments.push({ filename, contentType: type, content });
      } catch (error) {
        console.warn("Kan bijlage niet converteren", error);
      }
    }
    return attachments;
  }

  function resetStatus() {
    setStatus("");
    setDisabled(false);
    state.sending = false;
  }

  function finish(result) {
    state.result = result || { ok: false, reason: "cancelled" };
    state.sending = false;
    if (dialog.open) {
      dialog.close();
    } else if (state.resolver) {
      const resolver = state.resolver;
      state.resolver = null;
      resolver(state.result);
    }
  }

  function updateListInfo() {
    if (!els.listInfo) return;
    const current = getListById(els.list?.value);
    els.listInfo.textContent = formatListRecipients(current);
  }

  function populateForm(options) {
    const templateOptions = buildTemplateOptions(options.documentType);
    fillSelect(
      els.template,
      templateOptions,
      (item) => sanitizeString(item.id) || sanitizeString(item.name) || "template",
      (item) => sanitizeString(item.name || item.label || item.subject || "Template")
    );
    const listOptions = buildListOptions();
    fillSelect(
      els.list,
      listOptions,
      (item) => sanitizeString(item.id) || sanitizeString(item.name) || "list",
      (item) => sanitizeString(item.name || item.label || "Distributielijst")
    );

    const defaultTemplateId = options.defaultTemplateId || (templateOptions[0] && templateOptions[0].id) || "";
    if (els.template) {
      els.template.value = sanitizeString(defaultTemplateId);
      if (!els.template.value && els.template.options.length) {
        els.template.selectedIndex = 0;
      }
    }

    const defaultListId = options.defaultListId || (listOptions[0] && listOptions[0].id) || "";
    if (els.list) {
      els.list.value = sanitizeString(defaultListId);
      if (!els.list.value && els.list.options.length) {
        els.list.selectedIndex = 0;
      }
    }

    const selectedTemplate = getTemplateById(els.template?.value) || templateOptions[0] || null;
    const templateFilled = fillTemplate(selectedTemplate, options.context || {});
    if (els.subject) {
      els.subject.value = templateFilled.subject || "";
    }
    if (els.body) {
      els.body.value = templateFilled.body || "";
    }
    if (els.additional) {
      const extra = Array.isArray(options.recipients)
        ? options.recipients.join(", ")
        : sanitizeString(options.recipients);
      els.additional.value = extra || "";
    }
    if (els.title) {
      els.title.textContent = sanitizeString(options.title) || "Document mailen";
    }
    if (els.description) {
      els.description.textContent = formatDescription(options);
    }
    updateListInfo();
    resetStatus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (state.sending) {
      return;
    }
    if (!window.EmailNotifications || typeof window.EmailNotifications.sendDocumentMail !== "function") {
      setStatus("E-mailservice is niet geconfigureerd.", "error");
      return;
    }

    const selectedTemplate = getTemplateById(els.template?.value);
    const selectedList = getListById(els.list?.value);
    const subject = sanitizeString(els.subject?.value);
    const message = sanitizeString(els.body?.value);
    const additionalRecipients = parseRecipients(els.additional?.value);

    if (!subject) {
      setStatus("Onderwerp is verplicht.", "error");
      return;
    }
    if (!message) {
      setStatus("Berichttekst is verplicht.", "error");
      return;
    }

    const baseRecipients = Array.isArray(selectedList?.recipients) ? selectedList.recipients : [];
    const overrideRecipients = Array.isArray(state.options?.recipientsOverride)
      ? state.options.recipientsOverride
      : [];
    const recipients = uniqueRecipients(baseRecipients, additionalRecipients, overrideRecipients);

    if (!recipients.length) {
      setStatus("Voeg minimaal één ontvanger toe.", "error");
      return;
    }

    setStatus("Versturen…");
    setDisabled(true);
    state.sending = true;

    try {
      const attachments = await prepareAttachments(state.options || {});
      const meta = {
        templateId: selectedTemplate?.id || null,
        listId: selectedList?.id || null,
        documentType: state.options?.documentType || null,
        context: state.options?.context || null,
      };
      const payload = {
        subject,
        message,
        recipients,
        attachments,
        includeDefaultRecipients: state.options?.includeDefaultRecipients ?? false,
        cc: Array.isArray(selectedList?.cc) ? selectedList.cc : undefined,
        bcc: Array.isArray(selectedList?.bcc) ? selectedList.bcc : undefined,
        meta,
      };
      const result = await window.EmailNotifications.sendDocumentMail(payload);
      if (!result || result.ok !== true) {
        const reason = result?.reason || "request-failed";
        if (reason === "disabled" || reason === "event-disabled") {
          setStatus("E-mailnotificaties zijn uitgeschakeld.", "error");
        } else if (reason === "no-recipients") {
          setStatus("Geen ontvangers beschikbaar om te mailen.", "error");
        } else {
          setStatus("Versturen mislukt. Controleer de instellingen.", "error");
        }
        setDisabled(false);
        state.sending = false;
        return;
      }
      setStatus("Verstuurd", "success");
      finish({ ok: true, payload });
    } catch (error) {
      console.error("Document mailen mislukt", error);
      setStatus("Versturen mislukt.", "error");
      setDisabled(false);
      state.sending = false;
    }
  }

  function handleTemplateChange() {
    if (!state.options) return;
    const selectedTemplate = getTemplateById(els.template?.value);
    const templateFilled = fillTemplate(selectedTemplate, state.options.context || {});
    if (els.subject) {
      els.subject.value = templateFilled.subject || "";
    }
    if (els.body) {
      els.body.value = templateFilled.body || "";
    }
  }

  function handleListChange() {
    updateListInfo();
  }

  form.addEventListener("submit", handleSubmit);
  els.template?.addEventListener("change", handleTemplateChange);
  els.list?.addEventListener("change", handleListChange);

  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    if (state.sending) {
      return;
    }
    finish({ ok: false, reason: "cancelled" });
  });

  dialog.addEventListener("close", () => {
    resetStatus();
    if (state.resolver) {
      const resolver = state.resolver;
      state.resolver = null;
      resolver(state.result || { ok: false, reason: "cancelled" });
    }
  });

  window.DocumentMail = {
    open(options = {}) {
      if (state.sending) {
        return Promise.resolve({ ok: false, reason: "busy" });
      }
      state.options = options || {};
      state.result = null;
      populateForm(state.options);
      return new Promise((resolve) => {
        state.resolver = resolve;
        dialog.showModal();
      });
    },
  };
})();
