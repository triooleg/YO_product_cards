const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const plugin = path.join(__dirname, '..', 'yoleotard-product-card-enhancer');
function card(id, sale = '', measures = true) {
  return `<div class="el-item uk-panel ${sale}" ${id ? `data-product-id="${id}"` : ''}>
    <h3 class="el-title">New author's leotard ${id || 'No feed'} for height 145-150</h3>
    <div class="yo-meta-switches"><div><span class="yo-unit-label">Units:</span><div class="yo-unit-toggle"><button data-unit="cm">cm</button><button data-unit="in">in</button></div></div>
    <div><select data-currency><option value="EUR">€ EUR</option><option value="USD">$ USD</option></select></div></div>
    <img src="https://www.yoleotard.com/wp-content/themes/yootheme/cache/16/photo_2026-10-06_21-05-39-16498328.jpeg" alt="Leotard front and back">
    <div class="el-content"><ul><li>Chest: <span class="yo-measure" data-cm="70–72">70–72</span></li>
    <li>Waist: <span class="yo-measure" data-cm="60–64">60–64</span></li>
    <li>Hips: <span class="yo-measure" data-cm="74–78">74–78</span></li>
    ${measures ? '<li>Torso: <span class="yo-measure" data-cm="128–132">128–132</span></li>' : ''}</ul></div>
    <div><a href="/product/${id || 'no-feed'}" data-weight="0.5" class="el-link uk-button uk-button-primary"><span class="yo-price" data-eur="370" data-weight="0.5">370 €</span></a></div>
    <button class="help">Need help buying?</button></div>`;
}
async function setup(page, options = {}) {
  await page.route('https://test.local/fixture', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body></body></html>' }));
  await page.goto('https://test.local/fixture');
  await page.route('https://test.local/icons/*.svg', route => route.fulfill({ contentType: 'image/svg+xml',
    body: fs.readFileSync(path.join(plugin, 'assets/icons', path.basename(new URL(route.request().url()).pathname)), 'utf8') }));
  await page.route('**/rates', route => route.fulfill({ json: [{ cc: 'EUR', rate: 40 }, { cc: 'USD', rate: 32 }] }));
  await page.route('**/feed', route => route.fulfill({ contentType: 'text/xml', body: `<?xml version="1.0"?><rss xmlns:g="http://base.google.com/ns/1.0"><channel><item><g:title>No feed for height 145-150</g:title><g:link>https://test.local/yoleotard-product/no_feed_for_height_145_150/</g:link></item></channel></rss>` }));
  await page.setContent(`<style>*{box-sizing:border-box}body{margin:0;padding:16px;font-family:Arial;color:#16164b;background:#f4f8ff}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px;max-width:1400px;margin:auto}.el-item{padding:16px;background:#fff}.el-title{font-size:19px;line-height:1.3;min-height:75px}img{width:100%;aspect-ratio:1;object-fit:contain}.uk-button-primary{background:#0077ed;color:white}.uk-button-danger{background:#ff2359;color:white}.help{width:100%;padding:12px;background:#e4f7f2;border:1px solid #50b7ae;color:#087b75}@media(max-width:950px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.grid{grid-template-columns:1fr}}</style><main class="grid">${card('normal')}${card('sale', 'sale50')}${card('', '', options.valid !== false)}</main>`);
  await page.evaluate(options => {
    window.YOProductCardEnhancerSettings = {
      enabled: true, enableUnits: true, enableCurrency: true, enableSale: true,
      enableFeedIds: !!options.feed, feedUrl: 'https://test.local/feed', cmPerInch: 2.54, defaultCurrency: 'EUR', defaultUnit: 'cm',
      nbuUrl: 'https://test.local/rates', fxCacheKey: 'test-fx',
      currencies: { EUR: { symbol: '€', position: 'after' }, USD: { symbol: '$', position: 'before' } },
      extraCurrencyOptions: [],
      selectors: { card: '.uk-panel, .el-item', feedCard: '.el-item', title: '.el-title', button: 'a.el-link.uk-button', price: '.yo-price[data-eur]', measure: '.yo-measure[data-cm]', currency: 'select[data-currency]', unitToggle: '.yo-unit-toggle' },
      sale: { classPrefix: 'sale', wrapperClass: 'sale-wrapper', readyData: 'saleready', newButtonText: 'Buy now', newButtonClass: 'uk-button-danger' }, feed: {},
      personalization: { enabled: options.enabled !== false, services: {
        size_adaptation: { enabled: true, priceEur: 25 }, matching_headpiece: { enabled: true, priceEur: 15 }, extra_rhinestones: { enabled: true, priceEur: 10 }
      } }
    };
  }, options);
  await page.addStyleTag({ path: path.join(plugin, 'assets/css/frontend.css') });
  await page.addScriptTag({ path: path.join(plugin, 'assets/js/frontend.js') });
  await page.addScriptTag({ path: path.join(plugin, 'assets/js/personalization.js') });
  if (options.manager) {
    await page.evaluate(() => {
      document.querySelectorAll('.help').forEach(node => node.remove());
      document.querySelectorAll('.yo-purchase-row > a:not(.sale-old-btn)').forEach(node => node.classList.add('yo-main-buy-btn'));
      window.YOManagerPurchase = { enabled: true, whatsappNumber: '000' };
    });
    await page.addStyleTag({ path: path.join(__dirname, 'fixtures/yo-manager-purchase.css') });
    await page.addScriptTag({ path: path.join(__dirname, 'fixtures/yo-manager-purchase.js') });
  }
}
function state(page, id) {
  return page.evaluate(id => window.YOProductCardPersonalization.getState(id), id);
}
test('normal, sale, each addon, all addons and removing an addon', async ({ page }) => {
  await setup(page);
  for (const [id, base] of [['normal', 370], ['sale', 320]]) {
    const c = page.locator(`[data-product-id="${id}"]`);
    expect((await state(page, id)).display_total_eur).toBe(base);
    expect(await c.locator('.yo-purchase-row a:not(.sale-old-btn)').getAttribute('href')).toBe('/product/' + id);
    await c.locator('[data-yo-service="matching_headpiece"]').check();
    expect((await state(page, id)).display_total_eur).toBe(base + 15);
    await c.locator('[data-yo-service="matching_headpiece"]').uncheck();
    await c.locator('[data-yo-service="extra_rhinestones"]').check();
    expect((await state(page, id)).display_total_eur).toBe(base + 10);
    await c.locator('[data-yo-service="extra_rhinestones"]').uncheck();
    await c.locator('[data-yo-service="size_adaptation"]').check();
    await page.getByRole('button', { name: 'Apply changes' }).click();
    expect((await state(page, id)).display_total_eur).toBe(base + 25);
    await c.locator('[data-yo-service="matching_headpiece"]').check();
    await c.locator('[data-yo-service="extra_rhinestones"]').check();
    expect((await state(page, id)).display_total_eur).toBe(base + 50);
    await expect(c.locator('.yo-purchase-row a:not(.sale-old-btn) .yo-price')).toHaveText(`${base + 50} €`);
    await c.locator('[data-yo-service="size_adaptation"]').uncheck();
    expect((await state(page, id)).display_total_eur).toBe(base + 25);
  }
  await expect(page.locator('[data-product-id="sale"] .yo-card-sale-badge')).toHaveText('−50 €');
  await expect(page.locator('.yo-purchase-row .sale-badge')).toHaveCount(0);
  await expect(page.locator('[data-product-id="sale"] .sale-old-btn')).toHaveText('370 €');
  expect((await state(page, 'normal')).addons.size_adaptation.enabled).toBe(false);
});
test('reductions 1..4, validation, cancel, reopen and preserve adjustments', async ({ page }) => {
  await setup(page);
  const c = page.locator('[data-product-id="normal"]');
  await c.locator('[data-yo-service="size_adaptation"]').check();
  for (let n = 1; n <= 4; n++) {
    await page.locator('#yo-reduce-chest').selectOption(String(-n));
    await expect(page.locator('[data-yo-adjusted="chest"]')).toHaveText(`${70-n}–${72-n}`);
  }
  await page.locator('#yo-reduce-waist').selectOption('-3');
  await page.locator('#yo-reduce-hips').selectOption('-2');
  await expect(page.locator('#yo-reduce-torso')).toBeDisabled();
  await page.evaluate(() => {
    const select = document.querySelector('#yo-reduce-torso');
    select.add(new Option('Invalid', '-1')); select.value = '-1'; select.dispatchEvent(new Event('change'));
  });
  await expect(page.locator('[data-yo-adjusted="torso"]')).toHaveText('128–132');
  await page.evaluate(() => {
    const select = document.querySelector('#yo-reduce-chest');
    select.add(new Option('Invalid', '1')); select.value = '1'; select.dispatchEvent(new Event('change'));
  });
  await expect(page.locator('[data-yo-adjusted="chest"]')).toHaveText('70–72');
  await page.locator('#yo-reduce-chest').selectOption('-2');
  await page.getByRole('button', { name: 'Apply changes' }).click();
  expect((await state(page, 'normal')).addons.size_adaptation.adjustments).toEqual({ chest: -2, waist: -3, hips: -2, torso: 0 });
  await c.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('#yo-reduce-chest')).toHaveValue('-2');
  await page.locator('#yo-reduce-chest').selectOption('-4');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect((await state(page, 'normal')).addons.size_adaptation.adjustments.chest).toBe(-2);
  await c.locator('[data-yo-service="size_adaptation"]').uncheck();
  await c.locator('[data-yo-service="size_adaptation"]').check();
  await expect(page.locator('#yo-reduce-chest')).toHaveValue('-2');
  await page.keyboard.press('Escape');
  await expect(c.locator('[data-yo-service="size_adaptation"]')).not.toBeChecked();
  expect((await state(page, 'sale')).addons.size_adaptation.adjustments.chest).toBe(0);
});
test('sale plus addons and independent card currency EUR to USD and back, cm/in', async ({ page }) => {
  await setup(page);
  const c = page.locator('[data-product-id="sale"]');
  await c.locator('[data-yo-service="matching_headpiece"]').check();
  await c.locator('[data-yo-service="extra_rhinestones"]').check();
  await c.locator('select[data-currency]').selectOption('USD');
  await expect(c.locator('.sale-new-btn .yo-price')).toHaveText('$431');
  await expect(c.locator('.sale-new-btn .yo-price')).toHaveAttribute('data-eur', '320');
  await expect(c.locator('[data-yo-addon-price="15"]')).toHaveText('+ $19');
  await expect(page.locator('[data-product-id="normal"] select[data-currency]')).toHaveValue('EUR');
  await expect(page.locator('[data-product-id="normal"] .yo-purchase-row .yo-price')).toHaveText('370 €');
  expect((await state(page, 'normal')).currency).toBe('EUR');
  expect((await state(page, 'sale')).currency).toBe('USD');
  await page.evaluate(() => window.YOProductCardPersonalization.initialize());
  await expect(c.locator('select[data-currency]')).toHaveValue('USD');
  await c.locator('[data-yo-service="extra_rhinestones"]').uncheck();
  await expect(c.locator('.sale-new-btn .yo-price')).toHaveText('$419');
  await expect(page.locator('[data-product-id="normal"] .yo-purchase-row .yo-price')).toHaveText('370 €');
  await c.locator('[data-yo-service="extra_rhinestones"]').check();
  await page.locator('[data-product-id="normal"] select[data-currency]').selectOption('USD');
  await c.locator('select[data-currency]').selectOption('EUR');
  await expect(c.locator('.sale-new-btn .yo-price')).toHaveText('345 €');
  await expect(page.locator('[data-product-id="normal"] select[data-currency]')).toHaveValue('USD');
  await expect(page.locator('[data-product-id="normal"] .yo-purchase-row .yo-price')).toHaveText('$463');
  await c.locator('[data-unit="in"]').click();
  await expect(c.locator('.yo-size-heading')).toHaveText('SIZE (IN)');
  await expect(c.locator('[data-measurement="chest"]')).toHaveText('27.6–28.3');
  await c.locator('[data-unit="cm"]').click();
  await expect(c.locator('[data-measurement="chest"]')).toHaveText('70–72');
});
test('idempotence, re-render, missing measurements and missing feed id', async ({ page }) => {
  await setup(page, { valid: false });
  const c = page.locator('[data-product-id="normal"]');
  await c.locator('[data-yo-service="matching_headpiece"]').check();
  await page.evaluate(() => {
    for (let i = 0; i < 3; i++) window.YOProductCardPersonalization.initialize();
  });
  await expect(page.locator('.yo-personalization')).toHaveCount(3);
  await expect(page.locator('dialog')).toHaveCount(1);
  await expect(page.locator('.el-item').last().locator('[data-yo-service="size_adaptation"]')).toBeDisabled();
  const fallback = await page.evaluate(() => window.YOProductCardPersonalization.getState(document.querySelector('.el-item:last-child')));
  expect(fallback.product_id).toBe(null); expect(fallback.card_key.startsWith('local:')).toBe(true);
  await page.evaluate(html => { document.querySelector('[data-product-id="normal"]').outerHTML = html; }, card('normal'));
  await expect(c.locator('[data-yo-service="matching_headpiece"]')).toBeChecked();
  await expect(c.locator('.yo-purchase-row .yo-price')).toHaveText('385 €');
  await page.evaluate(() => {
    document.querySelector('.grid').insertAdjacentHTML('beforeend', document.querySelector('[data-product-id="sale"]').outerHTML);
  });
  await expect(page.locator('.yo-personalization')).toHaveCount(4);
});
test('integration snapshots are detached and buy event carries addon state', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    document.addEventListener('yo:pce:buy', e => { window.lastBuy = e.detail; });
    document.addEventListener('click', e => { if (e.target.closest('.yo-purchase-row a')) e.preventDefault(); });
    window.YOProductCardPersonalization.getState('normal').addons.matching_headpiece.enabled = true;
  });
  expect((await state(page, 'normal')).addons.matching_headpiece.enabled).toBe(false);
  await page.locator('[data-product-id="normal"] [data-yo-service="matching_headpiece"]').check();
  await page.locator('[data-product-id="normal"] .yo-purchase-row a').click();
  expect(await page.evaluate(() => window.lastBuy.display_total_eur)).toBe(385);
});
test('checkout button re-render keeps base metadata and addon total', async ({ page }) => {
  await setup(page);
  await page.locator('[data-product-id="normal"] [data-yo-service="matching_headpiece"]').check();
  await page.evaluate(() => {
    const buy = document.querySelector('[data-product-id="normal"] .yo-purchase-row a');
    buy.innerHTML = 'Buy now <span class="yo-price" data-eur="370" data-weight="0.5">370 €</span>';
  });
  await expect(page.locator('[data-product-id="normal"] .yo-purchase-row .yo-price')).toHaveText('385 €');
  await expect(page.locator('[data-product-id="normal"] .yo-purchase-row .yo-price')).toHaveAttribute('data-weight', '0.5');
});
test('late feed identity preserves selections and re-render restores them', async ({ page }) => {
  await setup(page);
  const c = page.locator('.el-item').last();
  await c.locator('[data-yo-service="matching_headpiece"]').check();
  await page.evaluate(() => {
    const card = document.querySelector('.el-item:last-child');
    card.dataset.feedId = 'feed-model'; card.id = 'feed-model';
    document.dispatchEvent(new CustomEvent('yo:pce:identity', { detail: { card } }));
  });
  expect((await state(page, 'feed-model')).addons.matching_headpiece.enabled).toBe(true);
  await page.evaluate(html => { document.querySelector('.el-item:last-child').outerHTML = html.replace('class="el-item', 'data-feed-id="feed-model" class="el-item'); }, card(''));
  await expect(page.locator('[data-feed-id="feed-model"] [data-yo-service="matching_headpiece"]')).toBeChecked();
});
test('FX outage keeps EUR label, rapid currency changes ignore stale request', async ({ page }) => {
  await setup(page);
  await page.route('**/rates', route => route.abort());
  const c = page.locator('[data-product-id="normal"]');
  await c.locator('[data-yo-service="matching_headpiece"]').check();
  await c.locator('select[data-currency]').selectOption('USD');
  await expect(c.locator('.yo-purchase-row .yo-price')).toHaveText('385 €');
  await page.route('**/rates', async route => {
    await new Promise(resolve => setTimeout(resolve, 120));
    await route.fulfill({ json: [{ cc: 'EUR', rate: 40 }, { cc: 'USD', rate: 32 }] });
  });
  await c.locator('select[data-currency]').selectOption('EUR');
  await c.locator('select[data-currency]').selectOption('USD');
  await c.locator('select[data-currency]').selectOption('EUR');
  await expect(c.locator('.yo-purchase-row .yo-price')).toHaveText('385 €');
});
test('master switch leaves original layout available', async ({ page }) => {
  await setup(page, { enabled: false });
  await expect(page.locator('.yo-personalization')).toHaveCount(0);
  await expect(page.locator('.yo-size-block')).toHaveCount(0);
  await expect(page.locator('.sale-new-btn')).toHaveCount(1);
});
test('XML feed matching re-applies to dynamically inserted cards', async ({ page }) => {
  await setup(page, { feed: true });
  const c = page.locator('.el-item').last();
  await expect(c).toHaveAttribute('data-feed-id', 'no_feed');
  expect((await state(page, 'no_feed')).product_id).toBe('no_feed');
  await c.locator('[data-yo-service="extra_rhinestones"]').check();
  await page.evaluate(html => { document.querySelector('.el-item:last-child').outerHTML = html; }, card(''));
  await expect(c).toHaveAttribute('data-feed-id', 'no_feed');
  // First match migrated local identity; the newly rendered card must reuse the product identity.
  await expect(c.locator('[data-yo-service="extra_rhinestones"]')).toBeChecked();
});
for (const [name, width, height] of [['desktop',1440,1000], ['tablet',820,1180], ['mobile',375,812], ['small-mobile',320,640]]) {
  test(`layout and modal fit ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height }); await setup(page, { manager: true });
    for (const id of ['normal', 'sale']) {
      const c = page.locator('[data-product-id="' + id + '"]');
      const buy = await c.locator('.yo-purchase-row > a:not(.sale-old-btn)').boundingBox();
      const currency = await c.locator('select[data-currency]').boundingBox();
      const help = await c.locator('.yo-manager-help-toggle').boundingBox();
      expect(Math.abs((buy.y + buy.height/2) - (currency.y + currency.height/2))).toBeLessThan(2);
      expect(help.y).toBeGreaterThanOrEqual(buy.y + buy.height);
      expect(currency.x).toBeGreaterThanOrEqual(buy.x + buy.width);
      const services = await c.locator('.yo-personalization').boundingBox();
      expect(buy.y).toBeGreaterThanOrEqual(services.y + services.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (name === 'desktop') expect(await page.locator('.grid').evaluate(n => getComputedStyle(n).gridTemplateColumns.split(' ').length)).toBe(3);
    const sizes = page.locator('[data-product-id="sale"] .yo-size-block');
    const beforeHeight = (await sizes.boundingBox()).height;
    await sizes.locator('[data-unit="in"]').click();
    expect((await sizes.boundingBox()).height).toBe(beforeHeight);
    const fits = await sizes.locator('.yo-measure').evaluateAll(nodes => nodes.every(node => {
      const range = document.createRange(); range.selectNodeContents(node);
      const text = range.getBoundingClientRect();
      const cell = node.closest('.yo-size-cell').getBoundingClientRect();
      return text.width <= cell.width - 4 && text.height <= parseFloat(getComputedStyle(node).lineHeight) + 1;
    }));
    expect(fits).toBe(true);
    await sizes.locator('[data-unit="cm"]').click();
    await page.locator('[data-product-id="sale"] .yo-manager-help-toggle').click();
    await expect(page.locator('[data-product-id="sale"] .yo-manager-menu')).toBeVisible();
    await page.locator('[data-product-id="sale"] .yo-manager-help-toggle').click();
    await page.locator('[data-product-id="sale"] [data-yo-service="size_adaptation"]').check();
    const box = await page.locator('dialog').boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(box.y).toBeGreaterThanOrEqual(0); expect(box.y + box.height).toBeLessThanOrEqual(height);
    await page.screenshot({ path: `test-results/${name}-modal.png`, fullPage: true });
    await page.getByRole('button', { name: 'Apply changes' }).click();
    await page.screenshot({ path: `test-results/${name}-cards.png`, fullPage: true });
  });
}
test('modal cm/in converts originals, reductions and preview while keeping cm state and locked torso', async ({ page }) => {
  await setup(page);
  const c = page.locator('[data-product-id="normal"]');
  await c.locator('[data-unit="in"]').click();
  await c.locator('[data-yo-service="size_adaptation"]').check();
  await expect(page.locator('[data-yo-modal-unit="in"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-yo-original="chest"]')).toHaveText('27.6–28.3');
  await page.locator('#yo-reduce-chest').selectOption('-2');
  await expect(page.locator('#yo-reduce-chest option:checked')).toHaveText('−0.8');
  await expect(page.locator('[data-yo-adjusted="chest"]')).toHaveText('26.8–27.6');
  await expect(page.locator('#yo-reduce-torso')).toBeDisabled();
  await page.locator('[data-yo-modal-unit="cm"]').click();
  await expect(page.locator('[data-yo-original="chest"]')).toHaveText('70–72');
  await expect(page.locator('[data-yo-adjusted="chest"]')).toHaveText('68–70');
  await expect(page.locator('#yo-reduce-chest')).toHaveValue('-2');
  await page.getByRole('button', { name: 'Apply changes' }).click();
  expect((await state(page, 'normal')).addons.size_adaptation.adjustments).toEqual({ chest: -2, waist: 0, hips: 0, torso: 0 });
});
