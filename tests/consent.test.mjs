import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import { transform } from 'esbuild';
const source = fs.readFileSync(new URL('../src/components/CookieBanner.astro', import.meta.url), 'utf8').split('<script>')[1].split('</script>')[0];
const { code } = await transform(source, { loader: 'ts', format: 'esm' });
function setup(stored, unavailable = false) {
  const elements = new Map(); const scripts = []; let value = stored;
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { style: {}, focus() {}, addEventListener(_event, fn) { this.click = fn; } });
    return elements.get(id);
  };
  const context = vm.createContext({
    localStorage: { getItem() { if (unavailable) throw Error(); return value; }, setItem(_key, next) { if (unavailable) throw Error(); value = next; } },
    location: { hostname: 'www.example.test' },
    document: { cookie: '_ga=abc', getElementById: element, querySelectorAll: () => [element('settings')], createElement: () => ({}), head: { appendChild: (script) => scripts.push(script) } },
  });
  context.window = context;
  vm.runInContext(code, context);
  return { context, scripts, element, value: () => value };
}
test('no Google script before consent; accept tracks once; revoke disables tracking and can be reversed', () => {
  const page = setup(null);
  assert.equal(page.scripts.length, 0);
  page.element('cb-accept').click();
  assert.equal(page.scripts.length, 1);
  assert.equal(page.context.dataLayer[0][2].analytics_storage, 'granted');
  assert.equal(page.context.dataLayer[2][0], 'config');
  page.element('settings').click();
  assert.equal(page.element('cookie-banner').style.display, 'block');
  page.element('cb-reject').click();
  assert.equal(page.context['ga-disable-G-CR1P08P9V3'], true);
  assert.equal(page.value(), 'denied');
  page.element('cb-accept').click();
  assert.equal(page.context['ga-disable-G-CR1P08P9V3'], false);
  assert.equal(page.scripts.length, 1);
});
test('remembered consent and unavailable storage', () => {
  assert.equal(setup('granted').scripts.length, 1);
  assert.equal(setup('denied').scripts.length, 0);
  const page = setup(null, true);
  assert.equal(page.element('cookie-banner').style.display, 'block');
  page.element('cb-reject').click();
  assert.equal(page.scripts.length, 0);
});
