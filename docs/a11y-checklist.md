# Folio 접근성 체크리스트 (P16)

수동 검증용. 브라우저 + 키보드만으로 확인한다.

## 키보드

- [ ] Tab으로 헤더 → 검색 → 탭 → 패널 주요 컨트롤 순회
- [ ] 첫 Tab에 「본문으로 건너뛰기」 스킵 링크 노출
- [ ] 주요 탭 전환 시 패널 첫 요소로 포커스 이동
- [ ] Journal 태그: Enter 추가, 빈 입력 Backspace로 마지막 태그 삭제
- [ ] Docs 목록: 포커스 후 ↑/↓로 문서 선택
- [ ] Board 카드: 포커스 후 ←/→로 컬럼 이동, 포커스 링 표시
- [ ] Board: Space/키보드 센서로 드래그(dnd-kit KeyboardSensor)

## 포커스 / 모달

- [ ] 저장 모드 드롭다운: Escape 닫기, Tab 트랩
- [ ] 팀 관리 사이드바: Escape 닫기, 포커스 트랩
- [ ] 통합 검색: Escape로 패널 닫기

## 스크린 리더

- [ ] 아이콘 버튼에 이름(aria-label) 있음
- [ ] Journal/Docs 저장 시 live region 안내
- [ ] 필수 입력(제목)에 required + 설명

## 로딩 / 에러 / 빈 상태

- [ ] 저장 중 스피너·aria-busy
- [ ] 저장 실패 시 메시지 + 「다시 시도」
- [ ] Journal/Docs/Board 빈 상태 안내 문구

## 모션

- [ ] `prefers-reduced-motion: reduce` 시 애니메이션 축소
