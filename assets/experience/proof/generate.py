"""PACT-110 deterministic audio/motion proof. Raster images come from built-in imagegen."""
import math, wave, struct, json, hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parent
RATE=22050
samples=[]
for n in range(RATE*2):
    t=n/RATE
    note=(220,277.1826,329.6276,220)[min(3,int(t*2))]
    phase=t%0.5
    env=min(1,phase/0.025)*max(0,min(1,(0.5-phase)/0.12))
    value=0.25*env*(math.sin(2*math.pi*note*t)+0.24*math.sin(4*math.pi*note*t))
    samples.append(round(value*32767))
with wave.open(str(ROOT/'proof.wav'),'wb') as out:
    out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE)
    out.writeframes(struct.pack('<'+'h'*len(samples),*samples))
css='@keyframes proof-reveal {\n  from {\n    opacity: 0;\n    transform: translateY(4px);\n  }\n  to {\n    opacity: 1;\n    transform: translateY(0);\n  }\n}\n.reveal {\n  animation: proof-reveal 200ms ease-out;\n}\n@media (prefers-reduced-motion: reduce) {\n  .reveal {\n    animation: none;\n  }\n}\n'
(ROOT/'proof.css').write_text(css)
manifest={'version':1,'audio':{'duration_s':2,'sample_rate':RATE,'peak_dbfs':20*math.log10(max(abs(x) for x in samples)/32767),'seed':'deterministic score','producer':'Python stdlib composition'},'motion':{'duration_ms':200,'producer':'authored CSS'},'assets':[]}
for name in ('honk.png','parchment.png','proof.wav','proof.css'):
    f=ROOT/name
    manifest['assets'].append({'file':name,'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(ROOT/'manifest.json').write_text(json.dumps(manifest,indent=2)+chr(10))
print(json.dumps(manifest))
