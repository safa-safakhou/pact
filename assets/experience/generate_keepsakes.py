"""PACT-122 exactly three original SVG keepsakes; no entitlements."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[2];O=R/'apps/web/public/experience/keepsakes';O.mkdir(exist_ok=True)
paths={'build':'M34 62V28m12 34V24m12 38V28 M34 42l-9-9m9 2 9-9 M46 38l-9-9m9 2 9-9 M58 42l-9-9m9 2 9-9',
'contact':'M25 25h54v38H25z M25 25l27 23 27-23',
'delivery':'M32 60h40L65 46V35a13 13 0 0 0-26 0v11z M47 69h10 M52 16v6'}
assets=[]
for kind,path in paths.items():
 p=O/(kind+'.svg');p.write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 112 88"><title>{kind} keepsake</title><rect x="4" y="4" width="104" height="80" rx="12" fill="#ead9b8" stroke="#765531" stroke-width="3"/><path d="{path}" fill="none" stroke="#765531" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 14h6m72 0h6M14 74h6m72 0h6" stroke="#ba9144" stroke-width="3"/></svg>'+chr(10))
 assets.append({'file':'keepsakes/'+p.name,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(R/'assets/experience/keepsakes-manifest.json').write_text(json.dumps({'ticket':'PACT-122','producer':'Codex authored native SVG','regenerate':'python3 assets/experience/generate_keepsakes.py','assets':assets},indent=2)+chr(10))
