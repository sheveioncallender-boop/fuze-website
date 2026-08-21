(() => {
  const catalogue = document.getElementById('menuCatalogue');
  if (!catalogue || !window.FUZE_MENU) return;

  const categories = document.getElementById('menuCategories');
  const search = document.getElementById('menuSearch');
  const visibleCount = document.getElementById('visibleCount');
  const activeFilter = document.getElementById('activeFilter');
  const activeFilterText = document.getElementById('activeFilterText');
  const clearFilter = document.getElementById('clearFilter');
  const empty = document.getElementById('menuEmpty');
  const itemModal = document.getElementById('itemModal');
  const itemModalContent = document.getElementById('itemModalContent');
  const cartLayer = document.getElementById('cartLayer');
  const cartItems = document.getElementById('cartItems');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartFooter = document.getElementById('cartFooter');
  const cartSubtotal = document.getElementById('cartSubtotal');
  const cartLocation = document.getElementById('cartLocation');
  const toast = document.getElementById('orderToast');
  const data = window.FUZE_MENU;

  const LOCATION_KEY = 'fuze-order-location';
  const CART_KEY = 'fuze-order-cart';
  const locations = {
    east: { name: 'East Gates Mall', phone: '868-292-FUZE' },
    bagshot: { name: 'Bagshot BoxPark', phone: '868-336-FUZE' }
  };

  let selectedCategory = 'all';
  let searchTerm = '';
  let selectedLocation = readStorage(LOCATION_KEY, '');
  let cart = readStorage(CART_KEY, []);
  let toastTimer;

  if (!Array.isArray(cart)) cart = [];

  function readStorage(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_error) { /* Preview works without persistence. */ }
  }

  const escapeHtml = (value) => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const slugLabel = (tag) => ({ spicy: 'Spicy', vegetarian: 'Vegetarian', favourite: 'Fuze favourite' }[tag] || tag);
  const itemId = (category, index) => category.items[index]?.key || `${category.id}-${index}`;

  const entryTemplate = (item, index, category) => `
    <article class="menu-entry">
      <div class="menu-entry__number">${String(index + 1).padStart(2, '0')}</div>
      <div class="menu-entry__copy">
        <div class="menu-entry__heading"><h3>${escapeHtml(item.name)}</h3><strong>$${item.price}</strong></div>
        <p>${escapeHtml(item.detail)}</p>
        <div class="menu-entry__bottom">
          ${item.tags?.length ? `<div class="menu-entry__tags">${item.tags.map((tag) => `<span class="menu-tag menu-tag--${tag}">${slugLabel(tag)}</span>`).join('')}</div>` : '<span></span>'}
          <button class="menu-entry__add" type="button" data-add-item="${itemId(category, category.items.indexOf(item))}" aria-label="Add ${escapeHtml(item.name)} to your order">Add <span>+</span></button>
        </div>
      </div>
    </article>`;

  const categoryTemplate = (category, items, categoryIndex) => `
    <section class="menu-category-block" id="${category.id}" data-menu-category="${category.id}">
      <header class="menu-category-block__heading">
        <div class="menu-category-block__number">${String(categoryIndex + 1).padStart(2, '0')}</div>
        <div><p>Fuze menu</p><h2>${escapeHtml(category.title)}</h2>${category.note ? `<span>${escapeHtml(category.note)}</span>` : ''}</div>
        <strong>${items.length} ${items.length === 1 ? 'item' : 'items'}</strong>
      </header>
      <div class="menu-entry-grid">${items.map((item, index) => entryTemplate(item, index, category)).join('')}</div>
    </section>`;

  const matchesSearch = (item) => {
    if (!searchTerm) return true;
    const haystack = `${item.name} ${item.detail} ${(item.tags || []).join(' ')}`.toLowerCase();
    return haystack.includes(searchTerm);
  };

  const renderMenu = () => {
    const groups = data
      .filter((category) => selectedCategory === 'all' || category.id === selectedCategory)
      .map((category) => ({ ...category, filteredItems: category.items.filter(matchesSearch) }))
      .filter((category) => category.filteredItems.length);

    const count = groups.reduce((sum, category) => sum + category.filteredItems.length, 0);
    catalogue.innerHTML = groups.map((category) => categoryTemplate(category, category.filteredItems, data.findIndex((item) => item.id === category.id))).join('');
    visibleCount.textContent = count;
    empty.hidden = count !== 0;
    catalogue.hidden = count === 0;

    const filterParts = [];
    if (selectedCategory !== 'all') filterParts.push(data.find((category) => category.id === selectedCategory)?.title || selectedCategory);
    if (searchTerm) filterParts.push(`“${search.value.trim()}”`);
    activeFilter.hidden = filterParts.length === 0;
    activeFilterText.textContent = filterParts.join(' + ');

    categories.querySelectorAll('button').forEach((button) => {
      const active = button.dataset.category === selectedCategory;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const showToast = (message) => {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add('is-visible');
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 2600);
  };

  const setLocation = (locationId) => {
    if (!locations[locationId]) return;
    selectedLocation = locationId;
    writeStorage(LOCATION_KEY, selectedLocation);
    document.querySelectorAll('[data-location]').forEach((button) => {
      const active = button.dataset.location === selectedLocation;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    cartLocation.textContent = locations[selectedLocation].name;
    const modalWarning = document.getElementById('modalLocationWarning');
    if (modalWarning) modalWarning.hidden = true;
  };

  const findItem = (identifier) => {
    for (const category of data) {
      const index = category.items.findIndex((item, itemIndex) => itemId(category, itemIndex) === identifier);
      if (index >= 0) return { category, item: category.items[index], index };
    }
    return null;
  };

  const standardSides = data.find((category) => category.id === 'sides').items.map((item) => item.name);
  const premiumSides = data.find((category) => category.id === 'premium-sides').items.map((item) => item.name);
  const selectOptions = (items) => items.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('');

  const optionFields = (category, item) => {
    const fields = [];
    if (['burgers', 'wraps', 'waffles'].includes(category.id)) {
      fields.push('<div class="order-included"><span>✓</span><p><strong>Fuze fries included</strong><small>This meal is served with fries.</small></p></div>');
    }

    if (category.id === 'pasta') {
      fields.push(`
        <fieldset class="order-options"><legend>Choose your sauce</legend>
          <div class="order-choice-grid">
            ${['Creamy Alfredo', 'Marinara', 'Pesto', 'Rosé'].map((sauce, index) => `<label><input type="radio" name="sauce" value="${sauce}" data-option-label="Sauce" ${index === 0 ? 'checked' : ''}><span>${sauce}</span></label>`).join('')}
          </div>
        </fieldset>`);
    }

    if (category.id === 'signature' && !['The Ultimate Fuze Box', 'Steak + Mash Potatoes'].includes(item.name)) {
      const sides = item.name === '10 oz Striploin Steak' ? premiumSides : standardSides;
      const label = item.name === '10 oz Striploin Steak' ? 'Choose your two premium sides' : 'Choose your two sides';
      fields.push(`
        <fieldset class="order-options"><legend>${label}</legend>
          <div class="order-select-grid">
            <label><span>Side one</span><select name="sideOne" data-option-label="Side 1">${selectOptions(sides)}</select></label>
            <label><span>Side two</span><select name="sideTwo" data-option-label="Side 2">${selectOptions(sides)}</select></label>
          </div>
        </fieldset>`);
    }

    if (item.name === 'Chicky Tenders') {
      fields.push(`
        <fieldset class="order-options"><legend>Choose your sauce</legend>
          <div class="order-choice-grid order-choice-grid--two">
            <label><input type="radio" name="tenderSauce" value="Spicy Honey BBQ" data-option-label="Sauce" checked><span>Spicy Honey BBQ</span></label>
            <label><input type="radio" name="tenderSauce" value="Honey Mustard" data-option-label="Sauce"><span>Honey Mustard</span></label>
          </div>
        </fieldset>`);
    }
    return fields.join('');
  };

  const openItemModal = (identifier) => {
    const found = findItem(identifier);
    if (!found) return;
    const { category, item } = found;

    itemModalContent.innerHTML = `
      <form class="item-order-form" id="itemOrderForm" data-item-id="${identifier}">
        <header class="item-order-form__header">
          <p>${escapeHtml(category.title)}</p>
          <h2 id="itemModalTitle">${escapeHtml(item.name)}</h2>
          <span>${escapeHtml(item.detail)}</span>
          <strong>$${item.price}</strong>
        </header>
        <fieldset class="order-options order-options--location">
          <legend>Choose your location</legend>
          <div class="modal-location-grid">
            ${Object.entries(locations).map(([id, location]) => `<button type="button" data-location="${id}" aria-pressed="${selectedLocation === id}"><span>${location.name}</span><small>${location.phone}</small></button>`).join('')}
          </div>
          <p class="modal-location-warning" id="modalLocationWarning" ${selectedLocation ? 'hidden' : ''}>Please choose where you are ordering from.</p>
        </fieldset>
        ${optionFields(category, item)}
        <label class="order-note"><span>Special instructions <small>Optional</small></span><textarea name="note" maxlength="180" placeholder="Allergies, preparation requests or anything we should know…"></textarea></label>
        <div class="item-order-form__footer">
          <div class="quantity-stepper" aria-label="Quantity"><button type="button" data-quantity-minus aria-label="Decrease quantity">−</button><output id="itemQuantity">1</output><button type="button" data-quantity-plus aria-label="Increase quantity">+</button></div>
          <button class="button button--orange item-add-button" type="submit">Add to order <strong id="itemTotal">$${item.price}</strong></button>
        </div>
      </form>`;

    itemModal.hidden = false;
    requestAnimationFrame(() => itemModal.classList.add('is-open'));
    document.body.classList.add('order-open');
    if (selectedLocation) setLocation(selectedLocation);
    bindItemForm(item, category);
    itemModal.querySelector('[data-modal-close]').focus();
  };

  const closeItemModal = () => {
    itemModal.classList.remove('is-open');
    document.body.classList.remove('order-open');
    window.setTimeout(() => { itemModal.hidden = true; itemModalContent.innerHTML = ''; }, 320);
  };

  const bindItemForm = (item, category) => {
    const form = document.getElementById('itemOrderForm');
    const output = document.getElementById('itemQuantity');
    const total = document.getElementById('itemTotal');
    let quantity = 1;

    const updateQuantity = (next) => {
      quantity = Math.min(20, Math.max(1, next));
      output.textContent = quantity;
      total.textContent = `$${item.price * quantity}`;
    };

    form.querySelector('[data-quantity-minus]').addEventListener('click', () => updateQuantity(quantity - 1));
    form.querySelector('[data-quantity-plus]').addEventListener('click', () => updateQuantity(quantity + 1));

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!selectedLocation) {
        document.getElementById('modalLocationWarning').hidden = false;
        document.querySelector('.modal-location-grid').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      const selections = [];
      form.querySelectorAll('[data-option-label]').forEach((field) => {
        if (field.type === 'radio' && !field.checked) return;
        if (field.type === 'checkbox' && !field.checked) return;
        selections.push({ label: field.dataset.optionLabel, value: field.value });
      });

      cart.push({
        lineId: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        itemId: form.dataset.itemId,
        productId: item.productId || null,
        key: item.key || form.dataset.itemId,
        category: category.title,
        name: item.name,
        price: item.price,
        quantity,
        selections,
        note: form.elements.note.value.trim()
      });
      saveAndRenderCart();
      closeItemModal();
      showToast(`${item.name} added to your order.`);
    });
  };

  const renderCart = () => {
    const quantity = cart.reduce((sum, item) => sum + item.quantity, 0);
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    document.querySelectorAll('[data-cart-count]').forEach((element) => { element.textContent = quantity; });
    cartLocation.textContent = selectedLocation ? locations[selectedLocation].name : 'Choose a location';
    cartEmpty.hidden = cart.length !== 0;
    cartFooter.hidden = cart.length === 0;
    cartSubtotal.textContent = `$${subtotal}`;

    cartItems.innerHTML = cart.map((item) => `
      <article class="cart-item" data-line-id="${item.lineId}">
        <div class="cart-item__top"><div><p>${escapeHtml(item.category)}</p><h3>${escapeHtml(item.name)}</h3></div><strong>$${item.price * item.quantity}</strong></div>
        ${item.selections.length ? `<ul>${item.selections.map((selection) => `<li><span>${escapeHtml(selection.label)}</span>${escapeHtml(selection.value)}</li>`).join('')}</ul>` : ''}
        ${item.note ? `<p class="cart-item__note">“${escapeHtml(item.note)}”</p>` : ''}
        <div class="cart-item__actions"><div class="cart-quantity"><button type="button" data-cart-action="minus" aria-label="Decrease ${escapeHtml(item.name)}">−</button><span>${item.quantity}</span><button type="button" data-cart-action="plus" aria-label="Increase ${escapeHtml(item.name)}">+</button></div><button class="cart-item__remove" type="button" data-cart-action="remove">Remove</button></div>
      </article>`).join('');
  };

  const saveAndRenderCart = () => {
    writeStorage(CART_KEY, cart);
    renderCart();
  };

  const openCart = () => {
    document.getElementById('menuToggle')?.setAttribute('aria-expanded', 'false');
    document.getElementById('mobileNav')?.classList.remove('is-open');
    document.body.classList.remove('nav-open');
    cartLayer.hidden = false;
    requestAnimationFrame(() => cartLayer.classList.add('is-open'));
    document.body.classList.add('order-open');
    cartLayer.querySelector('[data-cart-close]').focus();
  };

  const closeCart = () => {
    cartLayer.classList.remove('is-open');
    document.body.classList.remove('order-open');
    window.setTimeout(() => { cartLayer.hidden = true; }, 320);
  };

  categories.innerHTML = [
    '<button class="is-active" type="button" data-category="all" aria-pressed="true">All</button>',
    ...data.map((category) => `<button type="button" data-category="${category.id}" aria-pressed="false">${escapeHtml(category.title)}</button>`)
  ].join('');

  categories.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-category]');
    if (!button) return;
    selectedCategory = button.dataset.category;
    renderMenu();
    const top = document.getElementById('fullMenu').getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: 'smooth' });
    const menuPath = window.FUZE_ODOO ? '/menu' : 'menu.html';
    history.replaceState(null, '', selectedCategory === 'all' ? `${menuPath}#fullMenu` : `${menuPath}#${selectedCategory}`);
  });

  catalogue.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add-item]');
    if (addButton) openItemModal(addButton.dataset.addItem);
  });

  search.addEventListener('input', () => {
    searchTerm = search.value.trim().toLowerCase();
    renderMenu();
  });

  const resetFilters = () => {
    selectedCategory = 'all';
    searchTerm = '';
    search.value = '';
    renderMenu();
    search.focus();
  };

  clearFilter.addEventListener('click', resetFilters);
  empty.querySelector('button').addEventListener('click', resetFilters);

  document.addEventListener('click', (event) => {
    const locationButton = event.target.closest('[data-location]');
    if (locationButton) setLocation(locationButton.dataset.location);
    if (event.target.closest('[data-cart-open]')) openCart();
    if (event.target.closest('[data-cart-close]')) closeCart();
    if (event.target.closest('[data-modal-close]')) closeItemModal();
  });

  cartItems.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-cart-action]');
    const cartItem = event.target.closest('[data-line-id]');
    if (!actionButton || !cartItem) return;
    const index = cart.findIndex((item) => item.lineId === cartItem.dataset.lineId);
    if (index < 0) return;
    const action = actionButton.dataset.cartAction;
    if (action === 'plus') cart[index].quantity = Math.min(20, cart[index].quantity + 1);
    if (action === 'minus') cart[index].quantity -= 1;
    if (action === 'remove' || cart[index].quantity <= 0) cart.splice(index, 1);
    saveAndRenderCart();
  });

  document.getElementById('continueCheckout').addEventListener('click', () => {
    if (!cart.length) return;
    if (!selectedLocation || !locations[selectedLocation]) {
      showToast('Choose a Fuze location before continuing.');
      return;
    }
    window.location.href = window.FUZE_ODOO ? '/checkout' : 'checkout.html';
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!itemModal.hidden) closeItemModal();
    if (!cartLayer.hidden) closeCart();
  });

  const requestedCategory = location.hash.slice(1);
  if (data.some((category) => category.id === requestedCategory)) selectedCategory = requestedCategory;
  if (locations[selectedLocation]) setLocation(selectedLocation);
  else selectedLocation = '';
  renderMenu();
  renderCart();
})();
