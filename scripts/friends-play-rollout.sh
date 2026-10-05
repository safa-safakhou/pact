#!/bin/bash
set -euo pipefail
cd /home/mnim/repos/mine/random_idea
ssh_opts=(-o BatchMode=yes -o ConnectTimeout=10 -o ControlMaster=auto -o ControlPersist=600 -o ControlPath=/home/mnim/.ssh/pact-experience-%r@%h:%p)
remote=agentic@2.28.57.254
ssh "${ssh_opts[@]}" "$remote" 'cd /srv/pact/source && sudo -n ./infra/production/bin/backup.sh infra/production/vps-connection-test.env /srv/pact/secrets/connection-test/backup.env > /srv/pact/state/operator/friends-play-backup-20261004.log 2>&1 && tail -5 /srv/pact/state/operator/friends-play-backup-20261004.log'
git ls-files -z --cached --others --exclude-standard | tar --exclude="*/__pycache__/*" --exclude="infra/production/vps-connection-test.env" --exclude="scripts/friends-play-rollout.sh" --null -T - -czf /home/mnim/pact-friends-play-20261004.tar.gz
sha256sum /home/mnim/pact-friends-play-20261004.tar.gz
scp "${ssh_opts[@]}" /home/mnim/pact-friends-play-20261004.tar.gz "$remote:/srv/pact/state/operator/pact-friends-play-20261004.tar.gz"
ssh "${ssh_opts[@]}" "$remote" 'sudo -n python3 -' <<'PYREMOTE'
from pathlib import Path
p=Path("/srv/pact/source/infra/production/vps-connection-test.env")
lines=[line for line in p.read_text().splitlines() if not line.startswith("PACT_GUEST_PLAY=")]
p.write_text("\n".join(lines+["PACT_GUEST_PLAY=1"])+"\n")
print("Guest play enabled in test deployment.")
PYREMOTE
ssh "${ssh_opts[@]}" "$remote" 'sha256sum /srv/pact/state/operator/pact-friends-play-20261004.tar.gz && tar -xzf /srv/pact/state/operator/pact-friends-play-20261004.tar.gz -C /srv/pact/source && cd /srv/pact/source && sudo -n ./infra/production/bin/deploy.sh infra/production/vps-connection-test.env friends-play-20261004-3 > /srv/pact/state/operator/friends-play-deploy-20261004.log 2>&1 && tail -20 /srv/pact/state/operator/friends-play-deploy-20261004.log'
ssh "${ssh_opts[@]}" "$remote" 'cd /srv/pact/source && sudo -n ./infra/production/bin/verify.sh infra/production/vps-connection-test.env https://safa.dedyn.io/pact/ > /srv/pact/state/operator/friends-play-verify-20261004.log 2>&1 && cat /srv/pact/state/operator/friends-play-verify-20261004.log'
