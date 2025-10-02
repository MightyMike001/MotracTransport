(function () {
  const pad = (value) => String(value).padStart(2, "0");

  function parseDateParts(value) {
    if (!value && value !== 0) return null;
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return null;
      return {
        year: value.getFullYear(),
        month: value.getMonth() + 1,
        day: value.getDate(),
      };
    }
    if (typeof value === "object" && value && "year" in value && "month" in value && "day" in value) {
      const year = Number(value.year);
      const month = Number(value.month);
      const day = Number(value.day);
      if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
        return null;
      }
      return { year, month, day };
    }
    const text = String(value).trim();
    if (!text) return null;

    const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/);
    if (isoMatch) {
      return {
        year: Number(isoMatch[1]),
        month: Number(isoMatch[2]),
        day: Number(isoMatch[3]),
      };
    }

    const nlMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (nlMatch) {
      return {
        year: Number(nlMatch[3]),
        month: Number(nlMatch[2]),
        day: Number(nlMatch[1]),
      };
    }

    return null;
  }

  function formatDateDisplay(value) {
    const parts = parseDateParts(value);
    if (!parts) return "-";
    const { year, month, day } = parts;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "-";
    return `${pad(day)}-${pad(month)}-${year}`;
  }

  function formatDateForInput(value) {
    const parts = parseDateParts(value);
    if (!parts) return "";
    const { year, month, day } = parts;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "";
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  function ensureDate(value) {
    if (!value && value !== 0) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return null;
      const parsed = Date.parse(trimmed);
      if (!Number.isNaN(parsed)) {
        return new Date(parsed);
      }
    }
    const parts = parseDateParts(value);
    if (!parts) return null;
    const { year, month, day } = parts;
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
    return new Date(year, month - 1, day);
  }

  const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  function formatDateTimeDisplay(value) {
    const date = ensureDate(value);
    if (!date) return "-";
    return DATE_TIME_FORMATTER.format(date).replace(/[\u202F\u00A0]/g, " ");
  }

  function getTodayDateValue() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function createKeypressHandler(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
  }

  function createBeforeInputHandler(event) {
    if (event.inputType && event.inputType.startsWith("insert")) {
      event.preventDefault();
    }
  }

  function handleKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key && event.key.length === 1) {
      event.preventDefault();
    }
  }

  function enforceDateInput(input) {
    if (!input || input.dataset.datePickerEnforced === "true") return;
    input.setAttribute("lang", "nl");
    input.setAttribute("inputmode", "none");
    input.dataset.datePickerEnforced = "true";
    input.addEventListener("keypress", createKeypressHandler);
    input.addEventListener("keydown", handleKeyDown);
    input.addEventListener("beforeinput", createBeforeInputHandler);
  }

  function enforceDateInputs(root) {
    const scope = root || document;
    const inputs = scope.querySelectorAll ? scope.querySelectorAll('input[type="date"]') : [];
    inputs.forEach(enforceDateInput);
  }

  window.DateUtils = {
    parseDateParts,
    formatDateDisplay,
    formatDateForInput,
    formatDateTimeDisplay,
    getTodayDateValue,
    ensureDate,
    enforceDateInputs,
  };
})();
