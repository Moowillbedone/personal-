#!/usr/bin/env python3
"""Bundle the prototype into one HTML file.

usage: python3 build.py [out_dir] [--only=a.js,b.js]
  writes index.html (standalone document) and artifact.html (body fragment for the Artifact publisher)
"""
import sys
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / 'src'
args = [a for a in sys.argv[1:] if not a.startswith('--only=')]
ONLY = next((a[7:].split(',') for a in sys.argv[1:] if a.startswith('--only=')), None)
OUT = Path(args[0]) if args else ROOT
OUT.mkdir(parents=True, exist_ok=True)

TITLE = '브레인180 관리자 프로토타입'
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;600;700&family=IBM+Plex+Mono:wght@500&display=swap">')

ORDER = ['core.js', 'ui.js', 'data-gen.js', 'data.js', 'overview.js', 'intro.js']


def read(p):
    return p.read_text(encoding='utf-8')


def bundle(only=None):
    css = read(SRC / 'style.css')
    shell = read(SRC / 'shell.html')
    js = [read(SRC / f) for f in ORDER]
    screens = sorted((SRC / 'screens').glob('*.js'))
    if only:
        screens = [p for p in screens if p.name in only]
    js += [read(p) for p in screens]
    demo = SRC / 'demo.js'
    if demo.exists() and not only:
        js.append(read(demo))
    js.append('B.boot();')
    script = '\n;\n'.join(js).replace('</script', '<\\/script')
    return css, shell, script, [p.name for p in screens]


def main():
    css, shell, script, screens = bundle(ONLY)
    head = f'<title>{TITLE}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n{FONTS}\n<style>{css}</style>\n'
    body = f'{shell}\n<script>\n{script}\n</script>\n'
    (OUT / 'artifact.html').write_text(head + body, encoding='utf-8')
    full = ('<!doctype html>\n<html lang="ko">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            f'{head}</head>\n<body>\n{body}</body>\n</html>\n')
    (OUT / 'index.html').write_text(full, encoding='utf-8')
    print('built', OUT / 'index.html', len(full.encode('utf-8')), 'bytes;', len(screens), 'screen files:', ', '.join(screens))


if __name__ == '__main__':
    main()
