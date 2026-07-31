'use client';

import { useState } from 'react';
import { Sparkles, Bot, Cpu, Copy, Check, RefreshCw, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadJournals } from '@/lib/journal';
import { loadDocs } from '@/lib/docs';
import { loadTasks } from '@/lib/board';
import { AiSummaryResponse, generateRuleBasedSummary, AiSummaryType } from '@/lib/ai-summary';
import { cn } from '@/lib/utils';

export type AiSummaryWidgetProps = {
  type?: AiSummaryType;
  className?: string;
  compact?: boolean;
};

export function AiSummaryWidget({ type = 'all', className, compact = false }: AiSummaryWidgetProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<AiSummaryResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [sentSlack, setSentSlack] = useState(false);
  const [expanded, setExpanded] = useState(!compact);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const journalEntries = Object.values(loadJournals());
      const docEntries = loadDocs();
      const boardCards = loadTasks();

      const reqData = {
        type,
        journalEntries,
        docEntries,
        boardCards,
        period: new Date().toLocaleDateString('ko-KR'),
      };

      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqData),
      });

      if (res.ok) {
        const data: AiSummaryResponse = await res.json();
        setSummary(data);
      } else {
        const fallbackData = generateRuleBasedSummary(reqData);
        setSummary(fallbackData);
      }
    } catch (err) {
      console.error('AI 요약 요청 중 오류 발생, 로컬 엔진 실행:', err);
      const journalEntries = Object.values(loadJournals());
      const docEntries = loadDocs();
      const boardCards = loadTasks();
      setSummary(
        generateRuleBasedSummary({
          type,
          journalEntries,
          docEntries,
          boardCards,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendSlack = async () => {
    if (!summary) return;
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `[Folio 요약 리포트] ${summary.generatedAt.slice(0, 10)}`,
          body: summary.summary,
          channels: ['slack'],
        }),
      });
      if (res.ok) {
        setSentSlack(true);
        setTimeout(() => setSentSlack(false), 2000);
      }
    } catch (err) {
      console.error('Slack 알림 전송 오류:', err);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    const textToCopy = `# Folio 요약 리포트 (${summary.generatedAt.slice(0, 10)})
${summary.summary}

### 🎯 핵심 성과
${summary.highlights.map((h) => `- ${h}`).join('\n')}

### 🚀 다음 액션 아이템
${summary.actionItems.map((a) => `- ${a}`).join('\n')}
`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('rounded-lg border bg-card p-4 text-card-foreground shadow-sm', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-none">AI & 규칙 요약</h3>
            <p className="text-xs text-muted-foreground mt-0.5">프로젝트 일지·문서·일정 자동 요약</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={handleGenerate}
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {loading ? '요약 중...' : '요약 생성'}
          </Button>
          {compact && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {expanded && summary && (
        <div className="mt-4 space-y-3 border-t pt-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-medium text-[11px]">
              {summary.source === 'ai' ? (
                <>
                  <Bot className="h-3 w-3 text-purple-500" /> AI 요약 (Gemini)
                </>
              ) : (
                <>
                  <Cpu className="h-3 w-3 text-blue-500" /> 로컬 룰 엔진
                </>
              )}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px] px-2" onClick={handleSendSlack}>
                <Send className="h-3 w-3 text-emerald-500" />
                {sentSlack ? '전송됨' : 'Slack 전송'}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 gap-1 text-[11px] px-2" onClick={handleCopy}>
                {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                {copied ? '복사됨' : '복사'}
              </Button>
            </div>
          </div>

          <div className="whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 font-mono text-[11px] leading-relaxed">
            {summary.summary}
          </div>

          {summary.highlights.length > 0 && (
            <div>
              <span className="font-semibold text-muted-foreground block mb-1">🎯 주요 성과</span>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {summary.highlights.map((h, i) => (
                  <li key={i} className="truncate">{h}</li>
                ))}
              </ul>
            </div>
          )}

          {summary.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {summary.keywords.map((kw, i) => (
                <span key={i} className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-600 dark:text-purple-300">
                  #{kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
