# varnic.org

The small home page for **varnic.org**, plus the **HTML Lab** at
<https://varnic.org/lab/>.

Everything is static, client-side, and MIT licensed. No trackers, no accounts,
no build step — GitHub Pages serves the files exactly as they are.

## Layout

| Path | What it is |
| --- | --- |
| `index.html` | The varnic.org home page (links to the lab, chess, source) |
| `lab/index.html` | The HTML Lab: editor + live sandboxed preview |
| `icon.svg` | Green-flame favicon |
| `tools/test-lab.js` | Headless tests for the lab (jsdom) |
| `CNAME` | `varnic.org`, for GitHub Pages |
| `LICENSE` | MIT |

## HTML Lab

- Type HTML/CSS/JS, press **Run** (or `Ctrl`/`Cmd` + `Enter`).
- **Open file** loads a local `.html`/`.htm`/`.txt` file into the editor. The
  file is read in the browser and never uploaded.
- **Share link** puts the entire snippet into the URL fragment (`#code=...`),
  compressed when the browser supports `CompressionStream`. Fragments are not
  sent to the server, so the code travels only in the link itself.
- **Download** saves the snippet as `page.html`; **Reset** restores the starter.
- The last snippet is kept in `localStorage`.
- The preview runs in a sandboxed iframe (`allow-scripts allow-modals
  allow-forms`, no same-origin access), so it cannot touch the parent page.

Share links are as private as any URL: anyone who has the link can read the
code, and it may appear in browser history. Don't put secrets in one.

## Tests

```bash
# jsdom is only needed for the tests, not for the site
NODE_PATH=/tmp/opencode/domtest/node_modules node tools/test-lab.js
```

## Deploy

Push to `main`; GitHub Pages rebuilds `varnic.org` from the repository root.
DNS lives at Porkbun: apex `A`/`AAAA` records point at GitHub Pages and `www`
is a `CNAME` to `rat-aye-aye.github.io`.
