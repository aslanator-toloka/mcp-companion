"""Freeze Jarvis' token artwork for every reference in the local card dataset.
Run manually; normal builds and the application never depend on Jarvis availability.
"""
import concurrent.futures
import hashlib
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = 'https://www.jarvis-protocol.com'

def fetch(url):
    with urllib.request.urlopen(url, timeout=40) as response:
        return response.read()

html = fetch(SOURCE + '/characters/wong').decode()
bundle = re.search(r'<script[^>]+src="([^"]*application[^" ]+\.js)"', html)[1]
js = fetch(SOURCE + bundle).decode()
# Resolve only the literal asset table; never execute downloaded JavaScript.
variables = dict(re.findall(r'([\w$]+)=n\.p\+"(images/[^\"]+\.png)"', js))
table = re.search(r'cy=\{(bleed:.*?)\},dy=', js)[1]
assets = {}
for match in re.finditer(r'(?:"([^\"]+)"|([\w-]+)):(?:n\.p\+"([^\"]+)"|([\w$]+))', table):
    key, bare, literal, variable = match.groups()
    if literal or variable in variables:
        assets[key or bare] = literal or variables[variable]

strings = []
def walk(value):
    if isinstance(value, str):
        strings.append(value)
    elif isinstance(value, dict):
        for child in value.values(): walk(child)
    elif isinstance(value, list):
        for child in value: walk(child)

for path in sorted((ROOT / 'data/cards').glob('*.json')) + [ROOT / 'data/roster-cards.json']:
    walk(json.loads(path.read_text()))
tokens, annotations, characters = {}, {}, set()
for text in strings:
    for key in re.findall(r'[|&]<([^>]+)>', text):
        if key in tokens: continue
        canonical = key.replace('_', '-')
        # Two source labels omit the suffix used by the artwork table.
        asset = assets.get(canonical) or assets.get(canonical + '-double')
        tokens[key] = {'name': canonical.removesuffix('-double').replace('-', ' ').title(),
                       'src': 'assets/rule-tokens/' + key + '.png' if asset else None,
                       'source': SOURCE + '/assets/' + asset if asset else None,
                       'body': None if asset else re.sub(r'[|&]<' + re.escape(key) + r'>([^|&]+)[|&]', r'\1', text),
                       'double': canonical.endswith('-double') or canonical + '-double' in assets and canonical not in assets}
    for label, title, body in re.findall(r'\|=([^=]+)=([^=]+)=([^|]+)\|', text):
        key = hashlib.sha256((title + '\n' + body).encode()).hexdigest()[:12]
        annotations[key] = {'label': label, 'name': title, 'body': body.replace('&', '|')}
    characters.update(re.findall(r'[|&]£([^£]+)£', text))

def download(item):
    key, value = item
    if not value['src']: return
    data = fetch(value['source'])
    if not data.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('Invalid PNG: ' + key)
    (ROOT / value['src']).write_bytes(data)
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    list(pool.map(download, tokens.items()))
(ROOT / 'data/card-references.json').write_text(json.dumps({
    'source': SOURCE, 'bundle': bundle,
    'tokens': dict(sorted(tokens.items())), 'annotations': annotations,
    'characters': sorted(characters)
}, indent=2) + '\n')
print(f'Frozen {len(tokens)} tokens, {len(annotations)} annotations and {len(characters)} character links')
