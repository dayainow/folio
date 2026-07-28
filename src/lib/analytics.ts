'use client';

import { loadJournalsWithFallback, type JournalEntry } from '@/lib/journal';
import { loadTasksWithFallback, type Task, DEFAULT_COLUMNS } from '@/lib/board';

export type AnalyticsRange = '1w' | '1m' | '3m' | 'all';

export interface JournalDailyPoint {
  date: string;
  count: number;
  words: number;
}

export interface TagFrequency {
  tag: string;
  count: number;
}

export interface JournalAnalytics {
  range: AnalyticsRange;
  from: string | null;
  to: string;
  totalEntries: number;
  totalWords: number;
  daily: JournalDailyPoint[];
  weekly: Array<{ week: string; count: number }>;
  monthly: Array<{ month: string; count: number }>;
  tags: TagFrequency[];
}

export interface BoardColumnStat {
  status: Task['status'];
  label: string;
  count: number;
}

export interface StatusChangePoint {
  /** YYYY-MM-DD */
  date: string;
  status: Task['status'];
  count: number;
}

export interface HeatmapCell {
  /** 0=Mon … 6=Sun */
  weekday: number;
  weekdayLabel: string;
  status: Task['status'];
  count: number;
}

export interface BoardAnalytics {
  range: AnalyticsRange;
  from: string | null;
  to: string;
  totalTasks: number;
  columns: BoardColumnStat[];
  statusChanges: StatusChangePoint[];
  heatmap: HeatmapCell[];
  /** hours; null if no completed tasks */
  avgCompletionHours: number | null;
  completedCount: number;
}

const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const BOARD_EVENTS_KEY = 'workspace_board_events';

