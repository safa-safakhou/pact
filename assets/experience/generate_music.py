"""Original PACT-117 score and synthesis; Python stdlib only.
Run: python3 assets/experience/generate_music.py
30s settlement, 15s wind/cloth, 2s flourish. No external recordings.
"""
import math, wave, struct, random, hashlib, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'apps/web/public/experience/audio'
OUT.mkdir(parents=True,exist_ok=True)
RATE=22050
SEED=11720261003
TAU=2*math.pi
SCORE={
 'settlement':{'title':'The Kingdom Is Probably Fine','tempo_bpm':96,
  'bars':12,'meter':4,'melody_midi':[
   [64,67,69,67],[62,64,67,64],[60,64,67,72],[59,62,67,62],
   [64,67,71,69],[62,67,69,67],[60,64,67,64],[59,62,65,62],
   [64,67,69,72],[62,64,67,69],[60,64,67,64],[59,62,67,59]],
  'bass_midi':[48,50,48,43,48,50,48,43,48,50,48,43]},
 'ambience':{'title':'Wind in a Very Small Banner','seed':SEED,'fade_s':0.35},
 'flourish':{'title':'A Historically Significant Turnip','notes_midi':[60,64,67,72],'beat_s':0.4}
}
def hz(midi): return 440*2**((midi-69)/12)
def note(samples,start,duration,midi,gain,voice):
 frequency=hz(midi)
 for n in range(int(duration*RATE)):
  i=int(start*RATE)+n
  if i>=len(samples): break
  t=n/RATE
  envelope=min(1,t/0.012)*min(1,max(0,(duration-t)/0.06))*math.exp(-t*(3 if voice=='pluck' else 1))
  if voice=='pluck':
   tone=math.sin(TAU*frequency*t)+0.28*math.sin(TAU*frequency*2*t)+0.08*math.sin(TAU*frequency*3*t)
  else: tone=math.sin(TAU*frequency*t)+0.12*math.sin(TAU*frequency*2*t)
  samples[i]+=gain*envelope*tone
def render(name,samples,fade):
 # Explicit fade guarantees silent endpoints; loops use a quiet breathing join.
 for n in range(len(samples)):
  samples[n]*=min(1,n/(fade*RATE),(len(samples)-1-n)/(fade*RATE))
 peak=max(abs(x) for x in samples)
 gain=min(1,0.45/peak) if peak else 1
 pcm=[round(x*gain*32767) for x in samples]
 assert all(-32768<=x<=32767 for x in pcm)
 assert pcm[0]==pcm[-1]==0
 path=OUT/(name+'.wav')
 with wave.open(str(path),'wb') as f:
  f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE)
  f.writeframes(struct.pack('<'+'h'*len(pcm),*pcm))
 return {'file':'audio/'+path.name,'duration_s':len(pcm)/RATE,'sample_rate':RATE,
  'channels':1,'peak_dbfs':round(20*math.log10(max(abs(x) for x in pcm)/32767),4),
  'finite_samples':all(math.isfinite(x) for x in samples),'fade_s':fade,
  'join_delta_pcm':abs(pcm[-1]-pcm[0]),
  'max_adjacent_delta_pcm':max(abs(a-b) for a,b in zip(pcm,pcm[1:])),
  'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
music=[0.0]*(30*RATE)
beat=60/96
for bar,melody in enumerate(SCORE['settlement']['melody_midi']):
 for step,midi in enumerate(melody): note(music,(bar*4+step)*beat,beat*0.85,midi,0.14,'pluck')
 for step in (0,2): note(music,(bar*4+step)*beat,beat*1.8,SCORE['settlement']['bass_midi'][bar],0.085,'bass')
ambient=[0.0]*(15*RATE)
rng=random.Random(SEED);filtered=0.0;cloth=0.0
for n in range(len(ambient)):
 t=n/RATE
 filtered=filtered*0.998+rng.uniform(-1,1)*0.002
 cloth=cloth*0.92+rng.uniform(-1,1)*0.08
 gust=0.65+0.25*math.sin(TAU*t/15)+0.1*math.sin(TAU*t/5)
 ambient[n]=filtered*gust*0.8+cloth*0.008*(0.5+0.5*math.sin(TAU*t/3))
flourish=[0.0]*(2*RATE)
for n,midi in enumerate(SCORE['flourish']['notes_midi']):note(flourish,n*0.4,0.65,midi,0.22,'pluck')
manifest={'ticket':'PACT-117','producer':'Original authored score, Python stdlib additive/noise synthesis',
 'seed':SEED,'production_pass':1,'maximum_refinements':2,
 'regenerate':'python3 assets/experience/generate_music.py',
 'loop_join':'Music 60ms and ambience 350ms explicit fades to zero; a quiet breathing join, not a seamless sustained pad.',
 'audition':'Founder contextual audition reply 3 October: I think it should be okay. Tentative acceptance; not an enjoyment guarantee.',
 'score':SCORE,'assets':[render('settlement',music,0.06),render('ambience',ambient,0.35),render('flourish',flourish,0.06)]}
(ROOT/'assets/experience/music-manifest.json').write_text(json.dumps(manifest,indent=2)+chr(10))
print(json.dumps({'assets':manifest['assets']}))
