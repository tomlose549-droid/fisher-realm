// Local-only acceptance: fresh contexts never use a player's browser save.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {pathToFileURL} = require('node:url');
const root = path.resolve(__dirname, '../..');
const types = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.webp':'image/webp', '.wav':'audio/wav'};

async function readyImage(page, wrapper, expectedPath) {
  await wrapper.scrollIntoViewIfNeeded();
  try {
    await page.waitForFunction(element => ['ready', 'error', 'missing'].includes(element.dataset.imageState),
      await wrapper.elementHandle(), {timeout:15000});
  } catch (error) {
    throw new Error(`Image timed out: ${expectedPath}; state=${await wrapper.getAttribute('data-image-state')}`, {cause:error});
  }
  assert.equal(await wrapper.getAttribute('data-image-state'), 'ready', expectedPath);
  assert.ok(await wrapper.locator('img:not(.guide-preview)').evaluate((img, expected) =>
    img.complete && img.naturalWidth > 0 && decodeURIComponent(new URL(img.currentSrc).pathname).endsWith(expected),
  expectedPath), expectedPath);
}

async function main() {
  const selector = process.argv[2];
  assert.ok(selector && process.argv.length === 3, 'Usage: node tests/browser/new-fish.cjs FISH_ID_OR_NAME');
  const {FISH_DATA} = await import(pathToFileURL(path.join(root, 'fish-data.js')).href);
  const {buildFishHelp} = await import(pathToFileURL(path.join(root, 'fish-help.js')).href);
  const fish = FISH_DATA.find(f => f.id === selector || f.name === selector);
  assert.ok(fish, `Unknown fish: ${selector}`);
  const help = buildFishHelp().profiles.find(f => f.id === fish.id);
  const sourcePath = fish.inventory.image && '/fish-images/' + fish.inventory.image;
  const thumbPath = fish.inventory.image && '/fish-images/thumbnails/' + fish.inventory.image.replace(/\.[^./]+$/, '.webp');
  for (const asset of [sourcePath, thumbPath].filter(Boolean))
    assert.ok(fs.existsSync(path.join(root, asset.slice(1))), `Missing asset: ${asset}`);
  const requests = [];
  const server = http.createServer((req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      const relative = path.relative(root, file);
      if (relative.startsWith('..') || path.isAbsolute(relative) ||
          relative.split(path.sep).some(part => part.startsWith('.')) || !types[path.extname(file)])
        return res.writeHead(403).end();
      requests.push(pathname);
      const content = fs.readFileSync(file);
      res.writeHead(200, {'Content-Type':types[path.extname(file)], 'Cache-Control':'no-store'}).end(content);
    } catch { res.writeHead(404).end(); }
  });
  let browser;
  try {
    await new Promise((resolve, reject) => {server.once('error', reject); server.listen(0, '127.0.0.1', resolve);});
    browser = await chromium.launch({headless:true,
      ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),
      args:['--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader']});
    for (const saved of [false, true]) {
      requests.length = 0;
      const context = await browser.newContext({viewport:{width:1440, height:960}});
      try {
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        if (saved) await page.addInitScript(name => {
          if (!localStorage.getItem('fisher-realm-inventory-v1')) localStorage.setItem(
            'fisher-realm-inventory-v1', JSON.stringify({version:1, items:[
              {id:'1', name, x:0, y:0}, {id:'2', name, x:null, y:null}]}));
        }, fish.name);
        await page.goto('http://127.0.0.1:' + server.address().port + '/', {waitUntil:'domcontentloaded'});
        await page.locator('#loading').waitFor({state:'hidden'});
        await page.locator('#settings-toggle').click();
        await page.locator('#realm-command').fill('realm owner');
        assert.deepEqual(await page.locator('#owner-fish option').allTextContents(), FISH_DATA.map(f => f.name));
        await page.locator('#owner-fish').selectOption({label:fish.name});
        await page.locator('#owner-fish-form .primary').click();
        await page.waitForFunction(() => !window.lakeside.getState().paused);
        assert.deepEqual((await page.evaluate(() => window.lakeside.getState())).fishing.ownerMode,
          {fishName:fish.name, remaining:10});
        await page.locator('#help').click();
        assert.equal(await page.locator('.help-fish-entry').count(), FISH_DATA.length);
        const entry = page.locator(`[data-help-fish-id="${fish.id}"]`);
        await entry.locator('summary').click();
        for (const line of help.lines) assert.ok((await entry.textContent()).includes(line), line);
        await page.locator('#help-dialog .close').click();
        if (saved) {
          await page.locator('#backpack-toggle').click();
          const cards = page.locator('.inventory-fish');
          assert.equal(await cards.count(), 2);
          for (let i = 0; i < 2; i++) {
            if (thumbPath) await readyImage(page, cards.nth(i), thumbPath);
            else assert.equal(await cards.nth(i).locator('img').count(), 0);
          }
          const bag = page.locator('#inventory-grid [data-fish-id="1"]');
          assert.deepEqual(await bag.evaluate(e => [getComputedStyle(e).gridColumnEnd, getComputedStyle(e).gridRowEnd]),
            ['span ' + fish.inventory.w, 'span ' + fish.inventory.h]);
          assert.ok(await cards.evaluateAll((cards, color) => cards.every(card => {
            const probe = document.createElement('i'); probe.style.color = color; document.body.append(probe);
            const equal = getComputedStyle(card).backgroundColor === getComputedStyle(probe).color;
            probe.remove(); return equal;
          }), fish.inventory.color));
          if (thumbPath) assert.equal(requests.includes(sourcePath), false, 'Bag must use thumbnail without source fallback');
          const screenshots = path.join(root, '.qa', 'new-fish');
          fs.mkdirSync(screenshots, {recursive:true});
          await page.screenshot({path:path.join(screenshots, fish.id + '-inventory.png')});
          await page.locator('#inventory-close').click();
        }
        await page.locator('#settings-toggle').click();
        await page.locator('#fish-guide-toggle').click();
        assert.equal(await page.locator('.guide-locked').count(), FISH_DATA.length - (saved ? 1 : 0));
        const guide = page.locator(`[data-guide-fish-id="${fish.id}"]`);
        if (!saved) {
          assert.equal(await guide.count(), 0);
          assert.equal(requests.filter(p => p.startsWith('/fish-images/')).length, 0);
        } else {
          await page.locator('#fish-guide-search').fill(fish.name);
          if (thumbPath) await readyImage(page, guide.locator('.guide-thumbnail'), thumbPath);
          if (sourcePath) assert.equal(requests.includes(sourcePath), false, 'Original loads only after expand');
          await guide.locator('summary').click();
          if (sourcePath) await readyImage(page, guide.locator('.guide-large-image'), sourcePath);
          else assert.equal(await guide.locator('.guide-large-image').getAttribute('data-image-state'), 'missing');
          const swatches = await guide.locator('.guide-swatch').evaluateAll(chips => chips.map(c => c.style.backgroundColor));
          const expected = await page.evaluate(colors => colors.map(color => {
            const element = document.createElement('i'); element.style.backgroundColor = color; return element.style.backgroundColor;
          }), [help.catchColor, help.inventoryColor]);
          assert.deepEqual(swatches, expected);
        }
        await page.locator('#fish-guide-close').click();
        await page.reload({waitUntil:'domcontentloaded'});
        await page.locator('#loading').waitFor({state:'hidden'});
        assert.equal((await page.evaluate(() => window.lakeside.getState())).inventory.items.length, saved ? 2 : 0);
        if (saved) assert.deepEqual(await page.evaluate(() => JSON.parse(
          localStorage.getItem('fisher-realm-discoveries-v1')).fishIds), [fish.id]);
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({fish:fish.id, scenario:saved ? 'bag-pile-unlocked' : 'fresh-locked',
          catalog:FISH_DATA.length, result:'passed'}));
      } finally { await context.close(); }
    }
  } finally {
    try { if (browser) await browser.close(); }
    finally { if (server.listening) await new Promise(resolve => server.close(resolve)); }
  }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
