#!/bin/bash
set -euo pipefail
ssh -o BatchMode=yes -o ControlPath=/home/mnim/.ssh/pact-experience-%r@%h:%p agentic@2.28.57.254 'cd /srv/pact/source && sudo -n python3 -' <<'PY'
from pathlib import Path
import json,subprocess
root=Path('/srv/pact/secrets/connection-test')
keys=['telegram_bot_id','telegram_bot_token','telegram_webhook_secret','web_push_private_key','web_push_public_key']
result={"date":"2026-10-04","release":"social-channel-20261004-2","configured":{k:bool((root/k).read_text().strip()) for k in keys},"services":{}}
compose=['docker','compose','--env-file','infra/production/vps-connection-test.env','-f','infra/production/compose.yaml']
for name in ['api','rules','seals','inference','notification','channel','gateway']:
 cid=subprocess.check_output(compose+['ps','-q',name],text=True).strip()
 info=json.loads(subprocess.check_output(['docker','inspect',cid],text=True))[0]
 result['services'][name]={"state":info['State']['Status'],"restarts":info['RestartCount']}
 if name=='inference':
  result['inferenceConfiguration']=[e for e in info['Config']['Env'] if e.startswith('RUN_INFERENCE_ENABLED=') or e.startswith('PACT_ENABLE_LIVE_MODEL_CALLS=')]
assert all(x['state']=='running' and x['restarts']==0 for x in result['services'].values())
Path('/srv/pact/state/operator/social-channel-server-20261004.json').write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps(result))
PY
