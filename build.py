"""Assemble src/ into a single self-contained changeload.html."""
import re
from pathlib import Path
here = Path(__file__).parent
src = here / 'src'

# Night mode is declared twice in styles.css (once for devices set to dark, once for the explicit Night
# choice). The two blocks must carry the same values, or the two ways into Night mode look different.
css = (src / 'styles.css').read_text()
def dark_vars(selector):
    start = css.index(selector)
    return dict(re.findall(r'(--[\w-]+):\s*([^;]+);', css[start:css.index('}', start)]))
auto_dark, explicit_dark = dark_vars(':root:not([data-theme="light"]) {'), dark_vars(':root[data-theme="dark"] {')
if auto_dark != explicit_dark:
    diff = sorted(k for k in set(auto_dark) | set(explicit_dark) if auto_dark.get(k) != explicit_dark.get(k))
    raise SystemExit('styles.css: the two night-mode blocks differ in ' + ', '.join(diff))

html = (src / 'shell.html').read_text()
for marker, name in [('/*STYLES*/', 'styles.css'), ('/*ENGINE*/', 'engine.js'), ('/*SEED*/', 'seed.js'), ('/*APP*/', 'app.js')]:
    html = html.replace(marker, (src / name).read_text())
(here / 'changeload.html').write_text(html)
print('wrote', here / 'changeload.html', len(html), 'bytes')

# GitHub Pages build: a full standalone document (the Artifact host adds this skeleton itself).
head_part, body_part = html.split('<div class="app">', 1)
body_part = '<div class="app">' + body_part
page = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<meta name="description" content="ChangeLoad prototype: see the combined load of change initiatives on employee groups.">\n'
        '<style>[hidden]{display:none!important}body{margin:0}img{max-width:100%}</style>\n'
        + head_part + '</head>\n<body>\n' + body_part + '\n</body>\n</html>\n')
site = here / 'site'
site.mkdir(exist_ok=True)
(site / 'index.html').write_text(page)
(site / '.nojekyll').write_text('')
print('wrote', site / 'index.html', len(page), 'bytes')
