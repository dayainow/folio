'use client'

/**
 * 일지 단일 에디터 — 상단 툴바 / 본문 / 하단 메타 패널
 */
import type {
  CSSProperties,
  ChangeEvent,
  KeyboardEvent,
  ReactNode,
  RefObject,
} from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ExportMenu, type ExportMenuItem } from '@/components/export-menu'
import { PresenceBar } from '@/components/presence-bar'
import { CollabTextarea } from '@/components/collab-textarea'
import { DocCommentsPanel } from '@/components/doc-comments'
import { CustomFieldsPanel } from '@/components/custom-fields-panel'
import type { CollabIdentity } from '@/hooks/use-collab-user'
import { cn } from '@/lib/utils'
import {
  Calendar,
  Save,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Tags,
} from 'lucide-react'

const VoiceInputButton = dynamic(
  () => import('@/components/voice-input-button').then((m) => ({ default: m.VoiceInputButton })),
  { ssr: false, loading: () => null },
)
const ImageAttachButton = dynamic(
  () => import('@/components/image-attach-button').then((m) => ({ default: m.ImageAttachButton })),
  { ssr: false, loading: () => null },
)

export type JournalSaveState = 'idle' | 'saving' | 'saved' | 'error'

export type JournalEditorProps = {
  writingFirst?: boolean
  date: string
  dateSwipeRef: RefObject<HTMLDivElement | null>
  onPrevDay: () => void
  onNextDay: () => void
  saveState: JournalSaveState
  saveError: string | null
  onSave: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  onImportChange: (e: ChangeEvent<HTMLInputElement>) => void
  importing: boolean
  importMsg: string | null
  exportItems: ExportMenuItem[]
  exportExtra?: ReactNode
  hasNotifyChannel: boolean
  notifyOnSave: boolean
  onNotifyOnSaveChange: (value: boolean) => void
  draft: string
  onDraftChange: (value: string) => void
  editorClassName: string
  editorStyle?: CSSProperties
  collabUser: CollabIdentity
  currentTags: string[]
  tagDraft: string
  onTagDraftChange: (e: ChangeEvent<HTMLInputElement>) => void
  onTagKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void
  onTagBlur: () => void
  onRemoveTag: (tag: string) => void
  suggestions: string[]
  allTags: string[]
  onAddTags: (tags: string[]) => void
  onTagDraftClear: () => void
}

