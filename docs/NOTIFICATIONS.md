# 알림 허브 · 인앱 메시지 · 이메일 · rich 푸시 (P61)

Phase 33 / P61 — Folio 알림·메시지 시스템 고도화 (v**3.5.0-wip**).

## 알림 허브

사이드바/헤더 벨 → **알림 허브** (`notification-hub.tsx`)

| 탭 | 기능 |
|----|------|
| 알림 | 읽음/안읽음 · 검색 · 그룹 필터 (저장/협업/Gate/초대/시스템) |
| 메시지 | 문서·프로젝트 채널 · 읽음 · 이모지 반응 · 검색 |
| 설정 | 이메일 · 다이제스트 · 유형별 구독 · 푸시 소리/진동 |

저장소: `folio_notification_center_v1` (그룹 필드 포함, 구 데이터 자동 정규화).

## 인앱 메시지

- `src/lib/in-app-messaging.ts`
- 키: `folio_message_channels_v1` · `folio_messages_v1`
- 채널 종류: `doc` · `project` · `general`

## 이메일

- `POST /api/email/notify`
- `RESEND_API_KEY` + `FOLIO_EMAIL_FROM` 있으면 Resend 발송
- 없으면 `.data/email-outbox/{date}.jsonl` 기록
- 일일/주간 요약: 허브 설정 · `startDigestScheduler`

## rich 푸시

- 페이로드: image · actions · group/thread · vibrate · silent
- SW (`worker/index.ts`) · `/api/push/send` 확장
- 설정에서 진동 패턴 · rich 테스트 버튼

## 관련 파일

- `src/lib/notification-center.ts` · `notification-prefs.ts` · `email-notify.ts`
- `src/lib/in-app-messaging.ts` · `push-notifications.ts`
- `src/components/notification-hub.tsx`
- `src/app/api/email/notify/route.ts`
