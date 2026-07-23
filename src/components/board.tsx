'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Plus,
  Search,
  CircleDot,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { loadTasks, saveTasks, type Task, DEFAULT_COLUMNS } from '@/lib/board';

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-50 text-red-600 border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-gray-50 text-gray-600 border-gray-200',
};

export function BoardPanel() {
  const [tasks, setTasks] = useState<Task[]>(() => loadTasks());
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; description: string; priority: Task['priority']; tags: string; status: Task['status'] }>({ title: '', description: '', priority: 'medium', tags: '', status: 'backlog' });

  const refresh = () => setTasks(loadTasks());

  const persist = (t: Task[]) => {
    saveTasks(t);
    refresh();
  };

  const doSave = () => {
    if (!form.title.trim()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (editingId) {
      persist(tasks.map(t => t.id === editingId ? { ...t, title: form.title, description: form.description, priority: form.priority as Task['priority'], tags, updatedAt: new Date().toISOString() } : t));
    } else {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title: form.title,
        description: form.description,
        status: form.status,
        priority: form.priority,
        tags,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      persist([...tasks, newTask]);
    }
    setForm({ title: '', description: '', priority: 'medium', tags: '', status: 'backlog' });
    setEditingId(null);
  };

  const doEdit = (task: Task) => {
    setEditingId(task.id);
    setForm({ title: task.title, description: task.description, priority: task.priority, tags: task.tags.join(', '), status: task.status });
  };

  const doDelete = (id: string) => {
    persist(tasks.filter(t => t.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const move = (id: string, direction: 'left' | 'right') => {
    const order: Task['status'][] = ['backlog', 'in_progress', 'review', 'done'];
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const idx = order.indexOf(task.status);
    if (direction === 'left' && idx > 0) {
      persist(tasks.map(t => t.id === id ? { ...t, status: order[idx - 1], updatedAt: new Date().toISOString() } : t));
    }
    if (direction === 'right' && idx < order.length - 1) {
      persist(tasks.map(t => t.id === id ? { ...t, status: order[idx + 1], updatedAt: new Date().toISOString() } : t));
    }
  };

  const filtered = tasks.filter(t =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="태스크 검색..." className="pl-8 h-8 text-xs" />
        </div>
        <Button onClick={() => { setForm({ ...form, status: 'backlog' }); setEditingId(null); }} size="sm" className="gap-1 bg-gray-900 hover:bg-gray-800">
          <Plus className="h-3 w-3" /> 새 태스크
        </Button>
      </div>

      {/* Editor */}
      {editingId || form.title ? (
        <Card className="rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="space-y-3">
            <Input
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="태스크 제목"
              className="h-9 text-sm"
            />
            <Textarea
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="설명..."
              className="min-h-[60px] resize-none text-sm"
            />
            <div className="flex items-center gap-3">
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value as Task['priority'] })}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <Input
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                placeholder="태그 (쉼표 구분)"
                className="h-8 text-xs flex-1"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={doSave} size="sm" className="bg-gray-900 hover:bg-gray-800">저장</Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setForm({ title: '', description: '', priority: 'medium', tags: '', status: 'backlog' }); }}>취소</Button>
            </div>
          </div>
        </Card>
      ) : null}

      {/* Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {DEFAULT_COLUMNS.map(col => {
          const colTasks = filtered.filter(t => t.status === col.key);
          return (
            <div key={col.key} className={`rounded-2xl border border-gray-100 p-3 ${col.color} min-h-[400px] flex flex-col`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-700">{col.label}</span>
                  <Badge variant="secondary" className="text-xs">{colTasks.length}</Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => { setForm({ ...form, status: col.key }); setEditingId(null); }} className="h-6 w-6">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="space-y-2">
                  {colTasks.length === 0 && (
                    <div className="px-2 py-6 text-center text-xs text-gray-400">태스크 없음</div>
                  )}
                  {colTasks.map(task => (
                    <Card key={task.id} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-medium flex-1 leading-snug">{task.title}</div>
                        <div className="flex items-center gap-0.5">
                          {col.key !== 'backlog' && (
                            <Button variant="ghost" size="icon" onClick={() => move(task.id, 'left')} className="h-5 w-5">
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                          )}
                          {col.key !== 'done' && (
                            <Button variant="ghost" size="icon" onClick={() => move(task.id, 'right')} className="h-5 w-5">
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge variant="outline" className={`text-[10px] px-1 py-0 h-auto ${PRIORITY_COLORS[task.priority]}`}>
                          <CircleDot className="h-2.5 w-2.5 inline mr-0.5" />
                          {task.priority}
                        </Badge>
                        {task.tags.slice(0, 2).map(t => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1 py-0 h-auto">#{t}</Badge>
                        ))}
                      </div>
                      <Separator className="my-2" />
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => doEdit(task)} className="h-7 text-[11px]">편집</Button>
                        <Button variant="ghost" size="sm" onClick={() => doDelete(task.id)} className="h-7 text-[11px] text-red-500">삭제</Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>
    </div>
  );
}
