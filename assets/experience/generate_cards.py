"""PACT-119 seven original native SVG icons and seven bounded card templates."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'apps/web/public/experience'
paths={
'build':'M9 23h14v-9H9z M7 14l9-8 9 8 M14 23v-5h4v5',
'contact':'M5 8h22v16H5z M5 8l11 10L27 8',
'delivery':'M8 23h16l-3-5v-5a5 5 0 0 0-10 0v5z M14 27h4 M16 5v3',
'signature':'M9 6h14v10H9z M12 16v3 M8 23q8-8 16 0v3H8z',
'raid':'M16 5L3 27h26z M16 13v7 M16 23v1',
'default':'M4 9l8 5-5 5 7 4 M28 9l-8 5 5 5-7 4',
'waiting':'M9 5h14 M9 27h14 M11 5v6l10 10v6 M21 5v6L11 21v6'}
templates={
'build':{'title':'Build complete','flavour':'Pebble approves. The helmet is still under review.'},
'contact':{'title':'Contact accepted','flavour':'Moth has filed the letter and only three small anxieties.'},
'delivery':{'title':'First retained positive delivery','flavour':'Bean has counted the beans. Twice, out of professional fear.'},
'signature':{'title':'Signature recorded','flavour':'Sir Honk considers this an excellent use of stationery.'},
'raid':{'title':'Raid warning','flavour':'Sir Honk has put on the serious visor. It is the same visor.'},
'default':{'title':'Contract default','flavour':'Bean would like the numbers to reconsider. They will not.'},
'waiting':{'title':'Waiting on the world','flavour':'Moth is waiting politely, with both antennae crossed.'}}
(OUT/'icons').mkdir(exist_ok=True)
assets=[]
for kind,path in paths.items():
 p=OUT/'icons'/(kind+'.svg')
 p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><title>{templates[kind]["title"]}</title><rect x="1" y="1" width="30" height="30" rx="7" fill="#f4ebdd"/><path d="{path}" fill="none" stroke="#765531" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+chr(10))
 assets.append({'file':'icons/'+p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
p=OUT/'copy.json';copy=json.loads(p.read_text());copy['templates']=templates;p.write_text(json.dumps(copy,indent=2)+chr(10))
assets.append({'file':'copy.json#templates','count':len(templates),'sha256':hashlib.sha256(json.dumps(templates,sort_keys=True).encode()).hexdigest()})
(ROOT/'assets/experience/cards-manifest.json').write_text(json.dumps({'ticket':'PACT-119','producer':'Codex authored native SVG and original copy','regenerate':'python3 assets/experience/generate_cards.py','assets':assets},indent=2)+chr(10))
