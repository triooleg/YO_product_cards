(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const cfg = window.YOProductCardEnhancerSettings || {};
    if (!cfg.enabled) return;

    const CM_PER_INCH = Number(cfg.cmPerInch || 2.54);
    const NBU_URL = cfg.nbuUrl || 'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json';
    const FX_CACHE_KEY = cfg.fxCacheKey || 'yo_fx_nbu_cache_v2';
    const YO_FEED_URL = cfg.feedUrl || 'https://www.yoleotard.com/?yoleotard_google_feed=1';
    const selectors = cfg.selectors || {};
    const saleCfg = cfg.sale || {};
    const feedCfg = cfg.feed || {};
    const currencies = cfg.currencies || {};
    const defaultUnit = cfg.defaultUnit || 'cm';
    const defaultCurrency = cfg.defaultCurrency || 'EUR';

    function safeQueryAll(root, selector) {
      try {
        return Array.prototype.slice.call((root || document).querySelectorAll(selector));
      } catch (e) {
        return [];
      }
    }

    function safeClosest(el, selector) {
      try {
        return el && el.closest(selector);
      } catch (e) {
        return null;
      }
    }

    function roundSmart(n) {
      const v = Math.round(n * 10) / 10;
      return (v % 1 === 0) ? String(v.toFixed(0)) : String(v.toFixed(1));
    }

    function roundMoney(n, decimals) {
      decimals = typeof decimals === 'number' ? decimals : 2;
      return (Math.round(n * Math.pow(10, decimals)) / Math.pow(10, decimals)).toFixed(decimals);
    }

    function parseRange(str) {
      const s = String(str).trim().replace(/\s+/g, ' ').replace(/—/g, '–');
      const parts = s.split(/–|-/).map(x => x.trim()).filter(Boolean);

      if (parts.length === 1) {
        const n = Number(parts[0].replace(',', '.'));
        return isFinite(n) ? [n] : null;
      }

      if (parts.length === 2) {
        const a = Number(parts[0].replace(',', '.'));
        const b = Number(parts[1].replace(',', '.'));
        return (isFinite(a) && isFinite(b)) ? [a, b] : null;
      }

      return null;
    }

    function formatRange(values, unit) {
      if (!values) return '';
      if (values.length === 1) return roundSmart(values[0]) + (unit === 'in' ? ' in' : '');
      return roundSmart(values[0]) + '–' + roundSmart(values[1]) + (unit === 'in' ? ' in' : '');
    }

    function cmToIn(cm) {
      return cm / CM_PER_INCH;
    }

    function findCardRoot(fromEl) {
      return safeClosest(fromEl, selectors.card || '.uk-card, article, .el-item, li, .uk-panel, .tm-item, .yoo-item')
        || safeClosest(fromEl, 'div')
        || document;
    }

    function nowDateKey() {
      const d = new Date();
      return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0');
    }

    async function getFxRatesUAH() {
      try {
        const cached = JSON.parse(localStorage.getItem(FX_CACHE_KEY) || 'null');
        if (cached && cached.dateKey === nowDateKey() && cached.rates) return cached.rates;
      } catch (e) {}

      const res = await fetch(NBU_URL, { cache: 'no-store' });
      if (!res.ok) throw new Error('FX fetch failed: ' + res.status);

      const data = await res.json();
      const map = {};

      for (const row of data) {
        if (row && row.cc && typeof row.rate === 'number') map[row.cc] = row.rate;
      }

      const rates = {};
      Object.keys(currencies).forEach(function (code) {
        if (code === 'EUR') return;
        rates[code] = map[code];
      });
      rates.EUR = map.EUR;

      localStorage.setItem(FX_CACHE_KEY, JSON.stringify({
        dateKey: nowDateKey(),
        rates: rates
      }));

      return rates;
    }

    function formatCurrency(amount, ccy) {
      const meta = currencies[ccy] || { symbol: ccy, position: 'after' };
      const value = roundMoney(amount, 0);
      if (ccy === 'EUR') return value + ' €';
      if (meta.position === 'before') return String(meta.symbol || '') + value;
      return value + String(meta.symbol ? ' ' + meta.symbol.trim() : ' ' + ccy);
    }

    function convertEur(eur, rates, targetCcy) {
      if (targetCcy === 'EUR') return eur;
      if (!rates || !rates.EUR || !rates[targetCcy]) return eur;
      return eur * (rates.EUR / rates[targetCcy]);
    }

    async function updatePricesInCard(cardRoot, targetCcy) {
      let rates = null;

      if (targetCcy !== 'EUR') {
        try {
          rates = await getFxRatesUAH();
        } catch (e) {}
      }

      safeQueryAll(cardRoot, selectors.price || '.yo-price[data-eur]').forEach(el => {
        const eur = Number(el.getAttribute('data-eur'));
        if (!isFinite(eur)) return;
        el.textContent = formatCurrency(convertEur(eur, rates, targetCcy), targetCcy);
      });

      safeQueryAll(cardRoot, '.sale-badge[data-eur]').forEach(el => {
        const eur = Number(el.getAttribute('data-eur'));
        if (!isFinite(eur)) return;
        el.textContent = '−' + formatCurrency(convertEur(eur, rates, targetCcy), targetCcy);
      });
    }

    function setActiveButtons(toggleEl, unit) {
      safeQueryAll(toggleEl, '[data-unit]').forEach(btn => {
        btn.classList.toggle('uk-active', btn.getAttribute('data-unit') === unit);
      });
    }

    function updateMeasuresInCard(cardRoot, unit) {
      safeQueryAll(cardRoot, selectors.measure || '.yo-measure[data-cm]').forEach(el => {
        const cmRaw = el.getAttribute('data-cm');
        const cmVals = parseRange(cmRaw);
        if (!cmVals) return;

        el.textContent = unit === 'cm'
          ? String(cmRaw).trim()
          : formatRange(cmVals.map(cmToIn), 'in');
      });
    }

    function yoNormalizeText(str) {
      return String(str || '')
        .toLowerCase()
        .replace(/[“”«»"'`]/g, '')
        .replace(/&quot;/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function yoSlugify(str) {
      return yoNormalizeText(str)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_');
    }

    function yoCleanSlug(slug) {
      let result = String(slug || '');
      const rawRegex = feedCfg.stripSuffixRegex || '_for_height.*$|_\\d+_\\d+$';
      try {
        rawRegex.split('|').forEach(function (pattern) {
          result = result.replace(new RegExp(pattern, 'i'), '');
        });
      } catch (e) {
        result = result.replace(/_for_height.*$/i, '').replace(/_\d+_\d+$/i, '');
      }
      return result.replace(/^_+|_+$/g, '').replace(/_+/g, '_');
    }

    function yoExtractSlug(link) {
      try {
        const url = new URL(link, window.location.origin);
        const parts = url.pathname.split('/').filter(Boolean);
        const idx = parts.indexOf(feedCfg.pathMarker || 'yoleotard-product');

        if (idx !== -1 && parts[idx + 1]) {
          return yoCleanSlug(parts[idx + 1]);
        }
      } catch(e) {}

      return '';
    }

    async function yoLoadFeedAndApplyIds() {
      if (!cfg.enableFeedIds) return;
      try {
        const res = await fetch(YO_FEED_URL, { cache: 'no-store' });
        if (!res.ok) return;

        const xmlText = await res.text();
        const xml = new DOMParser().parseFromString(xmlText, 'text/xml');

        const feedItems = [];

        safeQueryAll(xml, 'item').forEach(function(item) {
          const titleEl = item.querySelector('g\\:title') || item.querySelector('title');
          const linkEl = item.querySelector('g\\:link') || item.querySelector('link');

          if (!titleEl || !linkEl) return;

          const title = titleEl.textContent.trim();
          const link = linkEl.textContent.trim();

          const feedSlug = yoExtractSlug(link);
          if (!feedSlug) return;

          feedItems.push({
            slug: feedSlug,
            titleSlug: yoCleanSlug(yoSlugify(title))
          });
        });

        if (!feedItems.length) return;

        safeQueryAll(document, selectors.feedCard || '.el-item').forEach(function(card) {
          if (card.dataset.feedId) return;

          const titleEl = card.querySelector(selectors.title || '.el-title');
          if (!titleEl) return;

          const cardSlug = yoCleanSlug(yoSlugify(titleEl.textContent));

          let matched = null;

          for (const item of feedItems) {
            if (
              cardSlug.includes(item.slug) ||
              item.slug.includes(cardSlug) ||
              cardSlug.includes(item.titleSlug) ||
              item.titleSlug.includes(cardSlug)
            ) {
              matched = item;
              break;
            }
          }

          if (!matched) return;

          card.id = matched.slug;
          card.dataset.feedId = matched.slug;
        });

      } catch(e) {}
    }

    function addCurrencyOptions() {
      const options = cfg.extraCurrencyOptions || [];
      if (!options.length) return;

      safeQueryAll(document, 'select[data-currency]').forEach(function (sel) {
        var existing = Array.from(sel.options).map(function (o) { return o.value; });

        options.forEach(function (item) {
          if (existing.indexOf(item.value) === -1) {
            var opt = document.createElement('option');
            opt.value = item.value;
            opt.textContent = item.label;
            sel.appendChild(opt);
          }
        });
      });
    }

    function initUnits() {
      if (!cfg.enableUnits) return;
      safeQueryAll(document, selectors.unitToggle || '.yo-unit-toggle').forEach(t => {
        setActiveButtons(t, defaultUnit);
        updateMeasuresInCard(findCardRoot(t), defaultUnit);
      });
    }

    function initCurrency() {
      if (!cfg.enableCurrency) return;
      addCurrencyOptions();
      safeQueryAll(document, selectors.currency || '[data-currency]').forEach(sel => {
        if ('value' in sel) sel.value = defaultCurrency;
        updatePricesInCard(findCardRoot(sel), defaultCurrency);
      });
    }

    function setupEvents() {
      document.addEventListener('click', function (e) {
        if (!cfg.enableUnits) return;
        const btn = safeClosest(e.target, (selectors.unitToggle || '.yo-unit-toggle') + ' [data-unit]');
        if (!btn) return;

        e.preventDefault();

        const toggleEl = safeClosest(btn, selectors.unitToggle || '.yo-unit-toggle');
        const unit = btn.getAttribute('data-unit');

        if (unit !== 'cm' && unit !== 'in') return;

        const card = findCardRoot(toggleEl);

        setActiveButtons(toggleEl, unit);
        updateMeasuresInCard(card, unit);
      });

      document.addEventListener('change', function (e) {
        if (!cfg.enableCurrency) return;
        const sel = safeClosest(e.target, selectors.currency || '[data-currency]');
        if (!sel) return;

        updatePricesInCard(findCardRoot(sel), sel.value);
      });
    }

    function getSaleDiscountFromClass(el) {
      let discount = 0;
      const prefix = saleCfg.classPrefix || 'sale';
      const rx = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$');
      String(el.className || '').split(/\s+/).forEach(function (c) {
        var m = c.match(rx);
        if (m) discount = parseInt(m[1], 10);
      });
      return discount;
    }

    function initSaleButtons() {
      if (!cfg.enableSale) return;

      safeQueryAll(document, '[class]').forEach(function (el) {
        var discount = getSaleDiscountFromClass(el);
        if (!discount) return;

        var card = safeClosest(el, selectors.feedCard || '.el-item');
        if (!card) return;

        var readyKey = saleCfg.readyData || 'saleReady';
        if (card.dataset[readyKey]) return;
        card.dataset[readyKey] = '1';

        var btn = card.querySelector(selectors.button || 'a.el-link.uk-button');
        if (!btn) return;

        var priceSpan = btn.querySelector(selectors.price || '.yo-price[data-eur]');
        if (!priceSpan) return;

        var oldPrice = parseFloat(priceSpan.dataset.eur);
        if (isNaN(oldPrice)) return;

        var newPrice = oldPrice - discount;

        btn.classList.add('sale-old-btn');
        btn.innerHTML = (saleCfg.oldButtonText || 'Buy') + ' • <span class="yo-price" data-eur="' + oldPrice + '">' + oldPrice + ' €</span>';
        btn.href = '#';
        btn.removeAttribute('data-type');
        btn.removeAttribute('data-caption');
        btn.removeAttribute('uk-lightbox');
        btn.removeAttribute('aria-label');

        var newBtn = document.createElement('a');
        newBtn.href = '#';

        Array.prototype.forEach.call(btn.attributes, function (attr) {
          if (
            attr.name === 'href' ||
            attr.name === 'data-type' ||
            attr.name === 'data-caption' ||
            attr.name === 'aria-label' ||
            attr.name === 'uk-lightbox'
          ) return;

          if (attr.name.startsWith('data-')) return;

          newBtn.setAttribute(attr.name, attr.value);
        });

        newBtn.className = btn.className
          .replace('sale-old-btn', '')
          .replace('uk-button-primary', saleCfg.newButtonClass || 'uk-button-danger')
          .replace('uk-button-secondary', saleCfg.newButtonClass || 'uk-button-danger')
          .trim();

        newBtn.classList.add('sale-new-btn');

        newBtn.innerHTML =
          '<span class="yo-cart-icon">' +
          '<svg width="16" height="16" viewBox="0 0 20 20" aria-hidden="true">' +
          '<circle cx="7.3" cy="17.3" r="1.4"></circle>' +
          '<circle cx="13.3" cy="17.3" r="1.4"></circle>' +
          '<polyline fill="none" stroke="currentColor" stroke-width="1.1" points="0 2 3.2 4 5.3 12.5 16 12.5 18 6.5 8 6.5"></polyline>' +
          '</svg>' +
          '</span>' +
          ' ' + (saleCfg.newButtonText || 'Buy now') + ' • <span class="yo-price" data-eur="' + newPrice + '">' + newPrice + ' €</span>' +
          ' <span class="sale-badge" data-eur="' + discount + '">−' + discount + ' €</span>';

        var icon = btn.querySelector('[uk-icon]');
        if (icon) {
          newBtn.appendChild(document.createTextNode(' '));
          newBtn.appendChild(icon.cloneNode(true));
        }

        var wrapper = document.createElement('div');
        wrapper.className = saleCfg.wrapperClass || 'sale-wrapper';

        btn.parentNode.insertBefore(wrapper, btn);
        wrapper.appendChild(btn);
        wrapper.appendChild(newBtn);
      });
    }

    initUnits();
    initCurrency();
    setupEvents();
    initSaleButtons();
    yoLoadFeedAndApplyIds();
  });
})();
