#!/bin/sh
set -eu

if [ "$#" -ne 3 ]; then echo "usage: install-backup-timer.sh SOURCE_DIR DEPLOY_ENV BACKUP_ENV" >&2; exit 2; fi
source_dir="$1"
deploy_env="$2"
backup_env="$3"

cat >/etc/systemd/system/pact-backup.service <<EOF
[Unit]
Description=PACT encrypted PostgreSQL base/WAL backup
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
WorkingDirectory=$source_dir
ExecStart=$source_dir/infra/production/bin/backup.sh $deploy_env $backup_env
User=root
UMask=0077
EOF

cat >/etc/systemd/system/pact-backup.timer <<'EOF'
[Unit]
Description=Run PACT encrypted backup every six hours

[Timer]
OnCalendar=*-*-* 00/6:17:00
Persistent=true
RandomizedDelaySec=900

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now pact-backup.timer
