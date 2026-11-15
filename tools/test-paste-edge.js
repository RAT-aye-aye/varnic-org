/* Headless checks for the paste page's short-link path (the edge). Run with:
   NODE_PATH=/tmp/opencode/domtest/node_modules node tools/test-paste-edge.js */
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

const EDGE = 'https://api.varnic.org';
const ID = 'k3m9x2q7ta';

function boot(url, handler) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => {});
  const calls = [];
  const dom = new JSDOM(html, {
    url,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(w) {
      w.fetch = async function (target, options) {
        calls.push({ url: String(target), options: options || {} });
        return handler(String(target), options || {});
      };
      Object.defineProperty(w.navigator, 'clipboard', {
        value: { writeText: async () => {} },
        configurable: true
      });
    }
  });
  return { dom, w: dom.window, doc: dom.window.document, calls };
}

const jsonResponse = (data, status) => ({
  ok: (status || 200) < 400,
  status: status || 200,
  json: async () => data
});

async function main() {
  /* -------- creating a short link -------- */
  {
    const { w, doc, calls } = boot('http://localhost/paste/', async (target, options) => {
      if (target === EDGE + '/paste' && options.method === 'POST') {
        return jsonResponse({ id: ID, url: 'https://varnic.org/paste/?id=' + ID, ttl: '30d' }, 201);
      }
      throw new Error('unexpected ' + target);
    });

    const text = doc.getElementById('text');
    text.value = 'a note for the other device';
    text.dispatchEvent(new w.Event('input', { bubbles: true }));

    doc.getElementById('create').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await tick(150);

    const url = doc.getElementById('pasteUrl').value;
    ok('short link is used when the edge answers',
      url === 'http://localhost/paste/?id=' + ID, url);
    ok('the sheet is open', doc.getElementById('sheet').hidden === false);
    ok('the address bar is untouched', w.location.search === '' && w.location.hash === '', w.location.href);
    ok('the note mentions the 30 day default',
      /30 days/.test(doc.getElementById('sheetNote').textContent),
      doc.getElementById('sheetNote').textContent);

    const post = calls.find((c) => c.options.method === 'POST');
    ok('one POST went to the edge', !!post && post.url === EDGE + '/paste', calls.map((c) => c.url));
    const body = JSON.parse(post.options.body);
    ok('the body carries the text', body.text === 'a note for the other device', body.text);
    ok('the body carries the default ttl', body.ttl === '30d', body.ttl);
    ok('json is the content type', /application\/json/.test(post.options.headers['content-type']));
  }

  /* -------- the ttl control is honoured -------- */
  {
    const { w, doc, calls } = boot('http://localhost/paste/', async () =>
      jsonResponse({ id: ID }, 201));
    const ttl = doc.getElementById('ttl');
    ttl.value = '1h';
    doc.getElementById('text').value = 'burn soon';
    doc.getElementById('create').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await tick(150);
    const body = JSON.parse(calls.find((c) => c.options.method === 'POST').options.body);
    ok('the chosen ttl is sent', body.ttl === '1h', body.ttl);
    ok('the sheet names the chosen ttl',
      /1 hour/.test(doc.getElementById('sheetNote').textContent),
      doc.getElementById('sheetNote').textContent);
  }

  /* -------- opening a short link -------- */
  {
    const { w, doc, calls } = boot('http://localhost/paste/?id=' + ID, async (target) => {
      if (target === EDGE + '/paste/' + ID) {
        return jsonResponse({ id: ID, text: 'text that lives on the edge', chars: 27 });
      }
      throw new Error('unexpected ' + target);
    });
    await tick(150);
    ok('the paste is fetched from the edge', calls.length === 1 && calls[0].url === EDGE + '/paste/' + ID,
      calls.map((c) => c.url));
    ok('the text appears', doc.getElementById('text').value === 'text that lives on the edge',
      doc.getElementById('text').value);
    ok('the count follows', doc.getElementById('count').textContent === '27 characters',
      doc.getElementById('count').textContent);

    doc.getElementById('clear').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    ok('clear strips the ?id=', w.location.search === '', w.location.href);
  }

  /* -------- a dead id does not blow up the page -------- */
  {
    const { w, doc } = boot('http://localhost/paste/?id=gonegone12', async () =>
      jsonResponse({ error: 'not_found' }, 404));
    await tick(150);
    ok('a missing paste leaves the editor usable', doc.getElementById('text').value === '');
    doc.getElementById('text').value = 'still works';
    ok('typing still works after a 404', doc.getElementById('text').value === 'still works');
  }

  /* -------- fallbacks -------- */
  {
    const { w, doc } = boot('http://localhost/paste/', async () =>
      jsonResponse({ error: 'nope' }, 500));
    doc.getElementById('text').value = 'edge is down, link it is';
    doc.getElementById('create').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await tick(200);
    const url = doc.getElementById('pasteUrl').value;
    ok('a 500 falls back to the fragment', url.indexOf('http://localhost/paste/#p=') === 0, url.slice(0, 40));
    ok('the fallback note explains itself',
      /no server/.test(doc.getElementById('sheetNote').textContent),
      doc.getElementById('sheetNote').textContent);
  }
  {
    const { w, doc } = boot('http://localhost/paste/', async () => {
      throw new TypeError('network down');
    });
    doc.getElementById('text').value = 'offline still works';
    doc.getElementById('create').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    await tick(200);
    ok('a network failure falls back too',
      doc.getElementById('pasteUrl').value.indexOf('#p=') !== -1,
      doc.getElementById('pasteUrl').value.slice(0, 40));
    ok('the button is usable again', doc.getElementById('create').disabled === false);
    ok('the button says create again', doc.getElementById('create').textContent === 'Create link',
      doc.getElementById('create').textContent);
  }

  /* -------- static checks -------- */
  {
    const { doc } = boot('http://localhost/paste/', async () => jsonResponse({}));
    ok('the edge base is declared in one place',
      doc.querySelector('meta[name="edge-api"]').getAttribute('content') === EDGE);
    ok('no external scripts', doc.querySelectorAll('script[src]').length === 0);
    ok('no prompt popups', html.indexOf('window.prompt') === -1);
  }

  console.log(failures === 0 ? '\nALL EDGE-PASTE TESTS PASSED' : '\n' + failures + ' EDGE-PASTE TEST(S) FAILED');
  process.exit(failures ? 1 : 0);
}

main();
