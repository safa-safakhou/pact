#!/bin/bash
set -euo pipefail
cd /home/mnim/repos/mine/random_idea
ssh_opts=(-o BatchMode=yes -o ConnectTimeout=10 -o ControlMaster=auto -o ControlPersist=600 -o ControlPath=/home/mnim/.ssh/pact-experience-%r@%h:%p)
remote=agentic@2.28.57.254
scp "${ssh_opts[@]}" infra/production/bin/generate-web-push-keys.mjs "$remote:/srv/pact/state/operator/generate-web-push-keys.mjs"
ssh "${ssh_opts[@]}" "$remote" 'docker run --rm -i --user 0 --network none -v /srv/pact/secrets/connection-test:/secrets --entrypoint node pact-runtime:experience-20261003-4 --input-type=module - /secrets < /srv/pact/state/operator/generate-web-push-keys.mjs >/dev/null'
ssh "${ssh_opts[@]}" "$remote" 'sudo -n python3 -' <<'PY'
from pathlib import Path
p=Path("/srv/pact/source/infra/production/vps-connection-test.env")
values={"WEB_PUSH_PUBLIC_KEY":Path("/srv/pact/secrets/connection-test/web_push_public_key").read_text().strip(),"WEB_PUSH_SUBJECT":"https://safa.dedyn.io/pact/"}
lines=[line for line in p.read_text().splitlines() if line.split("=",1)[0] not in values]
p.write_text("\n".join(lines+[k+"="+v for k,v in values.items()])+"\n")
assert len(values["WEB_PUSH_PUBLIC_KEY"]) == 87
assert Path("/srv/pact/secrets/connection-test/web_push_private_key").stat().st_mode & 0o777 == 0o600
print("VAPID pair generated; private key remains in protected worker secret.")
PY
ssh "${ssh_opts[@]}" "$remote" 'cd /srv/pact/source && sudo -n ./infra/production/bin/backup.sh infra/production/vps-connection-test.env /srv/pact/secrets/connection-test/backup.env > /srv/pact/state/operator/social-channel-backup-20261004.log 2>&1 && tail -5 /srv/pact/state/operator/social-channel-backup-20261004.log'
git ls-files -z --cached --others --exclude-standard | tar --exclude="*/__pycache__/*" --exclude="infra/production/vps-connection-test.env" --exclude="scripts/social-channel-rollout.sh" --null -T - -czf /home/mnim/pact-social-channel-20261004.tar.gz
sha256sum /home/mnim/pact-social-channel-20261004.tar.gz
scp "${ssh_opts[@]}" /home/mnim/pact-social-channel-20261004.tar.gz "$remote:/srv/pact/state/operator/pact-social-channel-20261004.tar.gz"
ssh "${ssh_opts[@]}" "$remote" 'sha256sum /srv/pact/state/operator/pact-social-channel-20261004.tar.gz && tar -xzf /srv/pact/state/operator/pact-social-channel-20261004.tar.gz -C /srv/pact/source && cd /srv/pact/source && sudo -n ./infra/production/bin/deploy.sh infra/production/vps-connection-test.env social-channel-20261004-2 > /srv/pact/state/operator/social-channel-deploy-20261004.log 2>&1 && tail -20 /srv/pact/state/operator/social-channel-deploy-20261004.log'
ssh "${ssh_opts[@]}" "$remote" 'cd /srv/pact/source && sudo -n ./infra/production/bin/verify.sh infra/production/vps-connection-test.env https://safa.dedyn.io/pact/ > /srv/pact/state/operator/social-channel-verify-20261004.log 2>&1 && cat /srv/pact/state/operator/social-channel-verify-20261004.log'
