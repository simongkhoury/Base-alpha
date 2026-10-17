#!/usr/bin/env python3
"""Builds dist/index.html: the whole game in one file (scripts, styles, PeerJS and icons inlined)."""
import base64, json, re, subprocess, pathlib
root = pathlib.Path(__file__).parent
ESBUILD = '/tmp/pj/node_modules/.bin/esbuild'
js = subprocess.run([ESBUILD, str(root/'js/main.js'), '--bundle', '--format=iife', '--minify', '--target=safari15,chrome100'], check=True, capture_output=True, text=True).stdout
css = (root/'css/app.css').read_text()
peer = (root/'vendor/peerjs.min.js').read_text()
b64 = lambda p: base64.b64encode((root/p).read_bytes()).decode()
icon180 = 'data:image/png;base64,' + b64('icons/icon-180.png')
manifest = json.loads((root/'manifest.webmanifest').read_text())
manifest['icons'] = [{'src': 'data:image/png;base64,' + b64('icons/icon-512.png'), 'sizes': '512x512', 'type': 'image/png'}]
man_uri = 'data:application/manifest+json;base64,' + base64.b64encode(json.dumps(manifest).encode()).decode()
html = (root/'index.html').read_text()
html = html.replace('<link rel="apple-touch-icon" href="icons/icon-180.png">', f'<link rel="apple-touch-icon" href="{icon180}">\n<link rel="icon" href="{icon180}">')
html = html.replace('<link rel="manifest" href="manifest.webmanifest">', f'<link rel="manifest" href="{man_uri}">')
html = html.replace('<link rel="stylesheet" href="css/app.css">', '<style>\n' + css + '\n</style>')
safe = lambda s: s.replace('</script', '<\\/script')
html = html.replace('<script src="vendor/peerjs.min.js"></script>', '<script>' + safe(peer) + '</script>')
html = html.replace('<script type="module" src="js/main.js"></script>', '<script>' + safe(js) + '</script>')
assert 'src="js/' not in html and 'href="css/' not in html
(root/'dist').mkdir(exist_ok=True)
(root/'dist/index.html').write_text(html)
# AR body frames are loaded on demand, next to the page
import shutil
if (root/'art').exists(): shutil.rmtree(root/'dist/art', ignore_errors=True); shutil.copytree(root/'art', root/'dist/art')
print('dist/index.html', len(html)//1024, 'KB')
