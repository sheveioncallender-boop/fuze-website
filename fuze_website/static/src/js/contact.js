(() => {
  const form = document.querySelector('[data-contact-form]');
  if (!form) return;

  const status = document.getElementById('contactFormStatus');
  const submitButton = form.querySelector('button[type="submit"]');
  const recipient = 'freshlyfuzed@gmail.com';
  const endpoint = '/fuze/contact/submit';
  const readOdooResponse = async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (_error) {
      throw new Error(`Odoo could not process this enquiry (HTTP ${response.status}).`);
    }
  };
  const callOdoo = async (endpoint, params) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params, id: Date.now() })
    });
    const envelope = await readOdooResponse(response);
    if (envelope.error) {
      throw new Error(envelope.error.data?.message || envelope.error.message || 'Odoo could not process this enquiry.');
    }
    if (!envelope.result) throw new Error('Odoo returned an empty enquiry response.');
    return envelope.result;
  };

  const formPayload = () => {
    const data = new FormData(form);
    return {
      customerName: data.get('customerName').trim(),
      customerEmail: data.get('customerEmail').trim(),
      customerPhone: data.get('customerPhone').trim(),
      enquiryType: data.get('enquiryType'),
      locationId: data.get('locationId'),
      message: data.get('message').trim(),
      website: data.get('website').trim()
    };
  };

  const openEmailFallback = (payload) => {
    const subject = `Fuze website enquiry — ${payload.enquiryType} — ${payload.customerName}`;
    const body = [
      `Name: ${payload.customerName}`,
      `Email: ${payload.customerEmail}`,
      `Phone: ${payload.customerPhone || 'Not provided'}`,
      `Location: ${payload.locationId}`,
      `Enquiry: ${payload.enquiryType}`,
      '',
      payload.message
    ].join('\n');
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.classList.remove('is-error', 'is-success');
    status.textContent = `Your email app was opened with the enquiry addressed to ${recipient}.`;
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;

    const payload = formPayload();
    const standalone = window.location.protocol === 'file:' || /Fuze-Contact-Premium-Preview\.html$/i.test(window.location.pathname);
    if (standalone) {
      openEmailFallback(payload);
      return;
    }

    const originalText = submitButton.innerHTML;
    submitButton.disabled = true;
    submitButton.textContent = 'Sending…';
    status.classList.remove('is-error', 'is-success');
    status.textContent = 'Sending your enquiry securely…';

    try {
      const result = await callOdoo(endpoint, { payload });
      if (!result.ok) throw new Error(result.message || 'The enquiry could not be sent.');
      status.classList.add('is-success');
      status.textContent = result.message;
      form.reset();
    } catch (error) {
      status.classList.add('is-error');
      status.textContent = error.message || 'The enquiry could not be sent. Opening your email app instead…';
      window.setTimeout(() => openEmailFallback(payload), 650);
    } finally {
      submitButton.disabled = false;
      submitButton.innerHTML = originalText;
    }
  });
})();
