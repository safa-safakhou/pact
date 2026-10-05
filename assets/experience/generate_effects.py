"""PACT-118 seven original procedural cues, stdlib only.
Run python3 assets/experience/generate_effects.py; no recordings or speech.
"""
from pathlib import Path
import math,random,wave,struct,hashlib,json
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'apps/web/public/experience/audio';RATE=22050;SEED=11820261003
durations={'build':1.2,'paper':0.7,'seal':0.5,'delivery':1.2,'raid':1.4,'default':0.9,'honk':0.8}
captions={'build':'A tiny construction clack followed by a wobbly two-note trumpet.',
'paper':'A brief flutter of paper.','seal':'A small seal presses firmly onto a document.',
'delivery':'A clear little bell marks a recorded delivery.','raid':'Three low warning drum taps. Read the actual threat record.',
'default':'A short plucked cord drops in pitch. Read the recorded default.',
'honk':'HONK. The goose has filed a noise complaint.'}
assets=[]
for index,(name,duration) in enumerate(durations.items()):
 rng=random.Random(SEED+index);pcm=[];low=0.0
 for n in range(round(duration*RATE)):
  t=n/RATE;noise=rng.uniform(-1,1);low=low*0.84+noise*0.16
  if name=='build':
   clack=noise*math.exp(-t*65)*0.4
   phase=max(0,t-0.15);freq=220 if phase<0.35 else 293.6648
   horn=(math.sin(2*math.pi*freq*phase+0.07*math.sin(2*math.pi*5*phase))+0.22*math.sin(4*math.pi*freq*phase))*min(1,phase/0.03)*max(0,1-phase/0.95)*0.2 if t>=0.15 else 0
   value=clack+horn
  elif name=='paper':
   value=low*sum(math.exp(-((t-center)/0.045)**2) for center in [0.1,0.28,0.46])*0.7
  elif name=='seal':
   value=(math.sin(2*math.pi*75*t)*0.45+low*0.25)*math.exp(-t*14)
  elif name=='delivery':
   value=(math.sin(2*math.pi*659.255*t)+0.35*math.sin(2*math.pi*1321*t))*math.exp(-t*4)*0.3
  elif name=='raid':
   value=0
   for start in [0.04,0.44,0.84]:
    if t>=start:
     p=t-start;value+=(math.sin(2*math.pi*(65*p-10*p*p))*0.5+low*0.25)*math.exp(-p*13)
  elif name=='default':
   value=(math.sin(2*math.pi*(180*t-70*t*t))+0.2*math.sin(2*math.pi*360*t))*math.exp(-t*6)*0.3
  else:
   phase=2*math.pi*(180*t+25*t*t+2*math.sin(2*math.pi*5*t))
   value=(math.sin(phase)+0.45*math.sin(phase*2)+0.25*math.sin(phase*3))*math.sin(math.pi*t/duration)**2*0.2
  value*=min(1,t/0.01,max(0,(duration-t)/0.04))
  pcm.append(value)
 assert all(math.isfinite(x) for x in pcm)
 maximum=max(abs(x) for x in pcm);peak=0.25 if name=='honk' else 0.32
 samples=[round(x/maximum*peak*32767) for x in pcm]
 samples[0]=samples[-1]=0
 path=OUT/(name+'.wav')
 with wave.open(str(path),'wb') as out:
  out.setnchannels(1);out.setsampwidth(2);out.setframerate(RATE);out.writeframes(struct.pack('<'+'h'*len(samples),*samples))
 assets.append({'file':'audio/'+path.name,'duration_s':len(samples)/RATE,'sample_rate':RATE,'channels':1,'seed':SEED+index,'normalization_gain':peak/maximum,'peak_dbfs':round(20*math.log10(max(abs(x) for x in samples)/32767),4),'finite_samples':True,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'caption':captions[name]})
 (OUT/(name+'.vtt')).write_text('WEBVTT'+chr(10)*2+'00:00.000 --> 00:02.000'+chr(10)+captions[name]+chr(10))
manifest={'ticket':'PACT-118','producer':'Original authored DSP, Python stdlib; no speech/recordings',
 'regenerate':'python3 assets/experience/generate_effects.py','assets':assets,'audition':'Founder listened on 3 October: "Seems like clean, but I have to be able to listen to them in its place in the game to understand exactly what it does mean." Cleanliness accepted; contextual meaning remains for PACT-119.',
 'mapping':'PACT-119 owns factual triggers; no tick/denial cues in this asset ticket.'}
(ROOT/'assets/experience/effects-manifest.json').write_text(json.dumps(manifest,indent=2)+chr(10))
sections=''.join(f'<section><h2>{name}</h2><p>{captions[name]}</p><audio controls preload="metadata" src="{name}.wav"><track kind="captions" src="{name}.vtt" srclang="en" label="English sound description" default></audio></section>' for name in durations)
(OUT/'effects-preview.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PACT seven original cues</title><style>body{background:#f4ebdd;color:#202a30;font:18px system-ui;max-width:700px;margin:auto;padding:20px}audio{width:100%}section{margin:24px 0}</style><h1>Seven original cosmetic sound cues</h1><p>Press play to audition. No sound starts automatically. Warnings always retain readable source facts in the game.</p>'+sections+'</html>')
print(json.dumps({'assets':assets}))
