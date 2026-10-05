"""Assemble src/ into a single self-contained changeload.html."""
from pathlib import Path
here = Path(__file__).parent
src = here / 'src'
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
