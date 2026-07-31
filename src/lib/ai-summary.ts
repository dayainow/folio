import { JournalEntry } from '@/lib/journal';
import { DocEntry } from '@/lib/docs';
import { Task } from '@/lib/board';

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
 * 룰 기반 폴백 요약 엔진 (Local Rule-based Summarizer)
 */
export function generateRuleBasedSummary(req: AiSummaryRequest): AiSummaryResponse {
  const generatedAt = new Date().toISOString();
  const highlights: string[] = [];
  const keywordsSet = new Set<string>();
  const actionItems: string[] = [];
  const summaryLines: string[] = [];

  const journals = req.journalEntries ?? [];
  const docs = req.docEntries ?? [];
  const cards = req.boardCards ?? [];

  if (req.type === 'journal' || req.type === 'weekly' || req.type === 'all') {
    if (journals.length > 0) {
      summaryLines.push(`### 📝 일지 요약 (총 ${journals.length}건)`);
      journals.slice(0, 5).forEach((j) => {
        const firstLine = j.content.split('\n')[0]?.replace(/^#+\s*/, '') || '내용 없음';
        summaryLines.push(`- **${j.date}**: ${firstLine}`);
        (j.tags ?? []).forEach((t) => keywordsSet.add(t));
      });
      highlights.push(`최근 ${journals.length}개 일지 작성됨`);
    } else {
      summaryLines.push('📝 일지 기록이 없습니다.');
    }
  }

  if (req.type === 'docs' || req.type === 'weekly' || req.type === 'all') {
    if (docs.length > 0) {
      summaryLines.push(`\n### 📚 문서 현황 (총 ${docs.length}건)`);
      const catCount: Record<string, number> = {};
      docs.forEach((d) => {
        catCount[d.category] = (catCount[d.category] || 0) + 1;
        if (d.category) keywordsSet.add(d.category);
      });

      const catSummary = Object.entries(catCount)
        .map(([cat, count]) => `${cat}: ${count}개`)
        .join(', ');
      summaryLines.push(`- 카테고리별 문서 분포: ${catSummary}`);

      const recentDocs = [...docs]
        .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
        .slice(0, 3);
      summaryLines.push(`- 최근 수정된 문서: ${recentDocs.map((d) => `[[${d.title}]]`).join(', ')}`);
      highlights.push(`총 ${docs.length}개 문서가 카테고리별로 관리 중입니다.`);
    } else {
      summaryLines.push('\n📚 문서 데이터가 없습니다.');
    }
  }

  if (req.type === 'board' || req.type === 'weekly' || req.type === 'all') {
    if (cards.length > 0) {
      const doneCards = cards.filter((c) => c.status === 'done');
      const inProgressCards = cards.filter((c) => c.status === 'in_progress');
      const reviewCards = cards.filter((c) => c.status === 'review');
      const backlogCards = cards.filter((c) => c.status === 'backlog');

      summaryLines.push(`\n### 📋 보드 태스크 현황 (총 ${cards.length}건)`);
      summaryLines.push(
        `- **Done**: ${doneCards.length}건 | **In Progress**: ${inProgressCards.length}건 | **Review**: ${reviewCards.length}건 | **Backlog**: ${backlogCards.length}건`
      );

      cards.forEach((c) => {
        (c.tags ?? []).forEach((t: string) => keywordsSet.add(t));
      });

      if (doneCards.length > 0) {
        highlights.push(`성공적으로 완료된 태스크: ${doneCards.length}개`);
      }
      if (inProgressCards.length > 0) {
        actionItems.push(`[진행 중 태스크 점검] ${inProgressCards.slice(0, 3).map((c) => c.title).join(', ')}`);
      }
      if (reviewCards.length > 0) {
        actionItems.push(`[리뷰 대기] ${reviewCards.slice(0, 3).map((c) => c.title).join(', ')} 검토`);
      }
    } else {
      summaryLines.push('\n📋 보드 태스크 데이터가 없습니다.');
    }
  }

  if (actionItems.length === 0) {
    actionItems.push('새로운 일지 및 태스크를 추가하여 프로젝트 기록을 최신 상태로 유지하세요.');
  }

  return {
    summary: summaryLines.join('\n'),
    highlights: highlights.length > 0 ? highlights : ['프로젝트 기록이 잘 유지되고 있습니다.'],
    keywords: Array.from(keywordsSet).slice(0, 10),
    actionItems,
    source: 'rule-based',
    generatedAt,
  };
}

/**
 * AI 요약 생성 핸들러 (LLM 호출 + 룰 기반 폴백)
 */
export async function generateAiSummary(req: AiSummaryRequest): Promise<AiSummaryResponse> {
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    // API 키가 없으면 룰 기반 엔진 실행
    return generateRuleBasedSummary(req);
  }

  try {
    const prompt = `다음 프로젝트 데이터를 분석하여 마크다운 형태의 짧고 명확한 요약, 하이라이트(성과 1-3개), 주요 키워드(최대 5개), 다음 액션 아이템(1-3개)을 JSON 형식으로 추출해줘.

JSON 응답 포맷:
{
  "summary": "마크다운 형식 요약 문자열",
  "highlights": ["성과 1", "성과 2"],
  "keywords": ["키워드1", "키워드2"],
  "actionItems": ["할일 1", "할일 2"]
}

요청 타입: ${req.type}
기간: ${req.period || '최근'}
일지 목록: ${JSON.stringify((req.journalEntries || []).slice(0, 10))}
문서 목록: ${JSON.stringify((req.docEntries || []).slice(0, 10).map((d) => ({ title: d.title, category: d.category })))}
보드 카드 목록: ${JSON.stringify((req.boardCards || []).slice(0, 15).map((c) => ({ title: c.title, status: c.status, tags: c.tags })))}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`Gemini API error: ${res.status}`);
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) throw new Error('Empty AI response');

    const parsed = JSON.parse(rawText);

    return {
      summary: parsed.summary || '요약을 생성할 수 없습니다.',
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
      source: 'ai',
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[AI Summary] Gemini API call failed, falling back to rule-based summary:', err);
    return generateRuleBasedSummary(req);
  }
}
