"""Import a College Board question-bank PDF, preserving its typography and diagrams.
Usage: python tools/import_questions.py path/to/export.pdf
"""
import json, re, sys
from pathlib import Path
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'app'
ASSETS = OUT / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)
source = Path(sys.argv[1])
doc = pymupdf.open(source)
records = []
current = None
state = None
letter = None

def capture(p, blocks, name):
    if not blocks:
        return None
    rect = pymupdf.Rect(14, max(0, min(b[1] for b in blocks)-3), 598, min(p.rect.height, max(b[3] for b in blocks)+3))
    path = ASSETS / (name + '.png')
    p.get_pixmap(matrix=pymupdf.Matrix(2.5, 2.5), clip=rect).save(path)
    return 'assets/' + path.name

for pi, p in enumerate(doc):
    blocks = p.get_text('blocks')
    buckets = {}
    for b in blocks:
        t = b[4].strip()
        match = re.match(r'Question ID: (\w+)', t)
        if match:
            current = {'id': match[1], 'domain': 'Information and Ideas', 'difficulty': 'Hard', 'passage': [], 'choices': {k: [] for k in 'ABCD'}, 'explanation': [], 'source': source.name}
            records.append(current)
            state = 'metadata'
            continue
        if current is None:
            continue
        if state == 'metadata':
            if t == 'Question':
                state = 'passage'
            elif t.startswith('SAT\n'):
                values = t.splitlines()
                current.update(domain=values[2], skill=values[3], difficulty=values[4])
            continue
        if t == 'Answer':
            state = 'choices'
            continue
        if t.startswith('Correct Answer:'):
            current['correct'] = t.split(':')[-1].strip()
            state = 'explanation'
            continue
        if t == 'Rationale':
            continue
        if state == 'choices':
            m = re.match(r'([ABCD])\. ', t)
            if m:
                letter = m[1]
            key = 'choice_' + letter
        else:
            key = state
        buckets.setdefault(key, []).append(b)
    if current:
        for key, bs in buckets.items():
            asset = capture(p, bs, f"{current['id']}-{pi+1}-{key}")
            if key.startswith('choice_'):
                current['choices'][key[-1]].append(asset)
            elif key in ('passage', 'explanation'):
                current[key].append(asset)

for q in records:
    assert q.get('correct') in 'ABCD' and q['passage'] and q['explanation']
    assert all(q['choices'][k] for k in 'ABCD')
path = OUT / 'questions.js'
existing = []
if path.exists():
    existing = json.loads(path.read_text(encoding='utf-8').removeprefix('window.QUESTIONS = ').rstrip(';\n'))
merged = {q['id']: q for q in existing + records}
path.write_text('window.QUESTIONS = ' + json.dumps(list(merged.values()), ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
print(f'Imported {len(records)} questions; library total: {len(merged)}.')
