"""Validate the shipped library against the six local College Board exports."""
import json,re
from collections import Counter
from pathlib import Path
import pymupdf
from PIL import Image

root=Path(__file__).resolve().parents[1]
questions=json.loads((root/'app/questions.js').read_text(encoding='utf-8').removeprefix('window.QUESTIONS = ').rstrip(';\n'))
by_id={q['id']:q for q in questions}
assert len(questions)==len(by_id)==3769
sources={
 'AllRWEasyQuestions.pdf':('Reading and Writing','Easy',611),
 'AllRWMediumQuestions.pdf':('Reading and Writing','Medium',624),
 'AllRWHardQuestion.pdf':('Reading and Writing','Hard',609),
 'AllMathEasyQuestions.pdf':('Math','Easy',685),
 'AllMathMediumQuestions.pdf':('Math','Medium',630),
 'AllMathHardQuestion.pdf':('Math','Hard',610),
}
all_ids=set()
for filename,(subject,difficulty,count) in sources.items():
 ids=[];current=None
 for page in pymupdf.open(root/filename):
  text=page.get_text();match=re.search(r'Question ID: (\w+)',text)
  if match:current=match[1];ids.append(current)
  q=by_id[current]
  assert q['subject']==subject and q['difficulty']==difficulty,(filename,current)
  answer=re.search(r'^Correct Answer:\s*([^\n]+)',text,re.M)
  if answer:assert q['correct']==answer[1].strip(),(filename,current,q['correct'],answer[1])
 assert len(ids)==len(set(ids))==count,(filename,len(ids))
 assert not all_ids.intersection(ids),filename
 all_ids.update(ids)
 print(filename,count,'questions validated',flush=True)
assert all_ids==set(by_id)
assets=set()
for q in questions:
 assert q['passage'] and q['explanation'],q['id']
 assert len(q['passage'])==len(q['passageText']),q['id']
 assert q['type'] in ['numeric','multiple'] and q['correct'],q['id']
 if q['type']=='multiple':assert q['correct'] in 'ABCD' and all(q['choices'][k] for k in 'ABCD'),q['id']
 assets.update(q['passage']+q['explanation']+sum(q['choices'].values(),[]))
for asset in assets:
 path=root/'app'/asset
 assert path.is_file() and path.stat().st_size>0,asset
 with Image.open(path) as image:
  assert image.width>0 and image.height>0,asset
  image.verify()
assert by_id['9ee22c16']['correct']=='3540','Thousands separator must not truncate the answer to 3'
assert by_id['a4f61d75']['correct']=='7, 8, 13','Preserve all alternative numeric answers'
assert len(by_id['e3bbf2bf']['choices']['D'])==1,'Preserve the unlabeled fourth choice'
print('PASS:',len(questions),'unique questions;',len(assets),'valid assets;',Counter(q['type'] for q in questions))