export function JournalEditor({
  writingFirst = false,
  date,
  dateSwipeRef,
  onPrevDay,
  onNextDay,
  saveState,
  saveError,
  onSave,
  fileInputRef,
  onImportChange,
  importing,
  importMsg,
  exportItems,
  exportExtra,
  hasNotifyChannel,
  notifyOnSave,
  onNotifyOnSaveChange,
  draft,
  onDraftChange,
  editorClassName,
  editorStyle,
  collabUser,
  currentTags,
  tagDraft,
  onTagDraftChange,
  onTagKeyDown,
  onTagBlur,
  onRemoveTag,
  suggestions,
  allTags,
  onAddTags,
  onTagDraftClear,
}: JournalEditorProps) {
  return (
    <Card
      className={cn(
        'overflow-hidden rounded-2xl border border-gray-100 bg-card shadow-sm dark:border-gray-800',
        writingFirst && 'flex flex-col',
      )}
    >
      {/* ── 상단 툴바 ── */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 border-b border-gray-200/80 bg-gray-50/90 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-900/60',
          writingFirst ? 'px-3' : 'px-4',
        )}
        role="toolbar"
        aria-label="일지 에디터 도구"
      >
        <div
          ref={dateSwipeRef}
          className="flex items-center gap-2 touch-pan-y"
          title="좌우로 쓸어 날짜 이동"
        >
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onPrevDay}
            aria-label="이전 날짜"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex min-w-[7.5rem] items-center justify-center gap-2 rounded-lg px-2 py-1.5">
            <Calendar className="h-4 w-4 text-slate-400" aria-hidden />
            <span className="text-sm font-medium tabular-nums" aria-live="polite">
              {date}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNextDay}
            aria-label="다음 날짜"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md,text/markdown"
            className="hidden"
            onChange={onImportChange}
          />
          <ExportMenu label="내보내기" size="default" items={exportItems} extra={exportExtra} />
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => fileInputRef.current?.click()}
            aria-label={importing ? 'Obsidian 가져오는 중' : 'Obsidian 가져오기'}
          >
            <Upload className="h-4 w-4" aria-hidden />
            {importing ? '가져오는 중…' : 'Obsidian 가져오기'}
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={saveState === 'saving'}
            onClick={onSave}
            aria-busy={saveState === 'saving'}
            aria-label={
              saveState === 'saving'
                ? '저장 중'
                : saveState === 'saved'
                  ? '저장됨'
                  : saveState === 'error'
                    ? '저장 실패'
                    : '일지 저장'
            }
          >
            {saveState === 'saving' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> 저장 중
              </>
            ) : saveState === 'saved' ? (
              <>
                <Check className="h-4 w-4" aria-hidden /> 저장됨
              </>
            ) : saveState === 'error' ? (
              <>
                <Save className="h-4 w-4" aria-hidden /> 실패
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden /> 저장
              </>
            )}
          </Button>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        {saveState === 'saved'
          ? '일지가 저장되었습니다'
          : saveState === 'saving'
            ? '일지 저장 중'
            : saveState === 'error'
              ? '일지 저장 실패'
              : ''}
      </span>

      {saveError && (
        <div
          role="alert"
          className="mx-3 mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 sm:mx-4"
        >
          <span className="flex-1">{saveError}</span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="저장 다시 시도"
            onClick={onSave}
          >
            다시 시도
          </Button>
        </div>
      )}

      {(hasNotifyChannel || importMsg) && (
        <div className="flex flex-wrap items-center gap-3 px-3 pt-2 sm:px-4">
          {hasNotifyChannel && (
            <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] text-gray-500">
              <input
                type="checkbox"
                checked={notifyOnSave}
                onChange={(e) => onNotifyOnSaveChange(e.target.checked)}
                className="rounded border-gray-300"
              />
              저장 시 Slack/Discord 알림
            </label>
          )}
          {importMsg && <p className="text-[11px] text-gray-500">{importMsg}</p>}
        </div>
      )}

      {/* ── 본문 ── */}
      <div className={cn('bg-white dark:bg-card', writingFirst ? 'shrink-0 px-3 pt-2 sm:px-4' : 'p-4')}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <PresenceBar roomId={`journal:${date}`} tab="journal" user={collabUser} />
          <div className="flex flex-wrap items-center gap-2">
            <VoiceInputButton
              onTranscript={(text) =>
                onDraftChange(draft.trim() ? `${draft.replace(/\s*$/, '')}\n${text}` : text)
              }
            />
            <ImageAttachButton onInsert={(md) => onDraftChange(`${draft}${md}`)} />
          </div>
        </div>
        <label htmlFor="journal-draft" className="sr-only">
          일지 본문
        </label>
        <div style={editorStyle} className={cn(writingFirst && 'md:[--folio-editor-h:min(18rem,38vh)]')}>
          <CollabTextarea
            id="journal-draft"
            roomId={`journal:${date}`}
            value={draft}
            onChange={onDraftChange}
            user={collabUser}
            placeholder="오늘 한 일, 회의 내용, 이슈, 배운 것... 자유롭게 적으세요.\nMarkdown 지원: # 제목, - 리스트, **굵게**"
            className={editorClassName}
            aria-describedby="journal-draft-hint"
          />
        </div>
        <p id="journal-draft-hint" className="sr-only">
          마크다운을 사용할 수 있습니다. 저장 버튼 또는 자동 저장으로 기록됩니다. 실시간 협업(Yjs)이 활성화되어 있습니다.
        </p>
      </div>

      {/* ── 하단 메타 패널 (태그 · 주석 · 커스텀 필드) ── */}
      <div
        className={cn(
          'border-t border-gray-200/80 bg-gray-50/90 dark:border-gray-800 dark:bg-gray-900/60',
          writingFirst ? 'px-3 py-2.5 sm:px-4' : 'px-4 py-3',
        )}
        aria-label="일지 메타"
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:items-start">
          {/* 태그 */}
          <section
            className="rounded-lg border border-gray-200/80 bg-white/70 p-2.5 dark:border-gray-700 dark:bg-gray-950/50"
            aria-label="태그"
          >
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Tags className="h-3.5 w-3.5" aria-hidden />
              태그
            </div>
            <div className="mb-2 flex flex-wrap items-center gap-1.5" aria-label="현재 태그">
              {currentTags.map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="cursor-pointer text-xs hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-400 dark:hover:bg-gray-700"
                  onClick={() => onRemoveTag(tag)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${tag} 태그 제거`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onRemoveTag(tag)
                    }
                  }}
                >
                  #{tag} ×
                </Badge>
              ))}
              {currentTags.length === 0 && (
                <span className="text-xs text-gray-300">없음</span>
              )}
            </div>
            <label htmlFor="journal-tag-draft" className="sr-only">
              태그 입력
            </label>
            <Input
              id="journal-tag-draft"
              value={tagDraft}
              onChange={onTagDraftChange}
              onKeyDown={onTagKeyDown}
              onBlur={onTagBlur}
              placeholder="태그 입력 후 Enter 또는 쉼표"
              className="h-9 text-xs focus-visible:ring-2"
              aria-describedby="journal-tag-hint"
            />
            <p id="journal-tag-hint" className={writingFirst ? 'sr-only' : 'mt-1 text-[11px] text-gray-400'}>
              Enter로 추가 · 빈 입력에서 Backspace로 마지막 태그 삭제
            </p>
            {allTags.length > 0 && (!writingFirst || tagDraft.trim()) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {suggestions.length === 0 ? (
                  !writingFirst ? (
                    <span className="text-[11px] text-gray-300">추가할 태그 없음</span>
                  ) : null
                ) : (
                  suggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        onAddTags([tag])
                        onTagDraftClear()
                      }}
                      aria-label={`${tag} 태그 추가`}
                      className="min-h-11 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-900 shadow-sm transition-colors hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:focus-visible:ring-slate-100"
                    >
                      #{tag}
                    </button>
                  ))
                )}
              </div>
            )}
          </section>

          {/* 주석 */}
          <DocCommentsPanel
            targetKind="journal"
            targetId={date}
            user={collabUser}
            compact
          />

          {/* 커스텀 필드 */}
          <CustomFieldsPanel
            entity="journal"
            recordId={date}
            className="rounded-lg border border-gray-200/80 bg-white/70 p-2.5 dark:border-gray-700 dark:bg-gray-950/50"
          />
        </div>
      </div>
    </Card>
  )
}
