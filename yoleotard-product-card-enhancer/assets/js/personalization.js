(function () {
  'use strict';
  function start() {
    if (window.YOProductCardPersonalization) return;
    const core = window.YOProductCardCore;
    if (!core) return;
    const cfg = core.cfg;
    const settings = cfg.personalization || {};
    if (!settings.enabled) return;
    const services = settings.services || {};
    const names = { chest: 'Chest', waist: 'Waist', hips: 'Hips', torso: 'Torso' };
    const labels = {
      size_adaptation: 'Adapt to my measurements',
      matching_headpiece: 'Matching headpiece',
      extra_rhinestones: 'Additional set of rhinestones'
    };
    const tips = {
      matching_headpiece: 'Handmade headpiece designed to match the colors and style of this leotard.',
      extra_rhinestones: 'Extra rhinestones matching this leotard for future repairs or additional decoration.'
    };
    const cards = new WeakMap();
    const states = new Map();
    let modalContext = null;
    let observer;
    function element(tag, className, text) {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    }
    function servicePrice(key) {
      const price = Number((services[key] || {}).priceEur);
      return Number.isFinite(price) && price >= 0 ? price : 0;
    }
    function measureNodes(card) {
      return core.safeQueryAll(card, cfg.selectors.measure).filter(node => core.findCardRoot(node) === card);
    }
    function readMeasurements(card) {
      const result = {};
      measureNodes(card).forEach(node => {
        const text = node.dataset.measurement || (node.parentElement && node.parentElement.textContent) || '';
        const key = Object.keys(names).find(name => new RegExp('\\b' + name + '\\b', 'i').test(text));
        if (!/^\s*\d+(?:[.,]\d+)?(?:\s*[-–—]\s*\d+(?:[.,]\d+)?)?\s*$/.test(node.dataset.cm || '')) return;
        const values = core.parseRange(node.dataset.cm);
        if (key && values && values.every(value => value > 4) && (values.length === 1 || values[0] <= values[1])) {
          result[key] = { node, values };
        }
      });
      return result;
    }
    function identity(card, base, measurements) {
      const explicit = card.dataset.productId || card.dataset.feedId || card.id;
      if (explicit) return { key: 'product:' + explicit, productId: explicit, source: 'product' };
      const title = card.querySelector(cfg.selectors.title);
      const signature = JSON.stringify([title ? title.textContent.trim() : '', base,
        Object.keys(names).map(key => measurements[key] ? measurements[key].values : null)]);
      return { key: 'local:' + signature, productId: null, source: 'local' };
    }
    function makeState(id) {
      if (states.has(id.key)) return states.get(id.key);
      const state = { identity: id, adjustments: { chest: 0, waist: 0, hips: 0, torso: 0 }, selected: {} };
      Object.keys(labels).forEach(key => { state.selected[key] = false; });
      states.set(id.key, state);
      return state;
    }
    function snapshot(card) {
      const record = cards.get(card);
      if (!record) return null;
      const addons = {};
      let extra = 0;
      Object.keys(labels).forEach(key => {
        const enabled = !!(services[key] && services[key].enabled && record.state.selected[key] &&
          (key !== 'size_adaptation' || Object.keys(record.measurements).length === 4));
        const price = servicePrice(key);
        addons[key] = { enabled, price_eur: price };
        if (key === 'size_adaptation') addons[key].adjustments = Object.assign({}, record.state.adjustments);
        if (enabled) extra += price;
      });
      return {
        schema_version: 1, product_id: record.state.identity.productId,
        card_key: record.state.identity.key, identity_source: record.state.identity.source,
        currency: core.getCurrency(), base_price_eur: record.base,
        product_discount_eur: record.discount, discounted_base_price_eur: record.base - record.discount,
        addons_price_eur: Math.round(extra * 100) / 100,
        display_total_eur: Math.round((record.base - record.discount + extra) * 100) / 100,
        addons
      };
    }
    function publish(card, type) {
      const state = snapshot(card);
      if (state) card.dispatchEvent(new CustomEvent(type || 'yo:pce:addons-changed', { bubbles: true, detail: state }));
    }
    function refresh(card) {
      const record = cards.get(card);
      if (!record) return;
      core.safeQueryAll(document, '.yo-personalized-card').forEach(target => {
        const targetRecord = cards.get(target);
        if (!targetRecord || targetRecord.state !== record.state) return;
        const data = snapshot(target);
        // Checkout still reads the discounted product price from data-eur.
        targetRecord.price.dataset.yoDisplayEur = String(data.display_total_eur);
        Object.keys(labels).forEach(key => {
          const input = target.querySelector('[data-yo-service="' + key + '"]');
          if (input) input.checked = !!record.state.selected[key] && !input.disabled;
        });
        core.updatePricesInCard(target, core.getCurrency());
        publish(target);
      });
    }
    function moveSizeBlock(card, measurements, before) {
      if (Object.keys(measurements).length !== 4) return;
      let block = card.querySelector('.yo-size-block');
      if (block) return;
      block = element('section', 'yo-size-block');
      block.setAttribute('aria-label', 'Measurements');
      const header = element('div', 'yo-size-header');
      header.appendChild(element('strong', 'yo-size-heading', 'SIZE (CM)'));
      let toggle = card.querySelector(cfg.selectors.unitToggle);
      if (!toggle && cfg.enableUnits) {
        toggle = element('div', 'yo-unit-toggle');
        ['cm', 'in'].forEach(unit => {
          const button = element('button', '', unit);
          button.type = 'button'; button.dataset.unit = unit;
          toggle.appendChild(button);
        });
      }
      if (toggle) header.appendChild(toggle);
      block.appendChild(header);
      const grid = element('div', 'yo-size-grid');
      Object.keys(names).forEach(key => {
        const node = measurements[key].node;
        const parent = node.parentElement;
        const cell = element('div', 'yo-size-cell');
        cell.appendChild(element('span', 'yo-size-label', names[key].toUpperCase()));
        node.dataset.measurement = key;
        cell.appendChild(node);
        grid.appendChild(cell);
        // Hide only the old standalone measurement row, never the card wrapper.
        if (parent && parent.matches('li') && !parent.querySelector('a,button,input,img')) parent.hidden = true;
      });
      block.appendChild(grid);
      before.before(block);
      core.safeQueryAll(card, '.yo-unit-label').forEach(node => { node.hidden = true; });
      core.safeQueryAll(card, '.el-content ul').forEach(list => {
        if (Array.from(list.children).every(row => row.hidden)) {
          list.hidden = true;
          if (list.parentElement.matches('.el-content') && list.parentElement.children.length === 1) list.parentElement.hidden = true;
        }
      });
      const unit = card.dataset.yoUnit || cfg.defaultUnit || 'cm';
      if (toggle) core.setActiveButtons(toggle, unit);
      core.updateMeasuresInCard(card, unit);
    }
    function addServices(card, record, before) {
      if (card.querySelector('.yo-personalization')) return;
      const block = element('section', 'yo-personalization');
      const heading = element('div', 'yo-personalization-heading');
      heading.appendChild(element('strong', '', 'Personalize your leotard'));
      heading.appendChild(element('span', '', 'Optional services'));
      block.appendChild(heading);
      Object.keys(labels).forEach(key => {
        if (!services[key] || !services[key].enabled) return;
        const row = element('div', 'yo-addon-row');
        const label = element('label', 'yo-addon-label');
        const input = element('input');
        input.type = 'checkbox'; input.dataset.yoService = key;
        input.checked = !!record.state.selected[key];
        input.disabled = key === 'size_adaptation' && Object.keys(record.measurements).length !== 4;
        label.appendChild(input);
        label.appendChild(element('span', '', labels[key]));
        if (input.disabled) label.title = 'Size adaptation is unavailable: measurements are incomplete.';
        row.appendChild(label);
        if (tips[key]) {
          const info = element('button', 'yo-addon-info', 'i');
          info.type = 'button'; info.setAttribute('aria-label', tips[key]); info.title = tips[key];
          const tip = element('span', 'yo-addon-tooltip', tips[key]);
          const wrapper = element('span', 'yo-addon-info-wrap');
          wrapper.append(info, tip); row.appendChild(wrapper);
        }
        const price = element('span', 'yo-addon-price');
        price.dataset.yoAddonPrice = String(servicePrice(key)); row.appendChild(price);
        if (key === 'size_adaptation' && !input.disabled) {
        const edit = element('button', 'yo-adaptation-edit', 'Edit');
          edit.type = 'button'; edit.dataset.yoEditAdaptation = '1';
          edit.title = 'Edit measurement reductions'; row.appendChild(edit);
        }
        block.appendChild(row);
      });
      before.before(block);
    }
    function initializeCard(card) {
      const buy = card.querySelector('.sale-new-btn') || card.querySelector(cfg.selectors.button);
      if (!buy) return;
      const price = buy.querySelector(cfg.selectors.price);
      const title = card.querySelector(cfg.selectors.title);
      if (!price || (!measureNodes(card).length && !(title && /for height/i.test(title.textContent)))) return;
      if (cards.has(card) && card.querySelector('.yo-personalization')) {
        const record = cards.get(card);
        synchronizeIdentity(card, record);
        const current = readMeasurements(card);
        record.measurements = current;
        const complete = Object.keys(current).length === 4;
        const input = card.querySelector('[data-yo-service="size_adaptation"]');
        if (input && input.disabled === complete) {
          record.state.selected.size_adaptation = false;
          card.querySelector('.yo-personalization').remove();
          addServices(card, record, card.querySelector('.yo-purchase-row'));
          refresh(card);
        }
        if (record.price !== price) { record.price = price; record.buy = buy; refresh(card); }
        return;
      }
      const measurements = readMeasurements(card);
      const oldPrice = card.querySelector('.sale-old-btn .yo-price[data-eur]');
      const base = Number((oldPrice || price).dataset.eur);
      const discounted = Number(price.dataset.eur);
      if (!Number.isFinite(base) || !Number.isFinite(discounted) || discounted < 0) return;
      const id = identity(card, base, measurements);
      const record = { base, discount: base - discounted, state: makeState(id), price, measurements, buy };
      cards.set(card, record);
      card.classList.add('yo-personalized-card');
      card.dataset.yoCardKey = id.key;
      let actions = card.querySelector('.yo-purchase-row');
      if (!actions) {
        actions = element('div', 'yo-purchase-row');
        const wrapper = buy.closest('.' + (cfg.sale.wrapperClass || 'sale-wrapper'));
        (wrapper || buy).before(actions);
        if (oldPrice) {
          const oldButton = oldPrice.closest('.sale-old-btn');
          oldButton.removeAttribute('href'); oldButton.removeAttribute('role');
          oldButton.replaceChildren(oldPrice); actions.appendChild(oldButton);
        } else actions.appendChild(element('span', 'yo-old-price-spacer'));
        actions.appendChild(buy);
        if (wrapper) wrapper.remove();
        let currency = card.querySelector('select[data-currency]');
        if (currency) {
          currency.setAttribute('aria-label', 'Currency'); actions.appendChild(currency);
        }
      }
      if (!oldPrice) {
        const label = element('span', 'yo-buy-label', cfg.sale.newButtonText || 'Buy now');
        const icon = element('span'); icon.setAttribute('uk-icon', 'icon: cart'); icon.setAttribute('aria-hidden', 'true');
        // Keep price node attributes (including weight) and the original anchor.
        buy.replaceChildren(icon, label, document.createTextNode(' '), price);
      }
      const badge = buy.querySelector('.sale-badge');
      if (badge) { badge.classList.add('yo-card-sale-badge'); card.appendChild(badge); }
      core.safeQueryAll(card, '.yo-meta-switches').forEach(node => {
        node.hidden = true;
        const meta = node.closest('.el-meta');
        if (meta && Array.from(meta.children).every(child => child === node || child.tagName === 'HR')) meta.hidden = true;
      });
      moveSizeBlock(card, measurements, actions);
      addServices(card, record, actions);
      refresh(card);
    }
    function initialize() {
      observer && observer.disconnect();
      core.initSaleButtons();
      core.applyFeedIds();
      core.safeQueryAll(document, cfg.selectors.feedCard || '.el-item').forEach(initializeCard);
      core.initUnits();
      core.initCurrency();
      observer && observe();
    }
    const dialog = element('dialog', 'yo-adaptation-dialog');
    dialog.setAttribute('aria-labelledby', 'yo-adaptation-title');
    document.body.appendChild(dialog);
    function closeModal(applied) {
      if (!modalContext) return;
      const context = modalContext;
      if (applied) {
        context.record.state.adjustments = Object.assign({}, context.draft);
        context.record.state.selected.size_adaptation = true;
      }
      dialog.close(); modalContext = null;
      refresh(context.card);
      if (context.opener.isConnected) context.opener.focus();
    }
    function openModal(card, opener) {
      const record = cards.get(card);
      if (!record || Object.keys(record.measurements).length !== 4) return;
      modalContext = { card, record, opener, draft: Object.assign({}, record.state.adjustments) };
      dialog.replaceChildren();
      const close = element('button', 'yo-dialog-close', '×');
      close.type = 'button'; close.setAttribute('aria-label', 'Close');
      close.addEventListener('click', () => closeModal(false));
      const title = element('h2', '', 'Adapt to my measurements'); title.id = 'yo-adaptation-title';
      dialog.append(close, title, element('p', '', 'We can adjust this ready-to-wear leotard to a smaller size.'),
        element('p', 'yo-adaptation-notice', 'The size can only be reduced by up to 4 cm. We cannot enlarge ready-to-wear leotards.'));
      const table = element('div', 'yo-adaptation-table');
      const head = element('div', 'yo-adaptation-row');
      head.append(element('strong', '', 'Measurement'), element('strong', '', 'Original'), element('strong', '', 'Reduce by'));
      table.appendChild(head);
      Object.keys(names).forEach(key => {
        const row = element('div', 'yo-adaptation-row');
        const label = element('label', '', names[key]);
        const select = element('select'); select.id = 'yo-reduce-' + key; select.dataset.yoReduce = key;
        label.htmlFor = select.id;
        for (let amount = 0; amount <= 4; amount++) {
          const option = element('option', '', amount ? '−' + amount + ' cm' : '0 cm');
          option.value = String(-amount); select.appendChild(option);
        }
        select.value = String(modalContext.draft[key]);
        select.addEventListener('change', () => {
          const amount = Number(select.value);
          modalContext.draft[key] = Number.isInteger(amount) && amount >= -4 && amount <= 0 ? amount : 0;
          select.value = String(modalContext.draft[key]); updatePreview();
        });
        row.append(label, element('span', '', core.formatRange(record.measurements[key].values, 'cm') + ' cm'), select);
        table.appendChild(row);
      });
      const preview = element('section', 'yo-adjusted-preview');
      preview.appendChild(element('strong', '', 'Adjusted measurements'));
      const grid = element('div', 'yo-size-grid');
      Object.keys(names).forEach(key => {
        const cell = element('div', 'yo-size-cell');
        cell.appendChild(element('span', 'yo-size-label', names[key]));
        const value = element('strong'); value.dataset.yoAdjusted = key; cell.appendChild(value); grid.appendChild(cell);
      });
      preview.appendChild(grid);
      const apply = element('button', 'yo-dialog-apply', 'Apply changes'); apply.type = 'button';
      apply.addEventListener('click', () => closeModal(true));
      const cancel = element('button', 'yo-dialog-cancel', 'Cancel'); cancel.type = 'button';
      cancel.addEventListener('click', () => closeModal(false));
      dialog.append(table, preview, element('p', 'yo-estimate-note', 'These values are estimated and may vary slightly depending on the design of the model.'), apply, cancel);
      updatePreview(); dialog.showModal();
    }
    function updatePreview() {
      if (!modalContext) return;
      Object.keys(names).forEach(key => {
        const values = modalContext.record.measurements[key].values.map(value => value + modalContext.draft[key]);
        dialog.querySelector('[data-yo-adjusted="' + key + '"]').textContent = core.formatRange(values, 'cm');
      });
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeModal(false); });
    dialog.addEventListener('click', event => { if (event.target === dialog) {
      const box = dialog.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeModal(false);
    } });
    document.addEventListener('change', event => {
      const input = event.target.closest('[data-yo-service]');
      if (!input) return;
      const card = core.findCardRoot(input), record = cards.get(card);
      if (!record || input.disabled) return;
      const key = input.dataset.yoService;
      if (key === 'size_adaptation' && input.checked) { openModal(card, input); return; }
      record.state.selected[key] = input.checked; refresh(card);
    });
    document.addEventListener('click', event => {
      const edit = event.target.closest('[data-yo-edit-adaptation]');
      if (edit) { event.preventDefault(); openModal(core.findCardRoot(edit), edit); }
    });
    // Capture precedes checkout's delegated Buy handler; it does not intercept buying.
    document.addEventListener('click', event => {
      const buy = event.target.closest('.yo-purchase-row a, .yo-purchase-row button');
      if (buy && !buy.classList.contains('sale-old-btn')) publish(core.findCardRoot(buy), 'yo:pce:buy');
    }, true);
    function synchronizeIdentity(card, record) {
      const next = identity(card, record.base, record.measurements);
      if (next.key === record.state.identity.key) return;
      const previous = record.state.identity.key;
      if (states.has(next.key)) record.state = states.get(next.key);
      else record.state.identity = next;
      states.delete(previous); states.set(next.key, record.state);
      card.dataset.yoCardKey = next.key; refresh(card);
    }
    document.addEventListener('yo:pce:identity', event => {
      const card = event.detail.card, record = cards.get(card);
      if (record) synchronizeIdentity(card, record);
    });
    window.YOProductCardPersonalization = Object.freeze({
      version: 1, initialize,
      getState: target => {
        if (typeof target === 'string') target = core.safeQueryAll(document, '.yo-personalized-card')
          .find(card => card.dataset.yoCardKey === target || card.dataset.feedId === target || card.dataset.productId === target || card.id === target);
        return target ? snapshot(target) : null;
      }
    });
    let pending = false;
    observer = new MutationObserver(mutations => {
      const structural = mutations.some(m => m.type === 'attributes' ||
        (m.type === 'childList' && Array.from(m.addedNodes).some(node => node.nodeType === 1 && !dialog.contains(node))));
      if (!structural || pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; initialize(); });
    });
    function observe() { observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-feed-id', 'data-product-id', 'data-cm'] }); }
    initialize();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
