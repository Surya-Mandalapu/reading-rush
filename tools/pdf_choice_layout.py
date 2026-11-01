"""Locate complete answer rows, including non-text PDF math and diagrams."""
import re

def trim_choice_width(image):
    """Remove unused page-width whitespace so short equations stay readable."""
    ink=image.convert('L').point(lambda value:255 if value<235 else 0).getbbox()
    return image.crop((0,0,min(image.width,ink[2]+8),image.height)) if ink else image

def choice_top(block,letter,layout):
    """Use paint order to include drawings above the choice's text label."""
    traces,paint=layout
    def content(span):return ''.join(chr(c[0]) for c in span['chars']).strip()
    starts=[s['seqno'] for s in traces if content(s).startswith(letter+'.') and s['bbox'][0]<32 and block[1]<=s['bbox'][1]<=block[3]]
    if not starts:return block[1]-3
    first=min(starts)
    following=[s['seqno'] for s in traces if s['seqno']>first and s['bbox'][0]<32 and (re.match(r'^[ABCD]\.\s',content(s)+' ') or content(s).startswith('Correct Answer:') or content(s)=='Rationale')]
    last=min(following,default=len(paint))
    ink=[bbox for kind,bbox in paint[first:last] if kind!='ignore-text']
    return min([block[1]]+[bbox[1] for bbox in ink])-2
