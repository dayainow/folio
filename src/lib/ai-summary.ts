import { JournalEntry } from '@/lib/journal';
import { DocEntry } from '@/lib/docs';
import { Task } from '@/lib/board';
import { callLlmJson, hasAiCredentials } from '@/lib/ai-llm';

export type AiSummaryType = 'journal' | 'docs' | 'board' | 'weekly' | 'all';

export interface AiSummaryRequest {
  type: AiSummaryType;
  journalEntries?: JournalEntry[];
  docEntries?: DocEntry[];
  boardCards?: Task[];
  period?: string;
}

export interface AiSummaryResponse {
  summary: string;
  highlights: string[];
  keywords: string[];
  actionItems: string[];
  source: 'ai' | 'rule-based';
  generatedAt: string;
}

/**
 * 스마트 룰 기반 폴백 요약 엔진 (Deep Rule-based Summarizer)
 * - High Priority 미완료 태스크 감지
 * - 일지 태그와 일정 태그 간 교차 분석(Core Themes)
 * - 최근 수정 문서 및 완료 속도 분석
 */
export function generateRuleBasedSummary(req: AiSummaryRequest): AiSummaryResponse {
  const generatedAt = new Date().toISOString();
  const highlights: string[] = [];
  const journalTagsSet = new Set<string>();
  const boardTagsSet = new Set<string>();
  const actionItems: string[] = [];
  const summaryLines: string[] = [];

  const journals = req.journalEntries ?? [];
  const docs = req.docEntries ?? [];
  const cards = req.boardCards ?? [];

  // 1. 일지 영역
  if (req.type === 'journal' || req.type === 'weekly' || req.type === 'all') {
    if (journals.length > 0) {
      summaryLines.push(`### 📝 일지 요약 (총 ${journals.length}건)`);
      journals.slice(0, 5).forEach((j) => {
        const firstLine = j.content.split('\n')[0]?.replace(/^#+\s*/, '') || '내용 없음';
        summaryLines.push(`- **${j.date}**: ${firstLine}`);
        (j.tags ?? []).forEach((t: string) => journalTagsSet.add(t));
      });
      highlights.push(`최근 ${journals.length}개 일지가 꾸준히 기록되었습니다.`);
    } else {
      summaryLines.push('📝 기간 내 작성된 일지 기록이 없습니다.');
    }
  }

  // 2. 문서 영역
  if (req.type === 'docs' || req.type === 'weekly' || req.type === 'all') {
    if (docs.length > 0) {
      summaryLines.push(`\n### 📚 문서 및 지식 베이스 (총 ${docs.length}건)`);
      const catCount: Record<string, number> = {};
      docs.forEach((d) => {
        catCount[d.category] = (catCount[d.category] || 0) + 1;
        if (d.category) journalTagsSet.add(d.category);
      });

      const catSummary = Object.entries(catCount)
        .map(([cat, count]) => `${cat}: ${count}개`)
        .join(', ');
      summaryLines.push(`- 카테고리 분포: ${catSummary}`);

      const recentDocs = [...docs]
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .slice(0, 3);
      summaryLines.push(`- 최근 변경 문서: ${recentDocs.map((d) => `[[${d.title}]]`).join(', ')}`);
      highlights.push(`지식 베이스에 총 ${docs.length}개의 문서가 체계적으로 분류되어 있습니다.`);
    } else {
      summaryLines.push('\n📚 문서 데이터가 없습니다.');
    }
  }

  // 3. 일정/태스크 영역
  if (req.type === 'board' || req.type === 'weekly' || req.type === 'all') {
    if (cards.length > 0) {
      const doneCards = cards.filter((c) => c.status === 'done');
      const inProgressCards = cards.filter((c) => c.status === 'in_progress');
      const reviewCards = cards.filter((c) => c.status === 'review');
      const backlogCards = cards.filter((c) => c.status === 'backlog');
      const highPriorityPending = cards.filter(
        (c) => c.priority === 'high' && c.status !== 'done'
      );

      summaryLines.push(`\n### 📋 일정 및 태스크 처리 현황 (총 ${cards.length}건)`);
      summaryLines.push(
        `- **Done**: ${doneCards.length}건 | **In Progress**: ${inProgressCards.length}건 | **Review**: ${reviewCards.length}건 | **Backlog**: ${backlogCards.length}건`
      );

      cards.forEach((c) => {
        (c.tags ?? []).forEach((t: string) => boardTagsSet.add(t));
      });

      if (doneCards.length > 0) {
        highlights.push(`이번 기간 중 성공적으로 Done 처리된 태스크가 ${doneCards.length}건 있습니다.`);
      }

      if (highPriorityPending.length > 0) {
        actionItems.push(
          `[🔥 긴급 우선순위 점검] ${highPriorityPending
            .slice(0, 3)
            .map((c) => c.title)
            .join(', ')} (High Priority)`
        );
      }
      if (reviewCards.length > 0) {
        actionItems.push(`[리뷰 대기 태스크] ${reviewCards.slice(0, 3).map((c) => c.title).join(', ')} 검토 및 머지 완료하기`);
      }
      if (inProgressCards.length > 0 && highPriorityPending.length === 0) {
        actionItems.push(`[진행 중 작업 점검] ${inProgressCards.slice(0, 3).map((c) => c.title).join(', ')} 상태 확인`);
      }
    } else {
      summaryLines.push('\n📋 보드 태스크 데이터가 없습니다.');
    }
  }

  // 4. 일지/일정 교차 분석 (Core Theme 추출)
  const crossThemes = Array.from(journalTagsSet).filter((t) => boardTagsSet.has(t));
  if (crossThemes.length > 0) {
    summaryLines.push(`\n💡 **핵심 교차 집중 주제**: #${crossThemes.join(', #')}`);
    highlights.push(`일지와 보드에서 공통적으로 활발히 다뤄진 핵심 키워드: #${crossThemes.join(', #')}`);
  }

  const mergedKeywords = Array.from(new Set([...Array.from(journalTagsSet), ...Array.from(boardTagsSet)]));

  if (actionItems.length === 0) {
    actionItems.push('새로운 목표 태스크를 계획하고 일지 기록을 시작해보세요.');
  }

  return {
    summary: summaryLines.join('\n'),
    highlights: highlights.length > 0 ? highlights : ['프로젝트 워크플로우가 안정적으로 유지되고 있습니다.'],
    keywords: mergedKeywords.slice(0, 10),
    actionItems,
    source: 'rule-based',
    generatedAt,
  };
}

/**
 * AI 요약 생성 핸들러 (멀티 프로바이더 LLM + 로컬 룰 엔진 폴백)
 */
export async function generateAiSummary(req: AiSummaryRequest): Promise<AiSummaryResponse> {
  if (!hasAiCredentials()) {
    return generateRuleBasedSummary(req);
  }

  try {
    const prompt = `당신은 Folio 워크스페이스의 수석 프로젝트 애널리스트입니다. 다음 프로젝트 데이터(일지, 문서, 칸반 보드)를 분석하여 마크다운 형태의 짧고 가독성 좋은 요약, 하이라이트(성과 1~3개), 주요 키워드(최대 5개), 다음 액션 아이템(긴급도 우선 1~3개)을 JSON 형식으로 추출해주세요.

JSON 응답 포맷:
{
  "summary": "마크다운 형식 요약 문자열 (주요 마일스톤 및 상태 요약)",
  "highlights": ["성과 1", "성과 2"],
  "keywords": ["키워드1", "키워드2"],
  "actionItems": ["할일 1", "할일 2"]
}

요청 타입: ${req.type}
기간: ${req.period || '최근'}
일지 목록(상위 10개): ${JSON.stringify((req.journalEntries || []).slice(0, 10))}
문서 목록(상위 10개): ${JSON.stringify((req.docEntries || []).slice(0, 10).map((d) => ({ title: d.title, category: d.category })))}
보드 카드 목록(상위 15개): ${JSON.stringify((req.boardCards || []).slice(0, 15).map((c) => ({ title: c.title, status: c.status, priority: c.priority, tags: c.tags })))}`;

    const result = await callLlmJson<{
      summary?: string
      highlights?: string[]
      keywords?: string[]
      actionItems?: string[]
    }>(prompt)

    if (!result) return generateRuleBasedSummary(req)

    const parsed = result.data
    return {
      summary: typeof parsed.summary === 'string' ? parsed.summary : '요약을 생성할 수 없습니다.',
      highlights: Array.isArray(parsed.highlights) ? (parsed.highlights as string[]) : [],
      keywords: Array.isArray(parsed.keywords) ? (parsed.keywords as string[]) : [],
      actionItems: Array.isArray(parsed.actionItems) ? (parsed.actionItems as string[]) : [],
      source: 'ai',
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[AI Summary] LLM 호출 실패, 심층 룰 기반 엔진으로 폴백:', err);
    return generateRuleBasedSummary(req);
  }
}
