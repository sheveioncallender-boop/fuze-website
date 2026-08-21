(() => {
  const form = document.getElementById('checkoutForm');
  if (!form) return;

  const CART_KEY = 'fuze-order-cart';
  const LOCATION_KEY = 'fuze-order-location';
  const KDS_ORDER_KEY = 'fuze-kds-orders';
  const locations = {
    east: {
      name: 'East Gates Mall',
      short: 'East Gates',
      address: 'Trincity Central Road / College Road, Trincity',
      phone: '868-292-FUZE'
    },
    bagshot: {
      name: 'Bagshot BoxPark',
      short: 'Bagshot',
      address: '9 Saddle Road, Maraval',
      phone: '868-336-FUZE'
    }
  };

  const demoCart = [
    {
      lineId: 'demo-smash',
      category: 'Burgers & Sandwiches',
      name: 'Angus Smash Beef',
      price: 60,
      quantity: 2,
      selections: [],
      note: 'One without pickles.'
    },
    {
      lineId: 'demo-pasta',
      category: 'Pasta',
      name: 'Rasta Pasta',
      price: 95,
      quantity: 1,
      selections: [{ label: 'Sauce', value: 'Creamy Alfredo' }],
      note: ''
    },
    {
      lineId: 'demo-drink',
      category: 'Refreshers',
      name: 'Passion Fruit',
      price: 25,
      quantity: 1,
      selections: [],
      note: ''
    }
  ];

  const readStorage = (key, fallback) => {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_error) {
      return fallback;
    }
  };

  const writeStorage = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) { /* The preview remains usable without storage. */ }
  };

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const money = (value) => `$${Number(value || 0).toLocaleString('en-TT', { maximumFractionDigits: 2 })}`;
  const isDemo = window.FUZE_CHECKOUT_DEMO === true;
  const isOdoo = window.FUZE_ODOO === true;
  const checkoutConfig = window.FUZE_CHECKOUT_CONFIG || {};
  let cart = readStorage(CART_KEY, []);
  let selectedLocation = readStorage(LOCATION_KEY, '');
  let currentStep = 'details';
  let toastTimer;

  if (!Array.isArray(cart)) cart = [];
  if (isDemo && cart.length === 0) cart = demoCart;
  if (isDemo && !locations[selectedLocation]) selectedLocation = 'east';

  const layout = document.querySelector('.checkout-layout');
  const emptyState = document.getElementById('checkoutEmpty');
  const summary = document.getElementById('checkoutSummary');
  const summaryItems = document.getElementById('summaryItems');
  const summaryLocation = document.getElementById('summaryLocation');
  const summarySubtotal = document.getElementById('summarySubtotal');
  const summaryDelivery = document.getElementById('summaryDelivery');
  const summaryTotal = document.getElementById('summaryTotal');
  const cardPanelTotal = document.getElementById('cardPanelTotal');
  const pickupLocationName = document.getElementById('pickupLocationName');
  const pickupLocationAddress = document.getElementById('pickupLocationAddress');
  const pickupNote = document.getElementById('pickupNote');
  const deliveryFields = document.getElementById('deliveryFields');
  const onlinePaymentPanel = document.getElementById('onlinePaymentPanel');
  const storePaymentPanel = document.getElementById('storePaymentPanel');
  const storePaymentLocation = document.getElementById('storePaymentLocation');
  const placeOrderButton = document.getElementById('placeOrderButton');
  const confirmation = document.getElementById('checkoutConfirmation');
  const toast = document.getElementById('checkoutToast');

  const subtotal = () => cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
  const fulfilment = () => form.elements.fulfilment.value;
  const paymentMethod = () => form.elements.paymentMethod.value;
  const deliveryFee = () => fulfilment() === 'delivery' ? Number(checkoutConfig[selectedLocation]?.deliveryFee || 0) : 0;
  const orderTotal = () => subtotal() + deliveryFee();

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
  };

  const updateLocation = (locationId, persist = true) => {
    if (!locations[locationId]) return;
    selectedLocation = locationId;
    form.elements.location.value = locationId;
    if (persist && !isDemo) writeStorage(LOCATION_KEY, locationId);
    const location = locations[locationId];
    summaryLocation.textContent = location.name;
    pickupLocationName.textContent = location.name;
    pickupLocationAddress.textContent = `${location.address} · ${location.phone}`;
    storePaymentLocation.textContent = location.name;
    updatePaymentMethod();
    renderSummary();
  };

  const renderSummary = () => {
    const total = orderTotal();
    summaryItems.innerHTML = cart.map((item) => `
      <article class="checkout-summary-item" data-line-id="${escapeHtml(item.lineId)}">
        <div class="checkout-summary-item__top">
          <div><p>${escapeHtml(item.category || 'Fuze menu')}</p><h3>${escapeHtml(item.name)}</h3></div>
          <strong>${money(Number(item.price) * Number(item.quantity))}</strong>
        </div>
        ${item.selections?.length ? `<ul>${item.selections.map((selection) => `<li><span>${escapeHtml(selection.label)}</span>${escapeHtml(selection.value)}</li>`).join('')}</ul>` : ''}
        ${item.note ? `<p class="checkout-summary-item__note">“${escapeHtml(item.note)}”</p>` : ''}
        <div class="checkout-summary-item__actions">
          <div><button type="button" data-summary-action="minus" aria-label="Decrease ${escapeHtml(item.name)}">−</button><span>${item.quantity}</span><button type="button" data-summary-action="plus" aria-label="Increase ${escapeHtml(item.name)}">+</button></div>
          <button type="button" data-summary-action="remove">Remove</button>
        </div>
      </article>`).join('');
    summarySubtotal.textContent = money(subtotal());
    summaryTotal.textContent = money(total);
    cardPanelTotal.textContent = money(total);
    summaryDelivery.textContent = fulfilment() === 'delivery' ? (isOdoo ? money(deliveryFee()) : 'Preview') : '$0';

    if (cart.length === 0) showEmptyState();
  };

  const showEmptyState = () => {
    form.hidden = true;
    summary.hidden = true;
    emptyState.hidden = false;
    document.querySelector('.checkout-progress').hidden = true;
  };

  const updateFulfilment = () => {
    const isDelivery = fulfilment() === 'delivery';
    deliveryFields.hidden = !isDelivery;
    pickupNote.hidden = isDelivery;
    deliveryFields.querySelectorAll('input').forEach((input) => {
      input.required = isDelivery && ['street', 'city'].includes(input.name);
    });
    summaryDelivery.textContent = isDelivery ? (isOdoo ? money(deliveryFee()) : 'Preview') : '$0';
    renderSummary();
  };

  const updatePaymentMethod = () => {
    const isOnline = paymentMethod() === 'online';
    onlinePaymentPanel.hidden = !isOnline;
    storePaymentPanel.hidden = isOnline;
    form.querySelectorAll('[name^="card"]').forEach((input) => { input.required = isOnline && !isOdoo; });
    const cardFields = onlinePaymentPanel.querySelector('.checkout-card-fields');
    if (cardFields) cardFields.hidden = isOdoo;
    if (isOdoo) {
      const notice = onlinePaymentPanel.querySelector('.checkout-preview-notice');
      if (notice) notice.innerHTML = '<span>SECURE ODOO PAYMENT</span><p>After your order is created, you’ll continue to the card provider configured in Odoo. Fuze never receives or stores your card number.</p>';
    }
    placeOrderButton.innerHTML = isOnline
      ? `${isOdoo ? 'Continue to payment' : `Pay ${money(orderTotal())} securely`} <span>→</span>`
      : 'Reserve order <span>→</span>';

    const deliveryChoice = form.querySelector('input[name="fulfilment"][value="delivery"]');
    const deliveryLabel = deliveryChoice.closest('label');
    const deliveryAvailable = !isOdoo || Boolean(checkoutConfig[selectedLocation]?.deliveryEnabled);
    const canChooseDelivery = isOnline && deliveryAvailable;
    deliveryChoice.disabled = !canChooseDelivery;
    deliveryLabel.classList.toggle('is-disabled', !canChooseDelivery);
    const deliveryDescription = deliveryLabel.querySelector('small');
    if (deliveryDescription && isOdoo) {
      deliveryDescription.textContent = deliveryAvailable
        ? `Flat delivery fee ${money(Number(checkoutConfig[selectedLocation]?.deliveryFee || 0))}`
        : 'Not available from this location';
    }
    if (!canChooseDelivery && fulfilment() === 'delivery') {
      form.elements.fulfilment.value = 'pickup';
      updateFulfilment();
      showToast(!isOnline ? 'Pay at Fuze is available for pickup orders only.' : 'Delivery is not available from this location.');
    }
  };

  const showStep = (step) => {
    currentStep = step;
    document.querySelectorAll('[data-checkout-step]').forEach((section) => {
      const active = section.dataset.checkoutStep === step;
      section.hidden = !active;
      section.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-progress-step]').forEach((button) => {
      const order = { details: 0, payment: 1, complete: 2 };
      const active = button.dataset.progressStep === step;
      const complete = order[button.dataset.progressStep] < order[step];
      button.classList.toggle('is-active', active);
      button.classList.toggle('is-complete', complete);
      button.setAttribute('aria-current', active ? 'step' : 'false');
    });
    window.scrollTo({ top: document.querySelector('.checkout-progress').offsetTop, behavior: 'smooth' });
  };

  const validateDetails = () => {
    if (!selectedLocation || !locations[selectedLocation]) {
      showToast('Choose the Fuze location preparing your order.');
      form.querySelector('.checkout-location-grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    const detailsInputs = [...form.querySelector('[data-checkout-step="details"]').querySelectorAll('input, textarea')];
    const invalid = detailsInputs.find((input) => !input.checkValidity());
    if (invalid) {
      invalid.reportValidity();
      invalid.focus();
      return false;
    }
    return true;
  };

  const finishOrder = (serverOrder = null) => {
    const location = locations[selectedLocation];
    const method = paymentMethod();
    const orderType = fulfilment();
    const total = orderTotal();
    const reference = serverOrder?.reference || `FZ-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${Math.floor(100 + Math.random() * 900)}`;
    const customerName = `${form.elements.firstName.value.trim()} ${form.elements.lastName.value.trim()}`;

    const stationFor = (item) => {
      const text = `${item.category || ''} ${item.name || ''}`.toLowerCase();
      if (/drink|refresher|shake|beverage/.test(text)) return 'drinks';
      if (/dessert|custard|waffle/.test(text)) return 'dessert';
      if (/burger|sandwich|steak/.test(text)) return 'grill';
      if (/fried|fish fry|fries/.test(text)) return 'fryer';
      return 'kitchen';
    };

    const imageFor = (item) => {
      const text = `${item.category || ''} ${item.name || ''}`.toLowerCase();
      if (/empanada/.test(text)) return 'empanada-card.webp';
      if (/fish/.test(text)) return 'fish-card.webp';
      if (/burger|sandwich/.test(text)) return 'fuze-angus-smash-reel-poster.jpg';
      if (/dessert|custard|shake/.test(text)) return 'fuze-dessert-reel-poster.jpg';
      if (/rice|pasta/.test(text)) return 'trini-fried-rice-special.jpg';
      return 'fuze-review-reel-poster.jpg';
    };

    const publishToKitchen = () => {
      const existing = readStorage(KDS_ORDER_KEY, []);
      const orders = Array.isArray(existing) ? existing : [];
      const sequence = Number(reference.match(/(\d{3})$/)?.[1]) || Math.floor(100 + Math.random() * 900);
      const kitchenOrder = {
        id: reference,
        sequence,
        branch: selectedLocation,
        stage: 'new',
        createdAt: Date.now(),
        customer: customerName,
        phone: form.elements.phone.value.trim(),
        fulfilment: orderType,
        payment: method === 'online' ? 'paid' : 'store',
        source: 'Website',
        note: form.elements.orderNote.value.trim(),
        items: cart.map((item, index) => ({
          id: `${reference}-${index + 1}`,
          qty: Number(item.quantity) || 1,
          name: item.name,
          station: stationFor(item),
          image: imageFor(item),
          options: (item.selections || []).map((selection) => `${selection.label}: ${selection.value}`),
          note: item.note || ''
        }))
      };
      writeStorage(KDS_ORDER_KEY, [...orders.filter((order) => order.id !== reference), kitchenOrder]);
    };

    if (!isOdoo) publishToKitchen();

    document.getElementById('confirmationReference').textContent = reference;
    document.getElementById('confirmationLocation').textContent = location.name;
    document.getElementById('confirmationFulfilment').textContent = orderType === 'delivery' ? 'Delivery' : 'Pickup';
    document.getElementById('confirmationPayment').textContent = method === 'online' ? (isOdoo ? 'Card online' : 'Card online · Preview') : 'Card at store';
    document.getElementById('confirmationTotal').textContent = `${money(serverOrder?.total ?? total)} TTD`;
    document.getElementById('confirmationLead').textContent = method === 'online'
      ? (isOdoo ? `${customerName}, your secure card payment is confirmed and the kitchen has received your order.` : `${customerName}, your checkout design preview is complete. The live Odoo version will confirm the order only after the payment provider approves the transaction.`)
      : `${customerName}, your pickup order is reserved at ${location.name}. Pay by credit or debit card at the counter.`;
    document.getElementById('confirmationNotice').innerHTML = method === 'online'
      ? (isOdoo
        ? '<strong>Payment confirmed by Odoo.</strong><span>Your native POS order and preparation ticket have been updated in real time.</span>'
        : '<strong>Preview only — no card was charged.</strong><span>In production, Odoo will create the native POS order, payment transaction and kitchen ticket in real time.</span>')
      : `<strong>Payment due at ${escapeHtml(location.short)}.</strong><span>Bring your order reference and pay using the branch card terminal when collecting.</span>`;

    if (isDemo && !document.getElementById('kitchenPreviewLink')) {
      const link = document.createElement('a');
      link.id = 'kitchenPreviewLink';
      link.className = 'text-link';
      link.href = 'Fuze-Kitchen-Display-Premium-Preview.html';
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.innerHTML = 'View kitchen ticket <span>↗</span>';
      document.querySelector('.checkout-confirmation__actions').appendChild(link);
    }

    form.hidden = true;
    summary.hidden = true;
    confirmation.hidden = false;
    layout.classList.add('is-complete');
    showStep('complete');

    if (!isDemo) {
      cart = [];
      writeStorage(CART_KEY, cart);
    }
  };

  const submitOdooOrder = async () => {
    const deliveryAddress = fulfilment() === 'delivery'
      ? [form.elements.street.value.trim(), form.elements.city.value.trim(), form.elements.deliveryInstructions.value.trim()].filter(Boolean).join(', ')
      : '';
    const payload = {
      customerName: `${form.elements.firstName.value.trim()} ${form.elements.lastName.value.trim()}`,
      customerEmail: form.elements.email.value.trim(),
      customerPhone: form.elements.phone.value.trim(),
      locationId: selectedLocation,
      fulfilment: fulfilment(),
      paymentMethod: paymentMethod(),
      deliveryAddress,
      orderNote: form.elements.orderNote.value.trim(),
      website: '',
      items: cart.map((item) => ({
        productId: item.productId || null,
        key: item.key || item.itemId || '',
        quantity: Number(item.quantity),
        selections: item.selections || [],
        note: item.note || ''
      }))
    };
    const response = await fetch('/fuze/api/order/create', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.message || 'Your order could not be created.');
    if (paymentMethod() === 'online') {
      if (!result.paymentUrl) throw new Error('The secure payment provider is not available.');
      window.location.assign(result.paymentUrl);
      return;
    }
    finishOrder(result);
  };

  form.addEventListener('change', (event) => {
    if (event.target.name === 'location') updateLocation(event.target.value);
    if (event.target.name === 'fulfilment') updateFulfilment();
    if (event.target.name === 'paymentMethod') updatePaymentMethod();
  });

  summaryItems.addEventListener('click', (event) => {
    const button = event.target.closest('[data-summary-action]');
    const line = event.target.closest('[data-line-id]');
    if (!button || !line) return;
    const index = cart.findIndex((item) => item.lineId === line.dataset.lineId);
    if (index < 0) return;
    const action = button.dataset.summaryAction;
    if (action === 'plus') cart[index].quantity = Math.min(20, Number(cart[index].quantity) + 1);
    if (action === 'minus') cart[index].quantity = Number(cart[index].quantity) - 1;
    if (action === 'remove' || cart[index].quantity <= 0) cart.splice(index, 1);
    if (!isDemo) writeStorage(CART_KEY, cart);
    renderSummary();
    updatePaymentMethod();
  });

  document.getElementById('continueToPayment').addEventListener('click', () => {
    if (!validateDetails()) return;
    showStep('payment');
    updatePaymentMethod();
  });

  document.getElementById('backToDetails').addEventListener('click', () => showStep('details'));
  document.querySelector('[data-progress-step="details"]').addEventListener('click', () => {
    if (currentStep !== 'complete') showStep('details');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    updatePaymentMethod();
    if (!form.reportValidity()) return;

    placeOrderButton.disabled = true;
    placeOrderButton.textContent = paymentMethod() === 'online'
      ? (isOdoo ? 'Opening secure payment…' : 'Securing preview…')
      : (isOdoo ? 'Creating your order…' : 'Reserving preview…');
    if (!isOdoo) {
      window.setTimeout(() => finishOrder(), 850);
      return;
    }
    try {
      await submitOdooOrder();
    } catch (error) {
      placeOrderButton.disabled = false;
      updatePaymentMethod();
      showToast(error.message || 'Your order could not be created. Please try again.');
    }
  });

  if (cart.length === 0) {
    showEmptyState();
    return;
  }

  if (locations[selectedLocation]) updateLocation(selectedLocation, false);
  else {
    summaryLocation.textContent = 'Choose a location';
    pickupLocationName.textContent = 'Choose a Fuze location';
  }
  updateFulfilment();
  renderSummary();
  updatePaymentMethod();
})();
