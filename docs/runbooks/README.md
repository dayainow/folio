# Folio 운영 런북 (P22 · 0.7.0)

| 문서 | 내용 |
|------|------|
| [INCIDENT.md](./INCIDENT.md) | 장애 정의 · 로그 · 복구 · 통지 · 사후 분석 |
| [BACKUP.md](./BACKUP.md) | Supabase · Beacon · localStorage 백업/복구 |
| [DEPLOY.md](./DEPLOY.md) | Vercel/Docker 배포 · 헬스체크 · 롤백 |
| [UPGRADE.md](./UPGRADE.md) | 버전 업그레이드 · 마이그레이션 · 다운타임 최소화 |

스크립트:

```bash
npm run runbook:backup
npm run runbook:restore -- backups/folio-backup-<timestamp>
npm run runbook:deploy                 # Vercel prod
FOLIO_DEPLOY_TARGET=docker npm run runbook:deploy
```

런타임 점검: `GET /api/health` · `GET /api/runtime`
