"""Regression for vector equations clipped at the answer-label baseline."""
from pathlib import Path
import json
import pymupdf
from PIL import Image
from pdf_choice_layout import choice_top

root=Path(__file__).resolve().parents[1]
page=pymupdf.open(root/'AllMathHardQuestion.pdf')[237]
assert '17d0e87d' in page.get_text()
layout=page.get_texttrace(),page.get_bboxlog()
blocks={b[4].strip()[0]:b for b in page.get_text('blocks') if b[4].strip() in ['A.','B.','C.','D.']}
tops={k:choice_top(blocks[k],k,layout) for k in 'ABCD'}
assert tops['A']<230 and tops['B']<260 and tops['C']<288 and tops['D']<315,tops
for i,k in enumerate('ABCD'):
 bottom=tops['ABCD'[i+1]] if i<3 else 356
 image=Image.open(root/f'app/assets/17d0e87d-238-choice{k}.webp').convert('RGB')
 assert image.height==int(-(-bottom*2//1))-int(tops[k]*2//1),(k,image.size,tops[k],bottom)
 # The original PDF label is the only ink in this left margin. Equations start
 # to its right; preserving their complete height must not reintroduce labels.
 margin=image.crop((0,0,24,image.height))
 assert min(min(pixel) for pixel in margin.getdata())>235,(k,'source label remains')
assert tops['B']>250.4 and tops['C']>280 and tops['D']>306,tops
bank=json.loads((root/'app/questions.js').read_text(encoding='utf-8').removeprefix('window.QUESTIONS = ').rstrip(';\n'))
graph=next(q for q in bank if q['id']=='36f068e2')
assert len(graph['choices']['B'])==1,'The next page starts with C, not a continuation of B'
with Image.open(root/'app'/graph['choices']['C'][0]) as image:
 assert image.height>500,'Keep the complete graph above the baseline-aligned C label'
print('PASS: full radicals/fractions/exponents, no neighboring-choice ink, original A–D labels removed for question 17d0e87d.')
print('PASS: complete graph and correct page-break ownership for question 36f068e2.')
