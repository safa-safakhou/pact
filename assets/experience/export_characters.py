"""PACT-115 mechanical export of approved originals. Requires Pillow12.3.
Run python assets/experience/export_characters.py. No creative edits/crops.
Exact original prompts/references are preserved; imagegen reruns need not match.
"""
from pathlib import Path
from PIL import Image
import json,hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'apps/web/public/experience/characters'
entries=json.loads((ROOT/'assets/experience/characters/prompts.json').read_text())
lines=json.loads((ROOT/'apps/web/public/experience/copy.json').read_text())['characters']
assert len(entries)==12 and len({e['name'] for e in entries})==12
assert set(lines)=={'honk','pebble','moth','bean'}
assert all(len(items)==4 and all(len(line)<=80 for line in items) for items in lines.values())
OUT.mkdir(parents=True,exist_ok=True)
assets=[]
cards=[]
for entry in entries:
 source=ROOT/entry['source']
 image=Image.open(source)
 assert image.mode=='RGBA'
 original_size=image.size
 image.thumbnail((256,256),Image.Resampling.LANCZOS)
 assert max(image.size)<=256 and min(image.getchannel('A').getextrema())==0
 target=OUT/(entry['name']+'.png')
 image.save(target,optimize=True)
 histogram=image.getchannel('A').histogram()
 assert histogram[0]/(image.width*image.height)>0.15
 assets.append({'file':'characters/'+target.name,'dimensions':list(image.size),'original_dimensions':list(original_size),
  'source':entry['source'],'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
  'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),
  'alpha_range':list(image.getchannel('A').getextrema()),'transparent_fraction':round(histogram[0]/(image.width*image.height),4)})
 name=entry['name'];kind=name.split('-')[0]
 cards.append(f'<article><h2>{name}</h2><p class="fact">Synthetic status example: refresh current records.</p><div class="flavour"><img src="{target.name}" alt="{name} cosmetic portrait" width="{image.width}" height="{image.height}"/><p>{lines[kind][0]}</p></div></article>')
manifest={'ticket':'PACT-115','producer':'Built-in imagegen originals, Pillow12.3 geometry/encoding export',
 'regenerate_export':'python assets/experience/export_characters.py','poses':12,'lines':16,
 'prompts':'assets/experience/characters/prompts.json','authority':'Cosmetic only: no accounts, agents, actions, contracts or inference.',
 'assets':assets}
(ROOT/'assets/experience/characters-manifest.json').write_text(json.dumps(manifest,indent=2)+chr(10))
html='''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PACT court portrait review</title><style>body{font:16px system-ui;background:#f4ebdd;color:#202a30;margin:20px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}article{border:1px solid #ad7834;padding:12px}img{display:block;max-width:100%;height:auto;margin:auto;background:repeating-conic-gradient(#fff 0 25%,#ddd 0 50%) 0/12px 12px}h2{font-size:18px}body.quiet .flavour{display:none}@media(max-width:600px){.grid{grid-template-columns:1fr}}label{display:block;padding:12px}</style><h1>Twelve original cosmetic portraits</h1><p>Review only. These characters never act as game participants.</p><label><input type="checkbox" id="humour" checked>Show humour and portraits</label><div class="grid">'''+''.join(cards)+'''</div><script>document.getElementById("humour").addEventListener("change",e=>document.body.classList.toggle("quiet",!e.target.checked));</script></html>'''
(OUT/'preview.html').write_text(html)
print(json.dumps({'poses':len(assets),'lines':16,'export_bytes':sum(a['bytes'] for a in assets),'checks':'RGBA, transparent margins, <=256px, <=80chars'}))
