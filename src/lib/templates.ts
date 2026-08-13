/**
 * P56 — 일지/문서/보드 템플릿 (builtin + 커스텀 CRUD)
 */
'use client'

import { getLocalJson, setLocalJson, flushLocalJson } from '@/lib/local-cache'
import type { Task } from '@/lib/board'

export type TemplateKind = 'journal' | 'doc' | 'board'

export type FolioTemplate = {
  id: string
  kind: TemplateKind
  name: string
  body: string
  tags?: string[]
  /** docs */
  category?: string
  /** board */
  priority?: Task['priority']
  status?: Task['status']
  builtin?: boolean
}

const STORAGE_KEY = 'folio_templates_v1'

const BUILTIN: FolioTemplate[] = [
  {
    id: 'j-daily',
    kind: 'journal',
    name: '데일리 업무 로그',
    body: '## 오늘의 핵심 결과\n- \n\n## 진행한 일\n- [ ] 업무 / 티켓: \n  - 결과:\n  - 관련 링크:\n\n## 결정·공유 사항\n- 결정:\n- 공유 대상:\n\n## 블로커·지원 요청\n- 이슈:\n- 필요한 지원:\n\n## 내일 우선순위\n1. \n2. \n',
    tags: ['daily', 'worklog'],
    builtin: true,
  },
  {
    id: 'j-scrum',
    kind: 'journal',
    name: '데일리 스탠드업',
    body: '## 팀 목표\n- 스프린트 목표:\n\n## 어제 완료\n- 티켓 / 결과:\n\n## 오늘 계획\n- 티켓 / 예상 결과:\n\n## 블로커\n- 문제 / 영향 / 필요한 사람:\n\n## 주차장\n- 스탠드업 이후 별도 논의할 주제:\n',
    tags: ['standup', 'scrum'],
    builtin: true,
  },
  {
    id: 'j-retro',
    kind: 'journal',
    name: '회고',
    body: '## 회고 범위\n- 기간 / 프로젝트:\n- 참여자:\n- 목표 달성도:\n\n## Keep — 계속할 것\n- 관찰된 사실:\n- 효과:\n\n## Problem — 개선할 것\n- 관찰된 사실:\n- 영향:\n\n## Try — 다음에 실험할 것\n- [ ] 액션 / 담당자 / 완료일:\n\n## 팀 건강도\n- 에너지(1–5):\n- 예측 가능성(1–5):\n- 협업(1–5):\n',
    tags: ['retro'],
    builtin: true,
  },
  {
    id: 'j-bug',
    kind: 'journal',
    name: '장애 대응 로그',
    body: '## 현재 상태\n- 심각도: SEV-\n- 상태: 조사 중 / 완화 / 해결\n- 담당자(Incident Commander):\n- 영향 범위:\n\n## 타임라인\n- HH:MM — 최초 감지:\n- HH:MM — 대응:\n- HH:MM — 완화/복구:\n\n## 관찰·가설\n- 지표 / 로그:\n- 가설:\n- 검증 결과:\n\n## 커뮤니케이션\n- 공지 채널:\n- 다음 업데이트 시각:\n\n## 후속 조치\n- [ ] 조치 / 담당자 / 기한:\n',
    tags: ['incident', 'ops'],
    builtin: true,
  },
  {
    id: 'j-one-on-one',
    kind: 'journal',
    name: '1:1 미팅',
    body: '## 체크인\n- 컨디션 / 에너지:\n- 최근 가장 좋았던 점:\n\n## 지난 액션 확인\n- [ ] \n\n## 논의할 주제\n- 업무·우선순위:\n- 협업·피드백:\n- 성장·커리어:\n\n## 매니저 지원 요청\n- \n\n## 합의한 액션\n- [ ] 액션 / 담당자 / 기한:\n',
    tags: ['one-on-one', 'people'],
    builtin: true,
  },
  {
    id: 'd-req',
    kind: 'doc',
    name: '제품 요구사항(PRD)',
    body: '# 제품 요구사항(PRD)\n\n> 상태: 초안 | 검토 중 | 승인\n> 오너: @이름 · 리뷰어: @이름 · 목표 출시일: YYYY-MM-DD\n\n## 1. 배경과 문제\n- 사용자/비즈니스 문제:\n- 근거 데이터·고객 피드백:\n- 지금 해결해야 하는 이유:\n\n## 2. 목표와 성공 지표\n- 목표:\n- 핵심 지표(현재 → 목표):\n- 가드레일 지표:\n\n## 3. 사용자와 시나리오\n- 주요 사용자:\n- 핵심 사용자 여정:\n\n## 4. 요구사항\n### Must\n- [ ] REQ-001:\n### Should\n- [ ] REQ-002:\n### Could\n- [ ] REQ-003:\n\n## 5. 범위 제외\n- \n\n## 6. 수용 기준\n- [ ] Given / When / Then:\n\n## 7. 출시·측정 계획\n- 단계적 배포:\n- 대시보드/이벤트:\n- 롤백 기준:\n\n## 8. 리스크·의존성·오픈 질문\n- 리스크 / 대응:\n- 의존 팀·시스템:\n- [ ] 오픈 질문 / 오너 / 기한:\n',
    category: 'Product',
    tags: ['prd', 'requirements'],
    builtin: true,
  },
  {
    id: 'd-design',
    kind: 'doc',
    name: '기술 설계서(RFC)',
    body: '# 기술 설계서(RFC)\n\n> 상태: 제안 | 검토 중 | 승인 | 폐기\n> 작성자: @이름 · 리뷰어: @이름 · 최종 결정일: YYYY-MM-DD\n\n## 요약\n- 제안하는 변경과 기대 효과를 3줄 이내로 작성\n\n## 배경·문제 정의\n- 현재 구조:\n- 문제와 제약:\n\n## 목표 / 비목표\n### 목표\n- \n### 비목표\n- \n\n## 제안 설계\n### 아키텍처·데이터 흐름\n```mermaid\nflowchart LR\n  A[Client] --> B[Service]\n```\n### 데이터 모델\n- 스키마 변경·마이그레이션:\n### API·인터페이스\n- 요청/응답·에러 계약:\n### 보안·권한\n- 인증·인가·민감정보:\n\n## 대안 비교\n| 대안 | 장점 | 단점 | 선택 여부 |\n|---|---|---|---|\n| A | | | |\n\n## 운영 계획\n- 관측성(로그·지표·알림):\n- 성능·용량 추정:\n- 단계적 배포·Feature Flag:\n- 롤백·복구 절차:\n\n## 테스트 계획\n- [ ] 단위 / 통합 / E2E / 부하 / 보안\n\n## 리스크·오픈 질문\n- [ ] 항목 / 오너 / 기한:\n',
    category: 'Engineering',
    tags: ['rfc', 'design'],
    builtin: true,
  },
  {
    id: 'd-minutes',
    kind: 'doc',
    name: '회의록',
    body: '# 회의록\n\n> 일시: YYYY-MM-DD HH:MM · 진행자: @이름 · 기록자: @이름\n> 참석자: @이름 · 불참/공유 대상: @이름\n\n## 회의 목적\n- 이번 회의에서 반드시 얻을 결과:\n\n## 사전 자료\n- [링크명](URL)\n\n## 안건\n1. 안건 / 오너 / 예상 시간\n\n## 논의 내용\n### 안건 1\n- 사실·데이터:\n- 쟁점:\n- 결론:\n\n## 의사결정\n| 결정 | 이유 | 결정자 | 날짜 |\n|---|---|---|---|\n| | | | |\n\n## 액션 아이템\n- [ ] 할 일 / 담당자 / 기한 / 관련 티켓:\n\n## 주차장·다음 회의\n- 다음에 논의할 항목:\n- 다음 회의:\n',
    category: 'Meeting',
    tags: ['meeting'],
    builtin: true,
  },
  {
    id: 'd-retro',
    kind: 'doc',
    name: '스프린트 회고',
    body: '# 스프린트 회고\n\n> 스프린트: · 기간: · 참여자:\n\n## 목표·결과\n- 스프린트 목표:\n- 완료 / 이월 / 취소:\n- 주요 지표:\n\n## 잘된 점\n- 사실 → 효과:\n\n## 개선할 점\n- 사실 → 영향:\n\n## 배운 점·운이 좋았던 점\n- \n\n## 다음 스프린트 실험\n- [ ] 액션 / 오너 / 완료 조건 / 기한:\n\n## 이전 액션 점검\n- [ ] 완료 여부 / 결과:\n',
    category: 'Meeting',
    tags: ['retro'],
    builtin: true,
  },
  {
    id: 'd-adr',
    kind: 'doc',
    name: '기술 의사결정(ADR)',
    body: '# ADR-000: 결정 제목\n\n> 상태: 제안 | 승인 | 폐기 | 대체됨\n> 결정일: YYYY-MM-DD · 결정자: @이름 · 대체 ADR: [[문서명]]\n\n## 맥락\n- 어떤 문제와 제약 때문에 결정이 필요한가?\n\n## 결정 동인\n- 비용 / 속도 / 안정성 / 보안 / 운영성:\n\n## 검토한 대안\n### 대안 A\n- 장점:\n- 단점:\n### 대안 B\n- 장점:\n- 단점:\n\n## 결정\n- 선택:\n- 이유:\n\n## 결과와 트레이드오프\n- 긍정적 결과:\n- 감수한 단점·부채:\n\n## 후속 작업\n- [ ] 작업 / 오너 / 기한:\n',
    category: 'Decision',
    tags: ['adr', 'decision'],
    builtin: true,
  },
  {
    id: 'd-incident-postmortem',
    kind: 'doc',
    name: '장애 포스트모템',
    body: '# 장애 포스트모템\n\n> Blameless: 개인이 아닌 시스템과 조건을 분석합니다.\n> 심각도: SEV- · 발생: · 복구: · 작성자: · 승인자:\n\n## 요약\n- 무엇이 발생했고 어떻게 복구했는가?\n\n## 고객·비즈니스 영향\n- 영향 사용자 / 기능 / 지역:\n- 지속 시간:\n- SLA/SLO 영향:\n\n## 탐지\n- 최초 탐지 수단·시각:\n- 탐지가 늦었다면 이유:\n\n## 타임라인\n| 시각 | 이벤트·조치 | 담당 |\n|---|---|---|\n| HH:MM | | |\n\n## 근본 원인과 기여 요인\n- 직접 원인:\n- 5 Whys:\n- 기여 요인:\n\n## 대응 평가\n### 잘된 점\n- \n### 개선할 점\n- \n### 운이 좋았던 점\n- \n\n## 재발 방지 액션\n| 우선순위 | 액션 | 오너 | 기한 | 티켓 | 완료 조건 |\n|---|---|---|---|---|---|\n| P0 | | | | | |\n\n## 학습·공유\n- 런북/알림/교육 업데이트:\n',
    category: 'Incident',
    tags: ['incident', 'postmortem'],
    builtin: true,
  },
  {
    id: 'd-kickoff',
    kind: 'doc',
    name: '프로젝트 킥오프',
    body: '# 프로젝트 킥오프\n\n> 프로젝트 오너: · 스폰서: · 기간: · 상태: 제안/진행/종료\n\n## 왜 하는가\n- 문제·기회:\n- 기대 효과:\n\n## 목표·성공 기준\n- Objective:\n- Key Results / KPI:\n\n## 범위\n### 포함\n- \n### 제외\n- \n\n## 팀·역할(RACI)\n| 업무 | Responsible | Accountable | Consulted | Informed |\n|---|---|---|---|---|\n| | | | | |\n\n## 마일스톤\n| 마일스톤 | 오너 | 목표일 | 완료 조건 |\n|---|---|---|---|\n| | | | |\n\n## 의사소통 방식\n- 단일 정보원:\n- 정기 회의·채널:\n- 상태 보고 주기:\n\n## 리스크·의존성\n- 리스크 / 확률 / 영향 / 대응 / 오너:\n\n## 킥오프 액션\n- [ ] 액션 / 담당자 / 기한:\n',
    category: 'Project',
    tags: ['kickoff', 'project'],
    builtin: true,
  },
  {
    id: 'd-weekly-status',
    kind: 'doc',
    name: '주간 상태보고',
    body: '# 주간 상태보고\n\n> 기간: YYYY-MM-DD ~ YYYY-MM-DD · 오너: · 전체 상태: 🟢/🟡/🔴\n\n## 한 줄 요약\n- \n\n## 이번 주 성과\n- 완료 결과 / 근거 링크:\n\n## 핵심 지표\n| 지표 | 이전 | 현재 | 목표 | 상태 |\n|---|---:|---:|---:|---|\n| | | | | |\n\n## 다음 주 우선순위\n1. 결과 / 오너 / 목표일\n\n## 리스크·블로커·의사결정 요청\n| 구분 | 내용 | 영향 | 필요한 결정/지원 | 오너 |\n|---|---|---|---|---|\n| | | | | |\n\n## 변경 사항\n- 범위 / 일정 / 인력 변경:\n',
    category: 'Report',
    tags: ['weekly', 'status'],
    builtin: true,
  },
  {
    id: 'd-runbook',
    kind: 'doc',
    name: '운영 런북',
    body: '# 운영 런북\n\n> 서비스: · 오너 팀: · 최종 검증일: · 검토 주기:\n\n## 목적·적용 범위\n- 이 런북을 실행하는 상황:\n- 실행하면 안 되는 상황:\n\n## 사전 조건\n- 필요한 권한·도구:\n- 확인할 대시보드·로그:\n\n## 실행 절차\n1. [ ] 명령/작업\n   - 예상 결과:\n   - 실패 시:\n\n## 검증\n- [ ] 고객 영향 해소 확인\n- [ ] 핵심 지표 정상화\n- [ ] 데이터 정합성 확인\n\n## 롤백·복구\n1. \n\n## 에스컬레이션\n- 1차 담당 / 채널 / 연락 조건:\n- 2차 담당 / 채널 / 연락 조건:\n\n## 변경 이력\n| 날짜 | 변경 | 작성자 | 검토자 |\n|---|---|---|---|\n| | | | |\n',
    category: 'Operations',
    tags: ['runbook', 'operations'],
    builtin: true,
  },
  {
    id: 'b-bug',
    kind: 'board',
    name: '버그 티켓',
    body: '## 현상\n- 사용자에게 보이는 문제:\n\n## 환경\n- 배포 버전 / OS / 브라우저 / 계정:\n\n## 재현 절차\n1. \n\n## 기대 결과 / 실제 결과\n- 기대:\n- 실제:\n\n## 영향·심각도\n- 영향 사용자 / 빈도 / 우회 방법:\n\n## 근거\n- 로그 / 스크린샷 / Sentry / 관련 PR:\n\n## 완료 조건\n- [ ] 회귀 테스트 추가\n- [ ] 영향 범위 검증\n- [ ] 릴리즈 노트/공지 필요 여부 확인',
    tags: ['bug', 'triage'],
    priority: 'high',
    status: 'backlog',
    builtin: true,
  },
  {
    id: 'b-feature',
    kind: 'board',
    name: '기능',
    body: '## 사용자 스토리\n- [사용자]로서 [목표]를 위해 [기능]이 필요하다.\n\n## 배경·가치\n- 문제 / 근거 / 기대 효과:\n\n## 범위 / 비범위\n- 포함:\n- 제외:\n\n## 수용 기준\n- [ ] Given / When / Then\n\n## 디자인·기술 링크\n- Figma / PRD / RFC:\n\n## 계측·출시\n- 이벤트 / 성공 지표 / Feature Flag / 롤백 기준:\n\n## Definition of Done\n- [ ] 구현·리뷰·테스트·문서·관측성 완료',
    tags: ['feature', 'story'],
    priority: 'medium',
    status: 'backlog',
    builtin: true,
  },
  {
    id: 'b-improve',
    kind: 'board',
    name: '개선',
    body: '## 현재 상태\n- 관찰한 문제와 기준 지표:\n\n## 개선 가설\n- [변경]하면 [지표]가 [목표]만큼 개선될 것이다.\n\n## 실행안\n- 범위 / 오너 / 예상 공수:\n\n## 측정 계획\n- 기준선 / 목표 / 측정 기간 / 가드레일:\n\n## 완료 조건\n- [ ] 변경 전후 데이터 비교\n- [ ] 결과와 다음 결정 문서화',
    tags: ['improvement', 'experiment'],
    priority: 'medium',
    status: 'backlog',
    builtin: true,
  },
  {
    id: 'b-task',
    kind: 'board',
    name: '태스크',
    body: '## 목적\n- 이 작업으로 만드는 결과:\n\n## 작업 내용\n- [ ] \n\n## 완료 조건\n- [ ] 결과물 링크\n- [ ] 리뷰/검증 완료\n\n## 의존성·블로커\n- \n\n## 참고 링크\n- ',
    tags: ['task'],
    priority: 'medium',
    status: 'backlog',
    builtin: true,
  },
]

