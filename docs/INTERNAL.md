# Folio 내부 사용 가이드

이 문서는 Folio를 **팀/개인 내부 워크스페이스로 쓰는 경우**를 대상으로 합니다.
공식 배포용이 아니라, 우리 조직 안에서 직접 실행해 사용하는 기준을 적어둡니다.

---

## 1. 사용 전 준비

### 1.1 설치
```bash
git clone https://github.com/dayainow/folio.git
cd folio
npm install
cp docs/env.example .env.local
npm run dev
```

브라우저: `http://localhost:3000`

### 1.2 기본 사용 원칙
- **개인 업무 로그**는 일지 탭에서 매일 작성
- **공통 문서**는 문서 탭에서 카테고리별로 관리
- **프로젝트 일정**은 일정 탭 칸반으로 관리
- **프로젝트 상태**는 프로세스 탭(Beacon)에서 확인/편집

---

## 2. 데이터 소유권과 백업

- 기본 저장: 브라우저 localStorage
- 공유 필요 시 저장 모드를 **클라우드**로 전환 (Supabase)
- Beacon 사용 시 `.beacon` 폴더가 프로젝트 루트에 생성됨
- 주기적으로 **전체 내보내기**로 백업 파일 보관 권장

백업 스크립트:
```bash
npm run runbook:backup
```

---

## 3. 팀 사용 규칙

### 3.1 공유 문서
- 문서 탭에서 공유할 문서를 작성/편집
- 필요 시 팀 초대 기능으로 공유

### 3.2 일정 관리
- 일정 탭에서 태스크 생성
- 우선순위/태그 규칙 준수
- 완료 항목은 정기적으로 정리

### 3.3 일지 작성
- 매일 업무 종료 전 기록
- 태그는 소문자/공백없이 작성
- 주간 회고 시 태그 클라우드 참고

---

## 4. 운영 관리

### 4.1 모니터링
- 헤더의 **시스템 상태** 뱃지로 저장소/클라우드 연결 상태 확인
- 비정상일 경우 재연결 버튼 클릭

### 4.2 장애 발생 시
1. 브라우저 새로고침
2. 저장 모드를 로컬로 전환
3. 필요한 경우 runbook 참고: `docs/runbooks/INCIDENT.md`

### 4.3 업데이트
```bash
git pull origin main
npm install
npm run build
```

변경 내역은 `VERSION.md` 참고.

---

## 5. 문의

내부 사용 관련 문의:
- 저장소: https://github.com/dayainow/folio
- 문서: https://github.com/dayainow/folio/tree/main/docs
