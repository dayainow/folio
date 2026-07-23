'use client';

export interface DocEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'workspace_docs';

const DEFAULT_CATEGORIES = [
  'Dev Guide',
  'API',
  'Policy',
  'Design',
  'Deploy',
  'Meeting',
];

export function loadDocs(): DocEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaults();
  } catch {
    return getDefaults();
  }
}

function getDefaults(): DocEntry[] {
  return [
    {
      id: crypto.randomUUID(),
      title: '프로젝트 규칙',
      content: '# 프로젝트 규칙\n\n- 모든 이슈는 Jira에 생성한다\n- 코드 리뷰는 24시간 내에\n- 데일리 스탠드업 10시\n- PR은 최대 300줄',
      category: 'Policy',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: crypto.randomUUID(),
      title: 'API 명세',
      content: '# API 명세\n\nBase URL: `https://api.example.com/v1`\n\n## 인증\n`Authorization: Bearer <token>`\n\n## 엔드포인트\n- GET /users\n- GET /projects/:id\n- POST /tasks',
      category: 'API',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function saveDoc(doc: DocEntry) {
  if (typeof window === 'undefined') return;
  const all = loadDocs();
  const idx = all.findIndex(d => d.id === doc.id);
  if (idx >= 0) {
    all[idx] = { ...doc, updatedAt: new Date().toISOString() };
  } else {
    all.push({ ...doc, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteDoc(id: string) {
  if (typeof window === 'undefined') return;
  const all = loadDocs().filter(d => d.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function loadCategories(): string[] {
  return [...DEFAULT_CATEGORIES];
}
