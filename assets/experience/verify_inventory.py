"""Verify the frozen 58 logical exports; --write records measured metadata."""
from pathlib import Path
import argparse,json,hashlib,struct,wave,math,re,xml.etree.ElementTree as ET
R=Path(__file__).resolve().parents[2];P=R/'docs/implementation/experience-inventory.json';B=R/'apps/web/public/experience'
d=json.loads(P.read_text());assert len(d['assets'])==58
write=argparse.ArgumentParser();write.add_argument('--write',action='store_true');args=write.parse_args()
for a in d['assets']:
 file,_,part=a['file'].partition('#');p=B/file;assert p.is_file(),a['id']
 raw=p.read_bytes();assert raw,a['id'];meta={'status':'generated','bytes':len(raw)}
 if file=='copy.json':
  c=json.loads(raw);value=c['characters'] if part=='characters' else c['templates'][part]
  raw=json.dumps(value,ensure_ascii=True,sort_keys=True,separators=(',',':')).encode()
  meta['source']='assets/experience/export_characters.py' if part=='characters' else 'assets/experience/generate_cards.py'
  meta['json_pointer']='/characters' if part=='characters' else '/templates/'+part
  if part=='characters': assert sum(len(v) for v in value.values())==16 and all(len(line)<=80 for lines in value.values() for line in lines)
  else: assert set(value)=={'title','flavour'} and value['title'] and value['flavour']
 elif file=='motion.css':
  meta['source']='assets/experience/motion.css'
  meta['selector']='.experience-gag' if part=='honk' else '.experience-reveal.'+part
  assert meta['selector'] in raw.decode();meta['duration_ms']=700 if part=='honk' else 200
 elif file.startswith('characters/'):
  meta['source']='assets/experience/characters/originals/'+p.name;meta['prompt']='assets/experience/characters/prompts.json'
 elif file=='scene/parchment.png':
  meta['source']='assets/experience/proof/parchment.png';meta['prompt']='assets/experience/proof/prompts.json'
 elif file.endswith('.svg'):
  meta['source']='assets/experience/'+('generate_keepsakes.py' if file.startswith('keepsakes/') else 'generate_cards.py' if file.startswith('icons/') else 'generate_harvest.py' if p.name.startswith('harvest-') else 'generate_scene.py')
  root=ET.fromstring(raw);assert root.find('{http://www.w3.org/2000/svg}title') is not None
  box=[float(v) for v in root.attrib['viewBox'].split()];meta['dimensions']=box[2:]
 elif file.endswith('.wav'):
  meta['source']='assets/experience/generate_music.py' if p.stem in ['settlement','ambience','flourish'] else 'assets/experience/generate_effects.py'
  with wave.open(str(p),'rb') as w:
   meta.update({'duration_s':w.getnframes()/w.getframerate(),'sample_rate':w.getframerate(),'channels':w.getnchannels()})
   values=struct.unpack('<'+'h'*w.getnframes(),w.readframes(w.getnframes()))
   meta['peak_dbfs']=round(20*math.log10(max(abs(v) for v in values)/32767),4)
   assert meta['channels']==1 and meta['sample_rate']==22050 and meta['peak_dbfs']<=-3
 if file.endswith('.png'):
  assert raw[:8]==b'\x89PNG\r\n\x1a\n';meta['dimensions']=list(struct.unpack('>II',raw[16:24]));assert max(meta['dimensions'])<=256
  if file.startswith('characters/'):assert raw[25]==6
 assert (R/meta['source']).is_file(),meta['source']
 meta['source_sha256']=hashlib.sha256((R/meta['source']).read_bytes()).hexdigest()
 meta['sha256']=hashlib.sha256(raw).hexdigest()
 if args.write:a.update(meta)
 else:
  for k,v in meta.items():assert a.get(k)==v,(a['id'],k,a.get(k),v)
assert sum(1 for a in d['assets'] if a['id'].startswith('template-'))==7
assert sum(1 for a in d['assets'] if a['id'].startswith('icon-'))==7
assert sum(1 for a in d['assets'] if a['id'].startswith('keepsake-'))==3
assert sum(1 for a in d['assets'] if a['id'].startswith('harvest-'))==3
files=[p for p in B.rglob('*') if p.is_file()]
total=sum(p.stat().st_size for p in files);assert total<=8*1024*1024
if args.write:P.write_text(json.dumps(d,indent=2)+chr(10))
print(json.dumps({'logical_assets':58,'public_files':len(files),'public_bytes':total,'all_sources_and_exports_verified':True}))
