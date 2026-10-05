"""PACT-123 original static field overlays; stdlib SVG, no weather simulation."""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'apps/web/public/experience/scene'
assets=[]
for percent,count,color in [(100,10,'#AD7834'),(90,9,'#AD7834'),(80,8,'#A83F38')]:
 stalks=''.join(f'<path d="M{x} 72V{top}m0 10-7-6m7 0 7-6" fill="none" stroke="{color}" stroke-width="3" stroke-linecap="round"/>' for x,top in [(22+n*16,25+(n%3)*5) for n in range(count)])
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 90"><title>Public harvest {percent} percent</title><path d="M8 80h184M8 86h184" stroke="#174A4B" stroke-width="3"/>{stalks}</svg>'
 p=OUT/f'harvest-{percent}.svg';p.write_text(svg+chr(10))
 assets.append({'file':'scene/'+p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(ROOT/'assets/experience/harvest-manifest.json').write_text(json.dumps({'ticket':'PACT-123','producer':'Original Codex-authored SVG','regenerate':'python3 assets/experience/generate_harvest.py','overlays':3,'assets':assets},indent=2)+chr(10))
print(json.dumps({'overlays':3,'bytes':sum(a['bytes'] for a in assets)}))
