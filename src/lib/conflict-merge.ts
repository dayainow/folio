/**
 * P48 — 3-way merge (base · local · remote) · 충돌 감지
 */

export type MergeHunk =
  | { kind: 'equal'; text: string }
  | { kind: 'local'; text: string }
  | { kind: 'remote'; text: string }
  | { kind: 'conflict'; local: string; remote: string; base: string }

export type ThreeWayMergeResult = {
  ok: boolean
  merged: string
  hunks: MergeHunk[]
  conflictCount: number
}

function splitLines(s: string): string[] {
  if (!s) return []
  return s.split('\n')
}

function joinLines(lines: string[]): string {
  return lines.join('\n')
}

/**
 * 라인 단위 3-way merge.
 * - base와 동일한 쪽 변경은 자동 채택
 * - 양쪽이 다르게 바뀌면 conflict hunk
 */
export function threeWayMerge(base: string, local: string, remote: string): ThreeWayMergeResult {
  if (local === remote) {
    return {
      ok: true,
      merged: local,
      hunks: local ? [{ kind: 'equal', text: local }] : [],
      conflictCount: 0,
    }
  }
  if (local === base) {
    return {
      ok: true,
      merged: remote,
      hunks: remote === base ? [{ kind: 'equal', text: remote }] : [{ kind: 'remote', text: remote }],
      conflictCount: 0,
    }
  }
  if (remote === base) {
    return {
      ok: true,
      merged: local,
      hunks: [{ kind: 'local', text: local }],
      conflictCount: 0,
    }
  }

  const b = splitLines(base)
  const l = splitLines(local)
  const r = splitLines(remote)

  // LCS 기반 단순 정렬: 인덱스 투어 (Myers 간소화 — 라인 집합 매칭)
  const hunks: MergeHunk[] = []
  let bi = 0
  let li = 0
  let ri = 0
  let conflictCount = 0
  const mergedLines: string[] = []

  const maxGuard = b.length + l.length + r.length + 8
  let guard = 0

  while ((bi < b.length || li < l.length || ri < r.length) && guard < maxGuard) {
    guard += 1
    const bv = bi < b.length ? b[bi] : undefined
    const lv = li < l.length ? l[li] : undefined
    const rv = ri < r.length ? r[ri] : undefined

    if (lv !== undefined && rv !== undefined && lv === rv) {
      mergedLines.push(lv)
      hunks.push({ kind: 'equal', text: lv })
      if (bv === lv) bi += 1
      li += 1
      ri += 1
      continue
    }

    if (bv !== undefined && lv === bv && rv !== bv) {
      // local unchanged, remote changed
      mergedLines.push(rv!)
      hunks.push({ kind: 'remote', text: rv! })
      bi += 1
      li += 1
      ri += 1
      continue
    }

    if (bv !== undefined && rv === bv && lv !== bv) {
      mergedLines.push(lv!)
      hunks.push({ kind: 'local', text: lv! })
      bi += 1
      li += 1
      ri += 1
      continue
    }

    // both diverged (or inserts)
    const localChunk: string[] = []
    const remoteChunk: string[] = []
    const baseChunk: string[] = []

    if (bv !== undefined) {
      baseChunk.push(bv)
      bi += 1
    }
    if (lv !== undefined && lv !== bv) {
      localChunk.push(lv)
      li += 1
      // consume consecutive local-only until sync opportunity
      while (li < l.length && (bi >= b.length || l[li] !== b[bi]) && (ri >= r.length || l[li] !== r[ri])) {
        localChunk.push(l[li]!)
        li += 1
      }
    } else if (lv === bv) {
      li += 1
    }

    if (rv !== undefined && rv !== bv) {
      remoteChunk.push(rv)
      ri += 1
      while (ri < r.length && (bi >= b.length || r[ri] !== b[bi]) && (li >= l.length || r[ri] !== l[li])) {
        remoteChunk.push(r[ri]!)
        ri += 1
      }
    } else if (rv === bv) {
      ri += 1
    }

    const localText = joinLines(localChunk)
    const remoteText = joinLines(remoteChunk)
    const baseText = joinLines(baseChunk)

    if (localText === remoteText) {
      if (localText) {
        mergedLines.push(...localChunk)
        hunks.push({ kind: 'equal', text: localText })
      }
    } else if (!localText && remoteText) {
      mergedLines.push(...remoteChunk)
      hunks.push({ kind: 'remote', text: remoteText })
    } else if (localText && !remoteText) {
      mergedLines.push(...localChunk)
      hunks.push({ kind: 'local', text: localText })
    } else {
      conflictCount += 1
      hunks.push({ kind: 'conflict', local: localText, remote: remoteText, base: baseText })
      // 자동 병합 기본: local 우선 + 마커
      const marker = [
        '<<<<<<< local',
        localText,
        '=======',
        remoteText,
        '>>>>>>> remote',
      ].join('\n')
      mergedLines.push(marker)
    }
  }

  return {
    ok: conflictCount === 0,
    merged: joinLines(mergedLines),
    hunks,
    conflictCount,
  }
}

/** 충돌 마커를 local 또는 remote로 일괄 해소 */
export function resolveConflictMarkers(
  text: string,
  choose: 'local' | 'remote',
): string {
  const re =
    /<<<<<<< local\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> remote/g
  return text.replace(re, (_m, local: string, remote: string) =>
    choose === 'local' ? local : remote,
  )
}

export type ConflictSuggestion = {
  autoMerged: string
  needsManual: boolean
  conflictCount: number
  summary: string
}

export function suggestConflictResolution(
  base: string,
  local: string,
  remote: string,
): ConflictSuggestion {
  const result = threeWayMerge(base, local, remote)
  return {
    autoMerged: result.merged,
    needsManual: !result.ok,
    conflictCount: result.conflictCount,
    summary: result.ok
      ? '자동 병합 가능'
      : `충돌 ${result.conflictCount}곳 — 수동 선택 필요`,
  }
}
