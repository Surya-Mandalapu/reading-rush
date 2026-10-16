"""Import College Board exports with visual math and a selectable text layer."""
import json, re, sys, os
from pathlib import Path
from collections import Counter
import pymupdf
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'app'
ASSETS=OUT/'assets'
ASSETS.mkdir(parents=True,exist_ok=True)
path=OUT/'questions.js'
existing=json.loads(path.read_text(encoding='utf-8').removeprefix('window.QUESTIONS = ').rstrip(';\n')) if path.exists() else []
merged={q['id']:q for q in existing}
def text(p,x1,x2,y2):
    return ' '.join(p.get_text(clip=pymupdf.Rect(x1,79,x2,y2)).split()).replace('propor tional','proportional')
def capture(p,y1,y2,name,selectable=False):
    rect=pymupdf.Rect(14,max(0,y1),p.rect.width-14,min(p.rect.height,y2))
    if rect.height<1:return None,[]
    target=ASSETS/(name+'.webp')
    if not os.environ.get('READING_RUSH_IMPORT_CACHE') or not target.exists():p.get_pixmap(matrix=pymupdf.Matrix(2,2),clip=rect).pil_save(str(target),format='WEBP',quality=92)
    words=[]
    if selectable:
        for w in p.get_text('words',clip=rect):
            words.append({'text':w[4],'x':(w[0]-rect.x0)/rect.width*100,'y':(w[1]-rect.y0)/rect.height*100,'w':(w[2]-w[0])/rect.width*100,'h':(w[3]-w[1])/rect.height*100,'font':(w[3]-w[1])/rect.width*80})
    return 'assets/'+target.name,words
for arg in sys.argv[1:]:
    source=Path(arg);doc=pymupdf.open(source);current=None;state=None;letter=None;imported=[]
    for pi,p in enumerate(doc):
        blocks=p.get_text('blocks');ids=[b for b in blocks if re.match(r'Question ID: (\w+)',b[4])]
        assert len(ids)<=1,f'Multiple questions on page {pi+1}'
        markers=[]
        if ids:
            ident=re.search(r'Question ID: (\w+)',ids[0][4])[1]
            question=next(b for b in blocks if b[4].strip()=='Question')
            current={'id':ident,'subject':text(p,133,248,question[1]-3),'domain':text(p,248,363,question[1]-3),'skill':text(p,363,478,question[1]-3),'difficulty':text(p,478,596,question[1]-3),'passage':[],'passageText':[],'choices':{k:[] for k in 'ABCD'},'explanation':[],'source':source.name}
            imported.append(current);state='passage';start=question[3]+3;current['_text']=''
        else:start=16
        assert current is not None
        current['_text']+=p.get_text()
        for b in blocks:
            t=b[4].strip()
            if b[1]<start:continue
            if t=='Answer':markers.append((b[1]-3,b[3]+3,'choices',None))
            elif t.startswith('Correct Answer:'):
                current['correct']=t.split(':',1)[1].strip()
                current['type']='multiple' if current['correct'] in ['A','B','C','D'] else 'numeric'
                markers.append((b[1]-4,b[3]+3,'between',None))
            elif t=='Rationale':markers.append((b[1]-3,b[3]+3,'explanation',None))
            elif re.match(r'^[ABCD]\.\s',b[4]) and (state=='choice' or state=='choices' or any(m[2]=='choices' for m in markers)):
                markers.append((b[1]-3,b[1]-3,'choice',t[0]))
        markers.sort()
        def add(end):
            if state not in ('passage','choice','explanation'):return
            asset,words=capture(p,start,end,f'{current["id"]}-{pi+1}-{state}{letter or ""}',state=='passage')
            if not asset:return
            if state=='choice':current['choices'][letter].append(asset)
            else:
                current[state].append(asset)
                if state=='passage':current['passageText'].append(words)
        for end,next_start,newstate,newletter in markers:
            add(end);state,start=newstate,next_start
            if newletter:letter=newletter
        content_bottom=max([b[3] for b in blocks]+[r['bbox'][3] for r in p.get_image_info()]+[16])
        add(min(p.rect.height-15,content_bottom+12))
        if (pi+1)%100==0:print(f'{source.name}: {pi+1}/{len(doc)} pages',flush=True)
    for q in imported:
        if not q.get('correct'):
            rationale=q['_text'].split('Rationale',1)[-1]
            choice=re.search(r'Choice ([ABCD]) is (?:the best answer|correct)',rationale)
            examples=re.search(r'Note that (.{1,180}?) are examples',rationale,re.S)
            numeric=re.search(r'The correct answer is (?:either )?(-?(?:\d*\.)?\d+(?:/\d+)?)(?: or (-?(?:\d*\.)?\d+(?:/\d+)?))?',rationale)
            if choice:q['correct']=choice[1]
            elif examples:q['correct']=', '.join(re.findall(r'-?(?:\d*\.)?\d+(?:/\d+)?',examples[1]))
            elif numeric:q['correct']=', '.join(x for x in numeric.groups() if x)
            q['type']='multiple' if q.get('correct') in ['A','B','C','D'] else 'numeric'
            q['answerSource']='Official rationale (export has no answer header)'
        del q['_text']
        assert q.get('correct') and q['passage'] and q['explanation'],q
        assert q.get('skill') and q.get('domain') and q.get('subject') in ['Reading and Writing','Math'],q
        assert q['type']=='numeric' or all(q['choices'][k] for k in 'ABCD'),q['id']
        merged[q['id']]=q
    print(f'{source.name}: imported {len(imported)} questions; {Counter(q["type"] for q in imported)}',flush=True)
path.write_text('window.QUESTIONS = '+json.dumps(list(merged.values()),ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print(f'Total: {len(merged)} unique questions. Subjects: {Counter(q.get("subject") for q in merged.values())}',flush=True)
