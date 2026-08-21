(() => {
  const ORDER_KEY = 'fuze-kds-orders';
  const SETTINGS_KEY = 'fuze-kds-settings';
  const live = window.FUZE_KDS_BOOTSTRAP || null;
  const isOdoo = Boolean(live);
  const imageBase = isOdoo ? '/fuze_website/static/src/images/' : 'assets/images/';
  const imagePath = (name) => {
    if (!name) return '';
    if (/^(?:https?:)?\//.test(name)) return name;
    return window.FUZE_KDS_IMAGE_MAP?.[name] || `${imageBase}${name}`;
  };
  const stageOrder = ['new', 'acknowledged', 'preparing', 'ready', 'completed', 'cancelled'];
  const stageLabels = {
    new: 'New orders',
    acknowledged: 'Acknowledged',
    preparing: 'Preparing now',
    ready: 'Ready to collect',
    completed: 'Completed orders',
    cancelled: 'Cancelled orders'
  };
  const nextStage = {
    new: ['acknowledged', 'Acknowledge'],
    acknowledged: ['preparing', 'Start preparing'],
    preparing: ['ready', 'Mark ready'],
    ready: ['completed', 'Complete order']
  };
  const branchLabels = { east: 'East Gates', bagshot: 'Bagshot', all: 'Both locations' };
  const stationLabels = { all: 'All stations', grill: 'Grill', fryer: 'Fryer', kitchen: 'Kitchen', drinks: 'Drinks', dessert: 'Dessert' };
  (live?.branches || []).forEach((branch) => { branchLabels[branch.id] = branch.name; });
  (live?.stations || []).forEach((station) => { stationLabels[station.id] = station.name; });

  const now = Date.now();
  const seedOrders = () => [
    {
      id: 'FZ-1068', sequence: 68, branch: 'east', stage: 'new', createdAt: now - 4 * 60000,
      customer: 'Amara James', phone: '868-555-0132', fulfilment: 'pickup', payment: 'paid', source: 'Website', note: 'Please pack sauces separately.',
      items: [
        { id: '68-1', qty: 2, name: 'Angus Smash Beef', station: 'grill', image: 'fuze-angus-smash-reel-poster.jpg', options: ['Cheddar cheese', 'Fuze sauce', 'Seasoned fries'], note: 'One burger without pickles.' },
        { id: '68-2', qty: 1, name: 'Passion Fruit Refresher', station: 'drinks', image: 'fuze-review-reel-poster.jpg', options: ['Less ice'], note: '' }
      ]
    },
    {
      id: 'FZ-1067', sequence: 67, branch: 'east', stage: 'new', createdAt: now - 9 * 60000,
      customer: 'Daniel Peters', phone: '868-555-0198', fulfilment: 'delivery', payment: 'paid', source: 'Website', note: 'Call on arrival. Red gate opposite the pharmacy.',
      items: [
        { id: '67-1', qty: 1, name: 'Maracas Fish Fry', station: 'fryer', image: 'maracas-social.webp', options: ['Coconut bake', 'Tamarind sauce', 'Pineapple chow'], note: 'Fish well done.' },
        { id: '67-2', qty: 2, name: 'Baked Chicken Empanadas', station: 'kitchen', image: 'empanada-social.webp', options: ['Garlic sauce'], note: '' }
      ]
    },
    {
      id: 'FZ-1066', sequence: 66, branch: 'bagshot', stage: 'acknowledged', createdAt: now - 13 * 60000,
      customer: 'Sasha Ali', phone: '868-555-0120', fulfilment: 'pickup', payment: 'store', source: 'Website', note: '',
      items: [
        { id: '66-1', qty: 1, name: 'Hot Jack Burger', station: 'grill', image: 'hot-jack-special.jpg', options: ['Pepper jack cheese', 'Jalapeños', 'Sweet potato fries'], note: 'No onions.' },
        { id: '66-2', qty: 1, name: 'Chocolate Milkshake', station: 'drinks', image: 'fuze-dessert-reel-poster.jpg', options: ['Whipped cream'], note: '' }
      ]
    },
    {
      id: 'FZ-1065', sequence: 65, branch: 'east', stage: 'preparing', createdAt: now - 18 * 60000,
      customer: 'Marcus Lewis', phone: '868-555-0164', fulfilment: 'pickup', payment: 'paid', source: 'Counter', note: 'Customer has a shellfish allergy.',
      items: [
        { id: '65-1', qty: 1, name: 'Trini-Fried Rice', station: 'kitchen', image: 'trini-fried-rice-special.jpg', options: ['Geera chicken', 'Fried egg', 'Pepper on side'], note: '' },
        { id: '65-2', qty: 1, name: 'Herb-in-Fuzed Fish', station: 'kitchen', image: 'fish-card.webp', options: ['Mashed potatoes', 'Seasonal vegetables'], note: 'NO SHELLFISH CONTACT.' }
      ]
    },
    {
      id: 'FZ-1064', sequence: 64, branch: 'bagshot', stage: 'ready', createdAt: now - 22 * 60000,
      customer: 'Kiara Joseph', phone: '868-555-0181', fulfilment: 'pickup', payment: 'paid', source: 'Website', note: '',
      items: [
        { id: '64-1', qty: 2, name: 'Baked Chicken Empanadas', station: 'kitchen', image: 'empanada-card.webp', options: ['Fuze sauce'], note: '' },
        { id: '64-2', qty: 1, name: 'Custard Creation', station: 'dessert', image: 'fuze-dessert-reel-poster.jpg', options: ['Oreo crumble', 'Caramel drizzle'], note: 'Birthday order.' }
      ]
    },
    {
      id: 'FZ-1062', sequence: 62, branch: 'east', stage: 'cancelled', createdAt: now - 31 * 60000,
      customer: 'Ryan Singh', phone: '868-555-0177', fulfilment: 'pickup', payment: 'store', source: 'Website', note: '',
      items: [
        { id: '62-1', qty: 1, name: 'Rasta Pasta', station: 'kitchen', image: 'trini-fried-rice-special.jpg', options: ['Creamy Alfredo', 'Grilled chicken'], note: '', cancelled: true, cancelReason: 'Customer requested · Changed order at counter' }
      ]
    }
  ];

  const demoTemplates = [
    {
      customer: 'Janelle Baptiste', phone: '868-555-0143', fulfilment: 'pickup', payment: 'paid', note: 'Extra napkins please.',
      items: [
        { qty: 1, name: 'Angus Smash Beef', station: 'grill', image: 'fuze-angus-smash-reel-poster.jpg', options: ['Bacon', 'Cheddar cheese', 'Seasoned fries'], note: 'Medium-well.' },
        { qty: 2, name: 'Strawberry Refresher', station: 'drinks', image: 'fuze-review-reel-poster.jpg', options: ['No ice'], note: '' }
      ]
    },
    {
      customer: 'Kareem Thomas', phone: '868-555-0119', fulfilment: 'delivery', payment: 'paid', note: 'Security will collect at the front desk.',
      items: [
        { qty: 2, name: 'Trini-Fried Rice', station: 'kitchen', image: 'trini-fried-rice-special.jpg', options: ['Stewed chicken', 'Fried egg', 'Slight pepper'], note: '' },
        { qty: 1, name: 'Custard Creation', station: 'dessert', image: 'fuze-dessert-reel-poster.jpg', options: ['Biscoff crumble'], note: '' }
      ]
    },
    {
      customer: 'Leah Williams', phone: '868-555-0188', fulfilment: 'pickup', payment: 'store', note: '',
      items: [
        { qty: 1, name: 'Maracas Fish Fry', station: 'fryer', image: 'maracas-social.webp', options: ['Coconut bake', 'Mango chutney'], note: 'Sauces on the side.' }
      ]
    }
  ];

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_error) { return fallback; }
  };
  const writeJson = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) { /* Preview still works without storage. */ }
  };
  const readOdooResponse = async (response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (_error) {
      throw new Error(`Odoo returned an invalid response (HTTP ${response.status}). Refresh the display and sign in again if needed.`);
    }
  };
  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  let orders = isOdoo ? (live.orders || []) : readJson(ORDER_KEY, null);
  if (!Array.isArray(orders) || (!orders.length && !isOdoo)) orders = seedOrders();
  orders = orders.map((order) => ({ ...order, createdAt: Number(order.createdAt) || Date.now() }));

  let settings = {
    sound: true, repeat: true, volume: 70, images: true, density: 'comfortable',
    branch: 'east', stage: 'new', station: 'all',
    ...(live?.settings || {}),
    ...readJson(SETTINGS_KEY, {})
  };
  let audioContext;
  let alertLoop;
  let toastTimer;
  let demoIndex = 0;

  const app = document.getElementById('kdsApp');
  const orderGrid = document.getElementById('orderGrid');
  const emptyState = document.getElementById('emptyState');
  const stageTabs = document.getElementById('stageTabs');
  const branchFilters = document.getElementById('branchFilters');
  const stationFilters = document.getElementById('stationFilters');
  const settingsDrawer = document.getElementById('settingsDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const soundButton = document.getElementById('soundButton');
  const soundToggle = document.getElementById('soundToggle');
  const repeatToggle = document.getElementById('repeatToggle');
  const volumeControl = document.getElementById('volumeControl');
  const volumeValue = document.getElementById('volumeValue');
  const imageToggle = document.getElementById('imageToggle');
  const startDialog = document.getElementById('startDialog');
  const cancelDialog = document.getElementById('cancelDialog');
  const toast = document.getElementById('kdsToast');

  if (isOdoo) {
    const liveBranches = live.branches || [];
    const liveStations = live.stations || [];
    branchFilters.innerHTML = [
      ...liveBranches.map((branch) => `<button type="button" data-branch="${escapeHtml(branch.id)}">${escapeHtml(branch.name)}</button>`),
      '<button type="button" data-branch="all">All locations</button>'
    ].join('');
    stationFilters.innerHTML = [
      '<button type="button" data-station="all">All <b id="stationAllCount">0</b></button>',
      ...liveStations.map((station) => `<button type="button" data-station="${escapeHtml(station.id)}">${escapeHtml(station.name)}</button>`)
    ].join('');
    if (!liveBranches.some((branch) => branch.id === settings.branch) && settings.branch !== 'all') {
      settings.branch = liveBranches[0]?.id || 'all';
    }
    if (!liveStations.some((station) => station.id === settings.station)) settings.station = 'all';
  }

  const save = () => {
    if (!isOdoo) writeJson(ORDER_KEY, orders);
    writeJson(SETTINGS_KEY, settings);
  };

  const showToast = (message) => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2700);
  };

  const ensureAudio = () => {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === 'suspended') audioContext.resume();
    return audioContext;
  };

  const playNewOrderSound = () => {
    if (!settings.sound) return;
    const context = ensureAudio();
    const gain = context.createGain();
    gain.connect(context.destination);
    const start = context.currentTime;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(.015, settings.volume / 100 * .22), start + .02);
    gain.gain.exponentialRampToValueAtTime(.0001, start + 1.05);
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start + index * .18);
      oscillator.connect(gain);
      oscillator.start(start + index * .18);
      oscillator.stop(start + .25 + index * .18);
    });
  };

  const formatElapsed = (createdAt) => {
    const minutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
    if (minutes < 1) return '<1 min';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  };

  const visibleOrders = () => orders
    .filter((order) => order.stage === settings.stage)
    .filter((order) => settings.branch === 'all' || order.branch === settings.branch)
    .filter((order) => settings.station === 'all' || order.items.some((item) => item.station === settings.station && !item.cancelled))
    .sort((a, b) => a.createdAt - b.createdAt);

  const renderItem = (order, item) => {
    const isVisibleStation = settings.station === 'all' || item.station === settings.station || item.cancelled;
    if (!isVisibleStation) return '';
    return `
      <article class="kds-line${item.cancelled ? ' is-cancelled' : ''}">
        ${settings.images && item.image ? `<img class="kds-line__image" src="${imagePath(item.image)}" alt="">` : `<span class="kds-line__qty">${Number(item.qty) || 1}×</span>`}
        <div class="kds-line__content">
          <h3>${settings.images && item.image ? `${Number(item.qty) || 1}× ` : ''}${escapeHtml(item.name)}</h3>
          ${item.options?.length ? `<ul>${item.options.map((option) => `<li>${escapeHtml(option)}</li>`).join('')}</ul>` : ''}
          ${item.note ? `<p class="kds-line__note">NOTE · ${escapeHtml(item.note)}</p>` : ''}
          ${item.cancelled ? `<p class="kds-line__cancelled">VOIDED · ${escapeHtml(item.cancelReason || 'No reason supplied')}</p>` : ''}
        </div>
        ${!item.cancelled && !['completed', 'cancelled'].includes(order.stage) ? `<button class="kds-line__cancel" type="button" data-action="cancel-item" data-order="${escapeHtml(order.id)}" data-item="${escapeHtml(item.id)}" aria-label="Cancel ${escapeHtml(item.name)}" title="Cancel item">×</button>` : '<span></span>'}
      </article>`;
  };

  const renderTicket = (order) => {
    const elapsedMinutes = Math.floor((Date.now() - order.createdAt) / 60000);
    const primary = nextStage[order.stage];
    const allCancelled = order.items.every((item) => item.cancelled);
    const activeItems = order.items.filter((item) => !item.cancelled);
    return `
      <article class="kds-ticket${elapsedMinutes >= Number(settings.urgentAfter || 15) && !['ready','completed','cancelled'].includes(order.stage) ? ' is-urgent' : ''}" data-order-id="${escapeHtml(order.id)}" data-stage="${escapeHtml(order.stage)}">
        <header class="kds-ticket__head">
          <div class="kds-ticket__number"><span>${String(order.sequence).slice(-2)}</span><div><p>Order reference</p><h2>${escapeHtml(order.id)}</h2></div></div>
          <div class="kds-ticket__time"><strong>${formatElapsed(order.createdAt)}</strong><small>elapsed</small></div>
        </header>
        <div class="kds-ticket__meta">
          <span class="kds-pill kds-pill--orange">${order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}</span>
          <span class="kds-pill ${order.payment === 'paid' ? 'kds-pill--paid' : 'kds-pill--due'}">${escapeHtml(order.paymentLabel || (order.payment === 'paid' ? 'Paid' : 'Card at store'))}</span>
          <span class="kds-pill">${escapeHtml(branchLabels[order.branch])}</span>
          <span class="kds-pill">${escapeHtml(order.source || 'Website')}</span>
        </div>
        <div class="kds-ticket__customer">
          <div><span>Customer</span><strong>${escapeHtml(order.customer)}</strong></div>
          <div><span>Contact</span><strong>${escapeHtml(order.phone)}</strong></div>
        </div>
        <div class="kds-ticket__items">${order.items.map((item) => renderItem(order, item)).join('')}</div>
        ${order.note ? `<div class="kds-ticket__note"><strong>Order instruction</strong>${escapeHtml(order.note)}</div>` : ''}
        ${isOdoo && order.payment === 'store' && !['completed', 'cancelled'].includes(order.stage) ? `<div class="kds-ticket__payment"><span>Terminal payment due</span><button type="button" data-action="pay-store" data-order="${escapeHtml(order.id)}">Confirm card paid</button></div>` : ''}
        <footer class="kds-ticket__footer">
          ${primary && !allCancelled ? `<button class="kds-ticket__secondary" type="button" data-action="print" data-order="${escapeHtml(order.id)}">Print</button><button class="kds-ticket__primary" type="button" data-action="advance" data-order="${escapeHtml(order.id)}">${primary[1]} →</button>` : `<div class="kds-ticket__stage-label">${allCancelled ? 'Order cancelled' : escapeHtml(stageLabels[order.stage])}</div>`}
        </footer>
      </article>`;
  };

  const updateCounts = () => {
    stageTabs.querySelectorAll('[data-stage]').forEach((button) => {
      const count = orders.filter((order) => order.stage === button.dataset.stage)
        .filter((order) => settings.branch === 'all' || order.branch === settings.branch)
        .filter((order) => settings.station === 'all' || order.items.some((item) => item.station === settings.station && !item.cancelled)).length;
      button.querySelector('b').textContent = count;
    });
    const stationCount = orders.filter((order) => order.stage === settings.stage)
      .filter((order) => settings.branch === 'all' || order.branch === settings.branch).length;
    document.getElementById('stationAllCount').textContent = stationCount;
  };

  const updateControls = () => {
    stageTabs.querySelectorAll('[data-stage]').forEach((button) => button.classList.toggle('is-active', button.dataset.stage === settings.stage));
    branchFilters.querySelectorAll('[data-branch]').forEach((button) => button.classList.toggle('is-active', button.dataset.branch === settings.branch));
    stationFilters.querySelectorAll('[data-station]').forEach((button) => button.classList.toggle('is-active', button.dataset.station === settings.station));
    document.getElementById('workspaceTitle').textContent = stageLabels[settings.stage].toUpperCase();
    document.getElementById('workspaceBranch').textContent = branchLabels[settings.branch];
    document.getElementById('workspaceStation').textContent = stationLabels[settings.station];
    soundToggle.checked = settings.sound;
    repeatToggle.checked = settings.repeat;
    volumeControl.value = settings.volume;
    volumeValue.textContent = `${settings.volume}%`;
    imageToggle.checked = settings.images;
    soundButton.classList.toggle('is-active', settings.sound);
    soundButton.title = settings.sound ? 'Sound on' : 'Sound muted';
    soundButton.setAttribute('aria-label', settings.sound ? 'Mute new order sound' : 'Enable new order sound');
    app.classList.toggle('hide-images', !settings.images);
    app.classList.toggle('is-compact', settings.density === 'compact');
    document.querySelectorAll('[data-density]').forEach((button) => button.classList.toggle('is-active', button.dataset.density === settings.density));
  };

  const render = () => {
    updateControls();
    updateCounts();
    const visible = visibleOrders();
    orderGrid.innerHTML = visible.map(renderTicket).join('');
    orderGrid.hidden = visible.length === 0;
    emptyState.hidden = visible.length > 0;
    document.getElementById('visibleOrderCount').textContent = visible.length;
    save();
  };

  const selectStage = (stage) => {
    if (!stageOrder.includes(stage)) return;
    settings.stage = stage;
    render();
  };

  const postAction = async (endpoint, payload) => {
    const body = new URLSearchParams();
    body.set('csrf_token', live.csrfToken);
    body.set('payload', JSON.stringify({ ...payload, displayId: live.displayId }));
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: body.toString()
    });
    const result = await readOdooResponse(response);
    if (!response.ok || !result.ok) throw new Error(result.message || 'The kitchen action could not be saved.');
    return result;
  };

  const refreshLiveOrders = async (announceNew = true) => {
    if (!isOdoo) return;
    const currentIds = new Set(orders.map((order) => order.id));
    const response = await fetch(`${live.ordersEndpoint}?display_id=${encodeURIComponent(live.displayId)}`, {
      headers: { 'Accept': 'application/json' }, cache: 'no-store'
    });
    const result = await readOdooResponse(response);
    if (!response.ok || !result.ok || !Array.isArray(result.orders)) throw new Error(result.message || 'Live orders could not be refreshed.');
    const hasNew = result.orders.some((order) => !currentIds.has(order.id) && order.stage === 'new');
    orders = result.orders.map((order) => ({ ...order, createdAt: Number(order.createdAt) || Date.now() }));
    render();
    if (hasNew && announceNew) {
      playNewOrderSound();
      showToast('A new Odoo order was received.');
    }
  };

  const advanceOrder = async (orderId) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order || !nextStage[order.stage]) return;
    if (isOdoo) {
      try {
        await postAction(live.advanceEndpoint, { orderId: order.recordId });
        await refreshLiveOrders(false);
        showToast(`${order.id} moved to the next preparation stage.`);
      } catch (error) {
        showToast(error.message || 'The order could not be updated.');
      }
      return;
    }
    const from = order.stage;
    order.stage = nextStage[order.stage][0];
    showToast(`${order.id} moved to ${stageLabels[order.stage]}.`);
    render();
    const remaining = visibleOrders();
    if (!remaining.length && from !== order.stage) selectStage(order.stage);
  };

  const confirmStorePayment = async (orderId) => {
    const order = orders.find((item) => item.id === orderId);
    if (!order || order.payment !== 'store') return;
    if (!window.confirm(`Confirm that the card terminal approved ${order.id}?`)) return;
    try {
      await postAction(live.storePaymentEndpoint, { orderId: order.recordId });
      await refreshLiveOrders(false);
      showToast(`${order.id} card payment recorded in Odoo POS.`);
    } catch (error) {
      showToast(error.message || 'The store payment could not be recorded.');
    }
  };

  const addDemoOrder = (payload = null) => {
    if (isOdoo) return;
    const template = payload || demoTemplates[demoIndex++ % demoTemplates.length];
    const sequence = Math.max(...orders.map((order) => Number(order.sequence) || 0), 1068) + 1;
    const branch = settings.branch === 'all' ? (sequence % 2 ? 'east' : 'bagshot') : settings.branch;
    const order = {
      ...template,
      id: template.id || `FZ-${sequence}`,
      sequence,
      branch: template.branch || branch,
      stage: 'new',
      createdAt: Date.now(),
      source: template.source || 'Website',
      items: (template.items || []).map((item, index) => ({ ...item, id: item.id || `${sequence}-${index + 1}` }))
    };
    orders.push(order);
    settings.stage = 'new';
    if (settings.branch !== 'all') settings.branch = order.branch;
    settings.station = 'all';
    render();
    playNewOrderSound();
    showToast(`New ${branchLabels[order.branch]} order ${order.id} received.`);
  };

  const openSettings = () => {
    settingsDrawer.classList.add('is-open');
    settingsDrawer.setAttribute('aria-hidden', 'false');
    drawerBackdrop.hidden = false;
    document.getElementById('settingsButton').setAttribute('aria-expanded', 'true');
  };
  const closeSettings = () => {
    settingsDrawer.classList.remove('is-open');
    settingsDrawer.setAttribute('aria-hidden', 'true');
    drawerBackdrop.hidden = true;
    document.getElementById('settingsButton').setAttribute('aria-expanded', 'false');
  };

  stageTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-stage]');
    if (button) selectStage(button.dataset.stage);
  });
  branchFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-branch]');
    if (!button) return;
    settings.branch = button.dataset.branch;
    render();
  });
  stationFilters.addEventListener('click', (event) => {
    const button = event.target.closest('[data-station]');
    if (!button) return;
    settings.station = button.dataset.station;
    render();
  });

  orderGrid.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'advance') advanceOrder(action.dataset.order);
    if (action.dataset.action === 'pay-store' && isOdoo) confirmStorePayment(action.dataset.order);
    if (action.dataset.action === 'print') showToast(`${action.dataset.order} sent to the kitchen printer.`);
    if (action.dataset.action === 'cancel-item') {
      document.getElementById('cancelOrderId').value = action.dataset.order;
      document.getElementById('cancelItemId').value = action.dataset.item;
      cancelDialog.querySelectorAll('input[name="cancelReason"]').forEach((input) => { input.checked = false; });
      document.getElementById('cancelNote').value = '';
      cancelDialog.showModal();
    }
  });

  document.getElementById('confirmCancel').addEventListener('click', async () => {
    const reason = cancelDialog.querySelector('input[name="cancelReason"]:checked');
    if (!reason) { showToast('Choose a cancellation reason first.'); return; }
    const order = orders.find((item) => item.id === document.getElementById('cancelOrderId').value);
    const item = order?.items.find((line) => line.id === document.getElementById('cancelItemId').value);
    if (!order || !item) return;
    const note = document.getElementById('cancelNote').value.trim();
    if (isOdoo) {
      try {
        await postAction(live.cancelEndpoint, {
          orderId: order.recordId,
          lineId: item.id,
          reason: reason.value,
          note
        });
        cancelDialog.close();
        await refreshLiveOrders(false);
        showToast(`${item.name} was cancelled with an Odoo audit reason.`);
      } catch (error) {
        showToast(error.message || 'The item could not be cancelled.');
      }
      return;
    }
    item.cancelled = true;
    item.cancelReason = `${reason.value}${note ? ` · ${note}` : ''}`;
    if (order.items.every((line) => line.cancelled)) order.stage = 'cancelled';
    cancelDialog.close();
    render();
    showToast(`${item.name} was cancelled with an audit reason.`);
  });

  const demoOrderButton = document.getElementById('newDemoOrder');
  const resetDemoButton = document.getElementById('resetDemo');
  if (isOdoo) {
    demoOrderButton.hidden = true;
    resetDemoButton.hidden = true;
    const connectionNote = document.querySelector('.kds-footer small');
    if (connectionNote) connectionNote.textContent = 'Live Odoo orders · automatic refresh';
  }
  demoOrderButton.addEventListener('click', () => addDemoOrder());
  document.getElementById('settingsButton').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  drawerBackdrop.addEventListener('click', closeSettings);
  soundButton.addEventListener('click', () => {
    settings.sound = !settings.sound;
    render();
    if (settings.sound) playNewOrderSound();
    showToast(settings.sound ? 'New-order sound enabled.' : 'New-order sound muted.');
  });
  soundToggle.addEventListener('change', () => { settings.sound = soundToggle.checked; render(); if (settings.sound) playNewOrderSound(); });
  repeatToggle.addEventListener('change', () => { settings.repeat = repeatToggle.checked; render(); });
  volumeControl.addEventListener('input', () => { settings.volume = Number(volumeControl.value); volumeValue.textContent = `${settings.volume}%`; save(); });
  volumeControl.addEventListener('change', playNewOrderSound);
  imageToggle.addEventListener('change', () => { settings.images = imageToggle.checked; render(); });
  document.querySelectorAll('[data-density]').forEach((button) => button.addEventListener('click', () => { settings.density = button.dataset.density; render(); }));
  document.getElementById('testSound').addEventListener('click', () => { ensureAudio(); playNewOrderSound(); showToast('New-order sound tested.'); });
  resetDemoButton.addEventListener('click', () => {
    orders = seedOrders();
    settings.stage = 'new'; settings.station = 'all';
    render(); closeSettings(); showToast('Demonstration orders restored.');
  });

  document.getElementById('fullscreenButton').addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      else await document.exitFullscreen();
    } catch (_error) { showToast('Fullscreen is not available in this preview window.'); }
  });

  document.getElementById('startDisplay').addEventListener('click', () => {
    const branch = startDialog.querySelector('input[name="startBranch"]:checked')?.value || 'east';
    settings.branch = branch;
    ensureAudio();
    startDialog.close();
    render();
    playNewOrderSound();
    showToast(`${branchLabels[branch]} kitchen display is live.`);
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, textarea') || cancelDialog.open) return;
    const stage = stageOrder[Number(event.key) - 1];
    if (stage) selectStage(stage);
    if (event.key.toLowerCase() === 'm') soundButton.click();
    const firstOrder = visibleOrders()[0];
    if (!firstOrder) return;
    if (event.key.toLowerCase() === 'a' && firstOrder.stage === 'new') advanceOrder(firstOrder.id);
    if (event.key.toLowerCase() === 's' && firstOrder.stage === 'acknowledged') advanceOrder(firstOrder.id);
    if (event.key.toLowerCase() === 'r' && firstOrder.stage === 'preparing') advanceOrder(firstOrder.id);
  });

  window.addEventListener('storage', (event) => {
    if (isOdoo) return;
    if (event.key !== ORDER_KEY || !event.newValue) return;
    const incoming = readJson(ORDER_KEY, []);
    if (!Array.isArray(incoming)) return;
    const currentIds = new Set(orders.map((order) => order.id));
    const hasNew = incoming.some((order) => !currentIds.has(order.id));
    orders = incoming;
    render();
    if (hasNew) { playNewOrderSound(); showToast('A new website order was received.'); }
  });

  const updateClock = () => {
    document.getElementById('liveClock').textContent = new Intl.DateTimeFormat('en-TT', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(new Date());
    document.querySelectorAll('.kds-ticket').forEach((ticket) => {
      const order = orders.find((item) => item.id === ticket.dataset.orderId);
      const time = ticket.querySelector('.kds-ticket__time strong');
      if (order && time) time.textContent = formatElapsed(order.createdAt);
    });
  };
  setInterval(updateClock, 1000);
  updateClock();

  alertLoop = setInterval(() => {
    if (!settings.repeat || !settings.sound || document.hidden || startDialog.open) return;
    const unacknowledged = orders.some((order) => order.stage === 'new' && (settings.branch === 'all' || order.branch === settings.branch));
    if (unacknowledged) playNewOrderSound();
  }, Math.max(5000, Number(settings.repeatSeconds || 20) * 1000));
  window.addEventListener('beforeunload', () => clearInterval(alertLoop));

  if (isOdoo) {
    const pollLoop = setInterval(() => {
      if (!document.hidden) refreshLiveOrders(true).catch(() => {});
    }, 4000);
    window.addEventListener('beforeunload', () => clearInterval(pollLoop));
  }

  render();
  const savedStartBranch = startDialog.querySelector(`input[name="startBranch"][value="${settings.branch === 'bagshot' ? 'bagshot' : 'east'}"]`);
  if (savedStartBranch) savedStartBranch.checked = true;
  if (typeof startDialog.showModal === 'function') startDialog.showModal();
})();
