#!/usr/bin/env python3
import io, json, pathlib, datetime as dt
import requests
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

ROOT=pathlib.Path(__file__).resolve().parents[1]
REG=ROOT/'data/event-factory/events.json'
OUT=ROOT/'data/event-factory/social-creatives.json'
ORIGIN='https://trendpilotchoice.com'
FONT='/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REG='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'

def pick(e, role):
    for x in e.get('images',[]):
        if x.get('role')==role and x.get('url'): return x
    return (e.get('images') or [{}])[0]

def fetch_image(url):
    r=requests.get(url,headers={'User-Agent':'TrendPilotCreativeBot/1.0'},timeout=35)
    r.raise_for_status()
    return Image.open(io.BytesIO(r.content)).convert('RGB')

def cover(img, w=1000, h=1500):
    scale=max(w/img.width,h/img.height)
    nw,nh=int(img.width*scale),int(img.height*scale)
    img=img.resize((nw,nh),Image.Resampling.LANCZOS)
    left=(nw-w)//2; top=(nh-h)//2
    return img.crop((left,top,left+w,top+h))

def font(path,size):
    try:return ImageFont.truetype(path,size)
    except:return ImageFont.load_default()

def fit_lines(draw,text,f,max_width,max_lines=4):
    words=text.split(); lines=[]; line=''
    for w in words:
        test=(line+' '+w).strip()
        if draw.textbbox((0,0),test,font=f)[2] <= max_width:
            line=test
        else:
            if line: lines.append(line)
            line=w
    if line: lines.append(line)
    if len(lines)>max_lines:
        lines=lines[:max_lines]
        while draw.textbbox((0,0),lines[-1]+'…',font=f)[2] > max_width and len(lines[-1])>4:
            lines[-1]=lines[-1][:-1]
        lines[-1]+='…'
    return lines

def make_pin(e, title, src_img, out):
    bg=cover(src_img)
    bg=ImageEnhance.Contrast(bg).enhance(1.05)
    overlay=Image.new('RGBA',bg.size,(0,0,0,0))
    od=ImageDraw.Draw(overlay)
    for y in range(0,520):
        a=int(180*(1-y/520))
        od.rectangle((0,y,1000,y+1),fill=(0,0,0,max(0,a)))
    for y in range(860,1500):
        a=int(220*((y-860)/640))
        od.rectangle((0,y,1000,y+1),fill=(0,0,0,min(220,a)))
    canvas=Image.alpha_composite(bg.convert('RGBA'),overlay)
    d=ImageDraw.Draw(canvas)
    f_brand=font(FONT,36); f_title=font(FONT,70); f_meta=font(FONT_REG,34); f_cta=font(FONT,34)
    d.text((64,72),'TrendPilot',font=f_brand,fill='white')
    lines=fit_lines(d,title,f_title,860,4)
    y=960
    for line in lines:
        d.text((64,y),line,font=f_title,fill='white',stroke_width=1,stroke_fill=(0,0,0))
        y+=86
    meta=f"{e.get('date')} · {e.get('city')} · {e.get('venue')}"
    d.text((64,1325),meta,font=f_meta,fill=(225,235,245))
    d.rounded_rectangle((64,1383,530,1460),radius=24,fill=(255,255,255,235))
    d.text((92,1403),'Tickets + travel guide',font=f_cta,fill=(12,27,45))
    canvas.convert('RGB').save(out,'JPEG',quality=86,optimize=True,progressive=True)

def main():
    reg=json.loads(REG.read_text(encoding='utf-8'))
    rows=[]
    for e in reg.get('events',[]):
        if e.get('status')!='ready': continue
        dist_path=ROOT/'events'/e['slug']/'distribution.json'
        pack=json.loads(dist_path.read_text(encoding='utf-8')) if dist_path.exists() else {}
        pins=pack.get('pinterest') or []
        if not pins:
            pins=[
                {'title':f"{e.get('event_name')}: tickets + match-weekend guide"},
                {'title':f"How to plan a trip for {e.get('event_name')}"},
                {'title':f"{e.get('venue')} matchday: what to book first"},
            ]
        outdir=ROOT/'events'/e['slug']/'social'
        outdir.mkdir(parents=True,exist_ok=True)
        sources=[pick(e,'hero'),pick(e,'hero'),pick(e,'venue')]
        made=[]
        for i in range(3):
            out=outdir/f'pin-{i+1}.jpg'
            if not out.exists():
                src=sources[i] if i < len(sources) else sources[0]
                img=fetch_image(src.get('url'))
                make_pin(e,pins[i].get('title') if i<len(pins) else e['event_name'],img,out)
            made.append({
                'role':f'pin-{i+1}',
                'path':str(out.relative_to(ROOT)),
                'url':f'https://trendpilotchoice.com/events/{e["slug"]}/social/pin-{i+1}.jpg',
                'title':pins[i].get('title') if i<len(pins) else e['event_name']
            })
        rows.append({'event':e['slug'],'assets':made})
    result={'generated_at':dt.datetime.now(dt.timezone.utc).isoformat(),'version':1,'events':rows,'asset_count':sum(len(x['assets']) for x in rows)}
    OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__':
    main()
