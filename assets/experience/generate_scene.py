"""PACT-114 original native vector scene. Run python3 assets/experience/generate_scene.py.
Texture is an approved imagegen original, mechanically resized as documented separately.
"""
from pathlib import Path
import hashlib,json
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'apps/web/public/experience/scene'
OUT.mkdir(parents=True,exist_ok=True)
ink='#202A30';teal='#174A4B';brass='#AD7834';clay='#A83F38';paper='#F4EBDD'
def svg(body,title):
 return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 140"><title>{title}</title><g stroke="{ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>'
def rect(x,y,w,h,fill=paper):return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2" fill="{fill}"/>'
def roof(x,y,w,h):return f'<path d="M{x} {y+h} L{x+w/2} {y} L{x+w} {y+h} Z" fill="{teal}"/>'
def line(x,y,xx,yy):return f'<path d="M{x} {y} L{xx} {yy}" fill="none"/>'
def house(x,y,w,h):
 return rect(x,y+18,w,h)+roof(x-4,y-5,w+8,26)+rect(x+w*0.42,y+h-6,w*0.18,24,brass)
b={}
b['hall-1']=house(40,42,100,65)+rect(66,70,12,16,teal)+rect(102,70,12,16,teal)+line(90,13,90,33)+f'<path d="M90 13h35l-8 10H90" fill="{clay}"/>'
b['farm-1']=house(60,53,78,52)+f'<path d="M18 122h36m-30-10v10m10-18v18m10-12v12" fill="none" stroke="{brass}"/>'
b['farm-2']=house(30,45,100,60)+rect(140,62,22,60,brass)+roof(136,42,30,22)+f'<path d="M12 125h110m-94-16v16m14-24v24m14-16v16m14-24v24m14-16v16" fill="none" stroke="{brass}"/>'
b['mine-1']=f'<path d="M18 125 35 63 75 25 104 59 138 48 165 125Z" fill="{brass}"/><path d="M61 125V91a25 25 0 0 1 50 0v34Z" fill="{ink}"/>'+line(54,78,118,78)+rect(120,109,33,16,teal)
b['mine-2']=f'<path d="M12 125 24 49 60 18 103 52 139 27 168 125Z" fill="{brass}"/><path d="M56 125V82a29 29 0 0 1 58 0v43Z" fill="{ink}"/>'+rect(47,68,77,12,teal)+rect(129,89,32,36,paper)+line(66,126,145,135)+line(104,126,165,135)+line(24,28,151,28)+line(35,25,35,71)+line(143,26,143,57)
b['market-1']=rect(30,97,120,24,brass)+line(36,49,36,121)+line(144,49,144,121)+f'<path d="M18 68 34 42h112l16 26Z" fill="{teal}"/><path d="M20 68h140v14H20Z" fill="{clay}"/><circle cx="54" cy="94" r="9" fill="{paper}"/><circle cx="75" cy="94" r="9" fill="{paper}"/>'
b['storehouse-1']=house(29,39,122,69)+rect(65,79,50,43,brass)+line(65,80,115,122)+line(115,80,65,122)+rect(134,101,28,27,teal)
b['barracks-1']=house(29,53,110,50)+rect(39,72,17,23,teal)+rect(65,72,17,23,teal)+f'<path d="M139 76q14 8 25 0v23q-4 14-12 19-13-10-13-19Z" fill="{clay}"/>'+line(151,81,151,110)
b['wall-1']=rect(21,71,140,54,brass)+''.join(rect(x,57,18,22,brass) for x in [21,51,81,111,141])+f'<path d="M72 125V101a18 18 0 0 1 36 0v24Z" fill="{ink}"/>'
for name,body in b.items():
 (OUT/(name+'.svg')).write_text(svg(body+f'<path d="M12 130h156" stroke="{brass}"/>',name.replace('-',' '))+chr(10))
(OUT/'banner.svg').write_text(svg(f'<path d="M45 17h90v91l-45 23-45-23Z" fill="{teal}"/><path d="M65 45h50M90 32v45" stroke="{brass}"/><path d="M32 17h116" stroke="{brass}"/>','Settlement cloth banner')+chr(10))
assets=[]
for p in sorted([OUT/(name+".svg") for name in b]+[OUT/"banner.svg",OUT/"parchment.png"]):
 if p.suffix in ['.svg','.png']:assets.append({'file':'scene/'+p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
manifest={'ticket':'PACT-114','producer':'Original Codex-authored SVG; approved imagegen parchment export',
 'regenerate':'python3 assets/experience/generate_scene.py',
 'building_states':9,'texture':1,'banner':1,
 'texture_source':'assets/experience/proof/parchment.png',
 'texture_source_sha256':hashlib.sha256((ROOT/'assets/experience/proof/parchment.png').read_bytes()).hexdigest(),
 'texture_export':'Pillow12.3 PNG RGB resized256x256 LANCZOS; geometry/encoding export only, no creative edits',
 'assets':assets}
(ROOT/'assets/experience/scene-manifest.json').write_text(json.dumps(manifest,indent=2)+chr(10))
print(json.dumps({'building_states':len(b),'assets':len(assets),'bytes':sum(a['bytes'] for a in assets)}))
