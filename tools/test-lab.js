/* Headless checks for the HTML Lab page. Run with:
   NODE_PATH=/tmp/opencode/domtest/node_modules node tools/test-lab.js */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const dir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(dir, 'lab', 'index.html'), 'utf8');

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
  const { w, doc } = boot('http://localhost/lab/');
  const code = doc.getElementById('code');
  const out = doc.getElementById('out');

  ok('editor starts with an example', code.value.includes('<!DOCTYPE html>'), code.value.slice(0, 40));
  ok('preview rendered on load', (out.getAttribute('srcdoc') || '').includes('Hello from the lab'));

  code.value = '<h1 id="x">hi</h1>';
  code.dispatchEvent(new w.Event('input', { bubbles: true }));
  ok('input is saved locally', (w.localStorage.getItem('lab.code.v1') || '').includes('hi'));

  doc.getElementById('run').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('Run updates the preview', out.getAttribute('srcdoc') === '<h1 id="x">hi</h1>', out.getAttribute('srcdoc'));

  const sel = doc.getElementById('examples');
  sel.value = 'clock';
  sel.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('example loads', code.value.includes('setInterval'), code.value.slice(0, 30));

  doc.getElementById('reset').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('reset restores starter example', code.value.includes('Clicked 0 times'), code.value.slice(0, 30));

  /* -------- open file -------- */
  const openBtn = doc.getElementById('open');
  const fileInput = doc.getElementById('file');
  ok('open-file button exists', openBtn !== null);
  ok('file input accepts html', /\.html/.test(fileInput.getAttribute('accept') || ''), fileInput.getAttribute('accept'));
  ok('file input is hidden', fileInput.hidden === true);

  let pickerOpened = false;
  fileInput.click = () => { pickerOpened = true; };
  openBtn.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('open-file button opens the picker', pickerOpened);

  const file = new w.File(['<p id="opened">opened from disk</p>'], 'demo.html', { type: 'text/html' });
  w.location.hash = '#code=stale';
  Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
  fileInput.dispatchEvent(new w.Event('change', { bubbles: true }));
  await tick(80);
  ok('opened file lands in the editor', code.value.includes('opened from disk'), code.value.slice(0, 40));
  ok('opened file is previewed', (out.getAttribute('srcdoc') || '').includes('opened from disk'));
  ok('opened file clears the old hash', w.location.hash === '', w.location.hash);

  /* -------- share link -------- */
  ok('share button exists', doc.getElementById('share') !== null);
  const sheet = doc.getElementById('shareSheet');
  const shareUrl = doc.getElementById('shareUrl');
  doc.getElementById('share').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  await tick(150);
  ok('share opens the sheet', sheet.hidden === false);
  ok('share box holds the link', shareUrl.value.indexOf('http://localhost/lab/#code=') === 0, shareUrl.value.slice(0, 48));
  ok('share link has content', shareUrl.value.length > 40);
  ok('address bar stays clean', w.location.hash === '', w.location.hash);
  doc.getElementById('shareClose').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  ok('sheet closes', sheet.hidden === true);

  /* -------- loading a shared link -------- */
  const sharedCode = '<h1 id="shared">from the link</h1>';
  const token = Buffer.from(sharedCode, 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const shared = boot('http://localhost/lab/#code=' + token);
  await tick(60);
  const sharedCodeEl = shared.doc.getElementById('code');
  const sharedOut = shared.doc.getElementById('out');
  ok('shared link restores the code', sharedCodeEl.value === sharedCode, sharedCodeEl.value);
  ok('shared link renders the preview', (sharedOut.getAttribute('srcdoc') || '').includes('from the link'));

  /* -------- safety / static checks -------- */
  ok('preview allows popups', (out.getAttribute('sandbox') || '').indexOf('allow-popups') !== -1);
  ok('popup can escape the sandbox', (out.getAttribute('sandbox') || '').indexOf('allow-popups-to-escape-sandbox') !== -1);
  ok('preview cannot reach the parent origin', (out.getAttribute('sandbox') || '').indexOf('allow-same-origin') === -1);
  ok('no external scripts on the page', doc.querySelectorAll('script[src]').length === 0);

  console.log(failures === 0 ? '\nALL LAB TESTS PASSED' : '\n' + failures + ' LAB TEST(S) FAILED');
  process.exit(failures ? 1 : 0);
})();