export interface BoardStatusEvent {
  id: string;
  taskId: string;
  status: Task['status'];
  at: string;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDate(iso: string): Date {
  const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** 기간 시작일 (null = 전체) */
export function rangeStart(range: AnalyticsRange, now = new Date()): string | null {
  if (range === 'all') return null;
  const d = new Date(now);
  if (range === '1w') d.setDate(d.getDate() - 6);
  else if (range === '1m') d.setMonth(d.getMonth() - 1);
  else d.setMonth(d.getMonth() - 3);
  return toDateStr(d);
}

function inRange(dateStr: string, from: string | null, to: string): boolean {
  if (from && dateStr < from) return false;
  if (dateStr > to) return false;
  return true;
}

function wordCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function mondayWeekKey(dateStr: string): string {
  const d = parseDate(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

function weekdayIndex(dateStr: string): number {
  const d = parseDate(dateStr);
  const js = d.getDay(); // 0 Sun
  return js === 0 ? 6 : js - 1;
}

/** localStorage에 보드 상태 변경 이벤트 기록 (Board 패널에서 호출 가능) */
export function recordBoardStatusChange(taskId: string, status: Task['status'], at = new Date().toISOString()) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(BOARD_EVENTS_KEY);
    const list: BoardStatusEvent[] = raw ? JSON.parse(raw) : [];
    list.push({
      id: crypto.randomUUID(),
      taskId,
      status,
      at,
    });
    // 최근 2000건만 유지
    const trimmed = list.slice(-2000);
    localStorage.setItem(BOARD_EVENTS_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
}

export function loadBoardStatusEvents(): BoardStatusEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BOARD_EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 이벤트 없으면 태스크 updatedAt 기준 합성 */
function resolveStatusEvents(tasks: Task[]): BoardStatusEvent[] {
  const stored = loadBoardStatusEvents();
  if (stored.length > 0) return stored;
  return tasks.map(t => ({
    id: `synth-${t.id}`,
    taskId: t.id,
    status: t.status,
    at: t.updatedAt || t.createdAt,
  }));
}

export function computeJournalAnalytics(
  entries: Record<string, JournalEntry>,
  range: AnalyticsRange,
  now = new Date(),
): JournalAnalytics {
  const to = toDateStr(now);
  const from = rangeStart(range, now);
  const list = Object.values(entries).filter(e => inRange(e.date, from, to));

  const dailyMap = new Map<string, JournalDailyPoint>();
  const weeklyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const tagMap = new Map<string, number>();

  // fill empty days for 1w/1m charts
  if (from) {
    const cursor = parseDate(from);
    const end = parseDate(to);
    while (cursor <= end) {
      const key = toDateStr(cursor);
      dailyMap.set(key, { date: key, count: 0, words: 0 });
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  let totalWords = 0;
  for (const e of list) {
    const words = wordCount(e.content);
    totalWords += words;
    const prev = dailyMap.get(e.date) ?? { date: e.date, count: 0, words: 0 };
    prev.count += 1;
    prev.words += words;
    dailyMap.set(e.date, prev);

    const wk = mondayWeekKey(e.date);
    weeklyMap.set(wk, (weeklyMap.get(wk) ?? 0) + 1);
    const mk = monthKey(e.date);
    monthlyMap.set(mk, (monthlyMap.get(mk) ?? 0) + 1);

    for (const tag of e.tags ?? []) {
      const t = tag.trim();
      if (!t) continue;
      tagMap.set(t, (tagMap.get(t) ?? 0) + 1);
    }
  }

  const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  const weekly = Array.from(weeklyMap.entries())
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
  const monthly = Array.from(monthlyMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));
  const tags = Array.from(tagMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, 'ko'));

  return {
    range,
    from,
    to,
    totalEntries: list.length,
    totalWords,
    daily,
    weekly,
    monthly,
    tags,
  };
}

export function computeBoardAnalytics(
  tasks: Task[],
  range: AnalyticsRange,
  now = new Date(),
): BoardAnalytics {
  const to = toDateStr(now);
  const from = rangeStart(range, now);

  const filtered = tasks.filter(t => {
    const ref = (t.updatedAt || t.createdAt || '').slice(0, 10);
    if (!ref) return range === 'all';
    return inRange(ref, from, to);
  });

  const columns: BoardColumnStat[] = DEFAULT_COLUMNS.map(col => ({
    status: col.key,
    label: col.label,
    count: filtered.filter(t => t.status === col.key).length,
  }));

  const events = resolveStatusEvents(tasks).filter(ev => {
    const day = ev.at.slice(0, 10);
    return inRange(day, from, to);
  });

  const changeMap = new Map<string, number>();
  for (const ev of events) {
    const day = ev.at.slice(0, 10);
    const key = `${day}|${ev.status}`;
    changeMap.set(key, (changeMap.get(key) ?? 0) + 1);
  }
  const statusChanges: StatusChangePoint[] = Array.from(changeMap.entries())
    .map(([key, count]) => {
      const [date, status] = key.split('|') as [string, Task['status']];
      return { date, status, count };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const heatMap = new Map<string, number>();
  for (const ev of events) {
    const day = ev.at.slice(0, 10);
    const wd = weekdayIndex(day);
    const key = `${wd}|${ev.status}`;
    heatMap.set(key, (heatMap.get(key) ?? 0) + 1);
  }
  const heatmap: HeatmapCell[] = [];
  for (let wd = 0; wd < 7; wd++) {
    for (const col of DEFAULT_COLUMNS) {
      heatmap.push({
        weekday: wd,
        weekdayLabel: WEEKDAY_LABELS[wd],
        status: col.key,
        count: heatMap.get(`${wd}|${col.key}`) ?? 0,
      });
    }
  }

  const done = filtered.filter(t => t.status === 'done' && t.createdAt && t.updatedAt);
  let avgCompletionHours: number | null = null;
  if (done.length > 0) {
    const hours = done.map(t => {
      const start = parseDate(t.createdAt).getTime();
      const end = parseDate(t.updatedAt).getTime();
      return Math.max(0, (end - start) / (1000 * 60 * 60));
    });
    avgCompletionHours = hours.reduce((a, b) => a + b, 0) / hours.length;
  }

  return {
    range,
    from,
    to,
    totalTasks: filtered.length,
    columns,
    statusChanges,
    heatmap,
    avgCompletionHours,
    completedCount: done.length,
  };
}

/** Supabase 우선 + localStorage 폴백으로 Journal 통계 */
export async function getJournalAnalytics(range: AnalyticsRange): Promise<JournalAnalytics> {
  const entries = await loadJournalsWithFallback();
  return computeJournalAnalytics(entries, range);
}

/** Supabase 우선 + localStorage 폴백으로 Board 통계 */
export async function getBoardAnalytics(range: AnalyticsRange): Promise<BoardAnalytics> {
  const tasks = await loadTasksWithFallback();
  return computeBoardAnalytics(tasks, range);
}
