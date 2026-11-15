/* Headless checks for the paste page. Run with:
   NODE_PATH=/tmp/opencode/domtest/node_modules node tools/test-paste.js */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const dir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'paste', 'index.html'), 'utf8');

let failures = 0;
function ok(name, cond, extra) {
  if (cond) console.log('PASS ' + name);
  else {
    failures++;
    console.log('FAIL ' + name + (extra !== undefined ? ' -> ' + JSON.stringify(extra) : ''));
  }
}
const tick = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function boot(url) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});
  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc
  });
  return { dom, w: dom.window, doc: dom.window.document };
}

(async function main() {
  const { w, doc } = boot('http://localhost/paste/');
  const text = doc.getElementById('text');
  const count = doc.getElementById('count');
  const sheet = doc.getElementById('sheet');
  const url = doc.getElementById('pasteUrl');

  ok('starts empty', text.value === '');
  ok('count starts at zero', count.textContent === '0 characters', count.textContent);

  text.value = 'hello from my phone\nand a second line';
  text.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('count follows the text', count.textContent === text.value.length.toLocaleString() + ' characters', count.textContent);

  ok('sheet starts hidden', sheet.hidden === true);
  doc.getElementById('create').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await tick(120);

  ok('create opens the sheet', sheet.hidden === false);
  ok('link uses the #p= fragment', url.value.indexOf('http://localhost/paste/#p=') === 0, url.value.slice(0, 48));
  ok('link is not empty', url.value.length > 40);
  ok('address bar stays clean', w.location.hash === '', w.location.hash);

  const meta = doc.getElementById('linkMeta').textContent;
  ok('sheet shows lengths', /characters of text/.test(meta) && /character link/.test(meta), meta);

  doc.getElementById('close').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('sheet closes', sheet.hidden === true);

  /* -------- an empty paste creates nothing -------- */
  doc.getElementById('clear').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('clear empties the editor', text.value === '');
  doc.getElementById('create').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await tick(60);
  ok('empty paste does not open the sheet', sheet.hidden === true);

  /* -------- loading a shared link -------- */
  const shared = 'this text came from a link\n\nwith blank lines';
  const token = Buffer.from(shared, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const incoming = boot('http://localhost/paste/#p=' + token);
  await tick(80);
  const inText = incoming.doc.getElementById('text');
  ok('shared link restores the text', inText.value === shared, inText.value);
  ok('shared link updates the count',
    incoming.doc.getElementById('count').textContent === shared.length.toLocaleString() + ' characters',
    incoming.doc.getElementById('count').textContent);

  incoming.doc.getElementById('clear').dispatchEvent(new incoming.w.MouseEvent('click', { bubbles: true }));
  ok('clear removes the link fragment', incoming.w.location.hash === '', incoming.w.location.hash);

  /* -------- static checks -------- */
  ok('no external scripts on the page', doc.querySelectorAll('script[src]').length === 0);
  ok('no prompt popups', html.indexOf('window.prompt') === -1);

  console.log(failures === 0 ? '\nALL PASTE TESTS PASSED' : '\n' + failures + ' PASTE TEST(S) FAILED');
  process.exit(failures ? 1 : 0);
})();
