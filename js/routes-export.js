(function () {
  function showError(message) {
    const body = document.body;
    if (!body) {
      return;
    }
    body.innerHTML = '';
    const wrapper = document.createElement('main');
    wrapper.setAttribute('role', 'alert');
    wrapper.setAttribute('aria-live', 'assertive');
    wrapper.style.maxWidth = '520px';
    wrapper.style.margin = '40px auto';
    wrapper.style.padding = '32px 28px';
    wrapper.style.background = '#ffffff';
    wrapper.style.borderRadius = '12px';
    wrapper.style.boxShadow = '0 12px 30px rgba(15, 23, 42, 0.12)';
    wrapper.style.fontFamily = '"Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif';
    wrapper.style.textAlign = 'center';
    const heading = document.createElement('h1');
    heading.textContent = 'Rittenlijst kan niet worden geladen';
    heading.style.margin = '0 0 12px';
    heading.style.fontSize = '1.4rem';
    const paragraph = document.createElement('p');
    paragraph.textContent = message || 'Sluit dit venster en probeer de export opnieuw vanuit de applicatie.';
    paragraph.style.margin = '0';
    paragraph.style.color = '#4a5568';
    paragraph.style.lineHeight = '1.6';
    wrapper.appendChild(heading);
    wrapper.appendChild(paragraph);
    body.appendChild(wrapper);
    document.title = 'Rittenlijst niet beschikbaar';
  }

  function restoreDocument(html) {
    if (typeof html !== 'string' || !html.trim()) {
      showError('Er is geen geldige inhoud beschikbaar.');
      return;
    }
    document.open();
    document.write(html);
    document.close();
  }

  function consumePayload() {
    let storageKey = null;
    try {
      const params = new URLSearchParams(window.location.search);
      storageKey = params.get('payload');
    } catch (error) {
      console.warn('Kan parameters voor exportpagina niet lezen', error);
      storageKey = null;
    }
    if (!storageKey) {
      showError('Er zijn geen exportgegevens gevonden.');
      return null;
    }
    let html = null;
    try {
      html = window.sessionStorage.getItem(storageKey);
    } catch (error) {
      console.warn('Kan exportgegevens niet uit sessieopslag lezen', error);
      html = null;
    }
    try {
      window.sessionStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('Kan tijdelijke exportgegevens niet verwijderen', error);
    }
    if (!html) {
      showError('De exportgegevens zijn verlopen. Sluit dit venster en probeer het opnieuw.');
      return null;
    }
    return html;
  }

  const html = consumePayload();
  if (html) {
    restoreDocument(html);
  }
})();
