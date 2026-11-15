# varnic.org

The small home page for **varnic.org**, plus the **HTML Lab** at
<https://varnic.org/lab/>.

Everything is static, client-side, and MIT licensed. No trackers, no accounts,
no build step — GitHub Pages serves the files exactly as they are.

One optional exception: the paste page can use a small Cloudflare Worker
([`edge`](https://github.com/RAT-aye-aye/edge)) to hand out short links. The
page works without it, storing the text in the URL instead.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The varnic.org home page (links to the lab, paste, chess, source) |
| `lab/index.html` | The HTML Lab: editor + live sandboxed preview |
| `paste/index.html` | Paste: short links via the edge, or text inside the URL |
| `icon.svg` | Green-flame favicon |
| `tools/test-lab.js` | Headless tests for the lab (jsdom) |
| `tools/test-paste.js` | Headless tests for the paste page's offline mode (jsdom) |
| `tools/test-paste-edge.js` | Headless tests for the paste page's short-link mode |
| `CNAME` | `varnic.org`, for GitHub Pages |
| `LICENSE` | MIT |

## HTML Lab

- Type HTML/CSS/JS, press **Run** (or `Ctrl`/`Cmd` + `Enter`).
- **Open file** loads a local `.html`/`.htm`/`.txt` file into the editor. The
  file is read in the browser and never uploaded.
- **Share link** puts the entire snippet into the URL fragment (`#code=...`),
  compressed when the browser supports `CompressionStream`. Fragments are not
  sent to the server, so the code travels only in the link itself. A link looks
  like `/lab/#code=z:H4sI...` — the `z:` means raw-deflate, and the rest is
  base64url. It is not meant to be read; the lab decodes it on load.
  The link appears in an in-page sheet (no `window.prompt` popups, which
  browsers block), and the address bar is left alone.
- **Download** saves the snippet as `page.html`; **Reset** restores the starter.
- The last snippet is kept in `localStorage`.
- The preview runs in a sandboxed iframe (`allow-scripts allow-modals
  allow-forms allow-popups allow-popups-to-escape-sandbox`, but **not**
  `allow-same-origin`), so snippets can open windows and use dialogs but
  cannot touch the lab's own page, cookies, or storage.
- `window.open()` still needs a real tap or click inside the preview. Code
  that opens a popup on load is blocked by the browser itself, in the lab or
  anywhere else. On Android Chrome a popup usually appears as a new tab.

Share links are as private as any URL: anyone who has the link can read the
code, and it may appear in browser history. Don't put secrets in one.

## Paste

`paste/index.html` moves text between devices. Type or paste, pick how long the
link should live, press **Create link**.

Two modes, chosen automatically:

1. **Short link (the edge).** If `api.varnic.org` answers, the text is stored in
   Workers KV and the link is just an id:
   `https://varnic.org/paste/?id=k3m9x2q7ta`. These expire after the chosen
   1 hour / 1 day / 7 days / 30 days.
2. **Link with the text inside.** If the edge is unreachable (offline, not
   deployed, rate limited), the page compresses the text into the fragment
   (`#p=z:...`) exactly as before. Nothing is stored, but the link is long.

The API lives in the separate [edge](https://github.com/RAT-aye-aye/edge) repo;
the page reads its base URL from `<meta name="edge-api">` and needs no other
configuration.

- 200,000 character limit either way. Long fragment links get a warning past
  ~8,000 characters, since some chat apps truncate URLs.
- **Clear** also strips `?id=` and `#p=` from the address bar.
- Like any link, it is readable by anyone who has it. Not for passwords.

## Tests

```bash
# jsdom is only needed for the tests, not for the site
NODE_PATH=/tmp/opencode/domtest/node_modules node tools/test-lab.js
NODE_PATH=/tmp/opencode/domtest/node_modules node tools/test-paste.js
NODE_PATH=/tmp/opencode/domtest/node_modules node tools/test-paste-edge.js
```

## Deploy

Push to `main`; GitHub Pages rebuilds `varnic.org` from the repository root.
DNS lives at Porkbun: apex `A`/`AAAA` records point at GitHub Pages and `www`
is a `CNAME` to `rat-aye-aye.github.io`.