function loadCustom(): FolioTemplate[] {
  const raw = getLocalJson<FolioTemplate[]>(STORAGE_KEY, [])
  return Array.isArray(raw) ? raw.filter((t) => t && !t.builtin) : []
}

function saveCustom(list: FolioTemplate[]) {
  setLocalJson(STORAGE_KEY, list)
  flushLocalJson(STORAGE_KEY)
}

export function listTemplates(kind?: TemplateKind): FolioTemplate[] {
  const all = [...BUILTIN, ...loadCustom()]
  return kind ? all.filter((t) => t.kind === kind) : all
}

export function getTemplate(id: string): FolioTemplate | undefined {
  return listTemplates().find((t) => t.id === id)
}

export function upsertTemplate(
  input: Omit<FolioTemplate, 'builtin'> & { builtin?: boolean },
): FolioTemplate {
  if (input.builtin || BUILTIN.some((b) => b.id === input.id)) {
    throw new Error('builtin templates are read-only')
  }
  const custom = loadCustom()
  const next: FolioTemplate = { ...input, builtin: false }
  const idx = custom.findIndex((t) => t.id === next.id)
  if (idx >= 0) custom[idx] = next
  else custom.push(next)
  saveCustom(custom)
  return next
}

export function createTemplate(
  partial: Omit<FolioTemplate, 'id' | 'builtin'> & { id?: string },
): FolioTemplate {
  const id = partial.id ?? `custom-${crypto.randomUUID().slice(0, 8)}`
  return upsertTemplate({ ...partial, id, builtin: false })
}

export function deleteTemplate(id: string): boolean {
  if (BUILTIN.some((b) => b.id === id)) return false
  const custom = loadCustom()
  const next = custom.filter((t) => t.id !== id)
  if (next.length === custom.length) return false
  saveCustom(next)
  return true
}

export function resetCustomTemplates() {
  saveCustom([])
}
