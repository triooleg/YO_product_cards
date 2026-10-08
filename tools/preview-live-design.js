const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Render local assets over a read-only public page; never submit a checkout request.
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
    const root = path.join(__dirname, '..');
    const plugin = path.join(root, 'yoleotard-product-card-enhancer');
    await page.route('**/*', async route => {
      const request = route.request();
      if (request.method() !== 'GET') return route.abort();
      const url = new URL(request.url());
      if (url.pathname.includes('/assets/icons/')) {
        const icon = path.join(plugin, 'assets/icons', path.basename(url.pathname));
        if (fs.existsSync(icon)) return route.fulfill({ path: icon, contentType: 'image/svg+xml' });
      }
      if (url.pathname.endsWith('/yoleotard-product-card-enhancer/assets/js/frontend.js')) {
        return route.fulfill({ path: path.join(plugin, 'assets/js/frontend.js'), contentType: 'application/javascript' });
      }
      if (url.pathname.endsWith('/yoleotard-product-card-enhancer/assets/js/personalization.js')) {
        return route.fulfill({ path: path.join(plugin, 'assets/js/personalization.js'), contentType: 'application/javascript' });
      }
      if (url.pathname.endsWith('/yoleotard-product-card-enhancer/assets/css/frontend.css')) {
        return route.fulfill({ path: path.join(plugin, 'assets/css/frontend.css'), contentType: 'text/css' });
      }
      return route.continue();
    });
    await page.goto(process.argv[2] || 'https://www.yoleotard.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.YOProductCardCore);
    await page.evaluate(() => {
      window.YOProductCardCore.cfg.personalization = { enabled: true, services: {
        size_adaptation: { enabled: true, priceEur: 25 }, matching_headpiece: { enabled: true, priceEur: 15 }, extra_rhinestones: { enabled: true, priceEur: 10 }
      } };
    });
    if (!(await page.evaluate(() => !!window.YOProductCardPersonalization))) await page.addScriptTag({ path: path.join(plugin, 'assets/js/personalization.js') });
    const cards = page.locator('.yo-personalized-card');
    await cards.first().waitFor();
    const frozen = cards.filter({ hasText: 'Frozen Sakura' });
    if (await frozen.count()) {
      const value = await frozen.first().locator('.yo-height-value').textContent();
      if (value !== '170–175') throw new Error('Frozen Sakura height missing or wrong: ' + value);
      console.log('Frozen Sakura filter height verified:', value);
    }
    await cards.first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelectorAll('.yo-personalized-card .yo-manager-help').length > 0);
    await page.waitForFunction(() => {
      const image = document.querySelector('.yo-personalized-card img');
      return image && image.complete && image.naturalWidth > 0;
    });
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    const mediaColor = await page.evaluate(() => {
      const image = document.querySelector('.yo-product-media img');
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 1, 1, 0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    });
    console.log('Image background pixel:', mediaColor);
    await cards.first().screenshot({ path: path.join(root, 'test-results/live-theme-card.png') });
    if (await frozen.count()) {
      await frozen.first().scrollIntoViewIfNeeded();
      await frozen.first().locator('.yo-product-media img').evaluate(image => image.complete && image.naturalWidth > 0 || new Promise(resolve => image.addEventListener('load', resolve, { once: true })));
      await frozen.first().screenshot({ path: path.join(root, 'test-results/live-theme-frozen-height.png') });
    }
    const currencyControls = page.locator('.yo-personalized-card select[data-currency]');
    const originalCurrencies = await currencyControls.evaluateAll(nodes => nodes.map(node => node.value));
    await currencyControls.first().selectOption('USD');
    const changedCurrencies = await currencyControls.evaluateAll(nodes => nodes.map(node => node.value));
    if (changedCurrencies[0] !== 'USD' || changedCurrencies.slice(1).some((value, i) => value !== originalCurrencies[i + 1])) {
      throw new Error('Currency leaked to other cards.');
    }
    await currencyControls.first().selectOption(originalCurrencies[0]);
    for (const width of [1440, 820, 375, 320]) {
      await page.setViewportSize({ width, height: 1200 });
      await cards.first().scrollIntoViewIfNeeded();
      const sizes = cards.first().locator('.yo-size-block');
      const cmHeight = (await sizes.boundingBox()).height;
      const heightCheck = await cards.first().evaluate(card => {
        const tag = card.closest('[data-tag]').getAttribute('data-tag');
        const firstTag = tag.split(',')[0].trim();
        const heightTag = /^Height-/i.test(firstTag) ? firstTag.split(/\s+/)[0] : firstTag;
        const range = /^Height(?:\s+|-)(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)$/i.exec(heightTag);
        const value = card.querySelector('.yo-height-value');
        const header = card.querySelector('.yo-size-header');
        const summary = header.querySelector('.yo-size-summary').getBoundingClientRect();
        const toggle = header.querySelector('.yo-unit-toggle').getBoundingClientRect();
        return value && value.textContent === range[1] + '–' + range[2] && summary.right <= toggle.left && header.scrollWidth <= header.clientWidth;
      });
      if (!heightCheck) throw new Error('Filter height or header layout incorrect at width ' + width);
      const { media, sizeBox } = await cards.first().evaluate(card => {
        const photo = card.querySelector('.yo-product-media > a').getBoundingClientRect();
        const size = card.querySelector('.yo-size-block').getBoundingClientRect();
        return { media: { x: photo.x, y: photo.y, width: photo.width, height: photo.height }, sizeBox: { x: size.x, y: size.y, width: size.width, height: size.height } };
      });
      const play = await cards.first().locator('a[data-type="video"] .uk-inline-clip').evaluate(node => {
        const style = getComputedStyle(node, '::after');
        return { visible: style.content !== 'none' && style.backgroundImage !== 'none' && Number(style.opacity) > 0, width: parseFloat(style.width), height: parseFloat(style.height), centered: Math.abs(parseFloat(style.left) - node.clientWidth / 2) < 1 && Math.abs(parseFloat(style.top) - node.clientHeight / 2) < 1 };
      });
      if (!play.visible || !play.centered || play.width !== 40 || play.height !== 40) throw new Error(JSON.stringify({ width, play }));
      if (Math.abs(sizeBox.y - media.y - media.height) > 1 || Math.abs(sizeBox.x - media.x) > 1) {
        throw new Error(JSON.stringify({ width, media, sizeBox, error: 'Image and measurements are not joined' }));
      }
      await sizes.locator('[data-unit="in"]').click();
      const inHeight = (await sizes.boundingBox()).height;
      if (!(await sizes.locator('.yo-size-header').evaluate(node => node.scrollWidth <= node.clientWidth))) throw new Error('Inch header overflows at width ' + width);
      const fits = await sizes.locator('.yo-measure').evaluateAll(nodes => nodes.every(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        return range.getBoundingClientRect().width <= node.closest('.yo-size-cell').getBoundingClientRect().width - 4;
      }));
      if (cmHeight !== inHeight || !fits) throw new Error('Inch ranges do not fit at width ' + width);
      await sizes.locator('[data-unit="cm"]').click();
      const geometry = await page.evaluate(() => Array.from(document.querySelectorAll('.yo-personalized-card')).slice(0, 3).map(card => {
        const buy = card.querySelector('.yo-purchase-row > a:not(.sale-old-btn)').getBoundingClientRect();
        const currency = card.querySelector('.yo-purchase-row > select').getBoundingClientRect();
        const help = card.querySelector('.yo-manager-help-toggle')?.getBoundingClientRect();
        return { equalHeight: buy.height === 42 && currency.height === buy.height && (!help || help.height === buy.height), aligned: Math.abs(buy.top + buy.height / 2 - currency.top - currency.height / 2) < 2,
          helpBelow: !help || help.top >= buy.bottom, currencyRight: currency.left >= buy.right };
      }));
      if (geometry.some(card => !card.equalHeight || !card.aligned || !card.helpBelow || !card.currencyRight)) throw new Error(JSON.stringify({ width, geometry }));
      console.log(JSON.stringify({ width, geometry }));
    }
    await page.setViewportSize({ width: 1440, height: 1200 });
    const videoLink = cards.first().locator('.yo-product-media > a[data-type="video"]');
    const videoUrl = await videoLink.getAttribute('href');
    await videoLink.click();
    const video = page.locator(`.uk-lightbox video[src=${JSON.stringify(videoUrl)}]`);
    await video.waitFor({ state: 'visible' });
    if (!(await video.getAttribute('src')).endsWith(videoUrl)) throw new Error('Lightbox changed the video URL');
    await page.waitForFunction(url => { const video = Array.from(document.querySelectorAll('.uk-lightbox video')).find(node => node.getAttribute('src') === url); return video && video.readyState >= 1 && video.videoWidth > 0; }, videoUrl);
    await video.evaluate(node => node.pause());
    await page.screenshot({ path: path.join(root, 'test-results/live-theme-video.png') });
    await page.keyboard.press('Escape');
    await video.waitFor({ state: 'hidden' });
    console.log('Original video link opens the existing lightbox and loads video metadata.');
    await cards.first().locator('[data-yo-service="size_adaptation"]').check();
    await page.locator('[data-yo-modal-unit="in"]').click();
    await page.locator('dialog').screenshot({ path: path.join(root, 'test-results/live-theme-modal.png') });
    console.log('Live theme preview verified with local assets. No site updates or checkout submissions.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
