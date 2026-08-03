/**
 * P51 — 플러그인 샌드박스 (Web Worker / iframe 옵션)
 * 신뢰된 builtin은 sandbox:none. 마켓 스크립트는 worker로 격리 실행.
 */
'use client'

export type SandboxMode = 'none' | 'worker' | 'iframe'

export type SandboxResult = {
  ok: boolean
  result?: unknown
  error?: string
  mode: SandboxMode
}

/**
 * 순수 함수 스크립트를 Worker에서 실행 (네트워크·DOM 없음)
 * scriptBody는 `function run(input){ ... return ... }` 형태 기대
 */
export async function runInWorkerSandbox(
  scriptBody: string,
  input: unknown,
  timeoutMs = 3000,
): Promise<SandboxResult> {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    return { ok: false, error: 'worker_unavailable', mode: 'worker' }
  }

  const blob = new Blob(
    [
      `
      self.onmessage = function (e) {
        try {
          var fn = new Function('input', e.data.code + '\\n; return (typeof run === "function" ? run(input) : null);');
          var out = fn(e.data.input);
          self.postMessage({ ok: true, result: out });
        } catch (err) {
          self.postMessage({ ok: false, error: String(err && err.message ? err.message : err) });
        }
      };
    `,
    ],
    { type: 'application/javascript' },
  )
  const url = URL.createObjectURL(blob)

  return new Promise((resolve) => {
    const worker = new Worker(url)
    const timer = window.setTimeout(() => {
      worker.terminate()
      URL.revokeObjectURL(url)
      resolve({ ok: false, error: 'timeout', mode: 'worker' })
    }, timeoutMs)

    worker.onmessage = (ev: MessageEvent<{ ok: boolean; result?: unknown; error?: string }>) => {
      window.clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(url)
      resolve({
        ok: Boolean(ev.data?.ok),
        result: ev.data?.result,
        error: ev.data?.error,
        mode: 'worker',
      })
    }
    worker.onerror = () => {
      window.clearTimeout(timer)
      worker.terminate()
      URL.revokeObjectURL(url)
      resolve({ ok: false, error: 'worker_error', mode: 'worker' })
    }
    worker.postMessage({ code: scriptBody, input })
  })
}

/**
 * iframe sandbox — postMessage로 결과 수신 (옵션)
 * 실제 플러그인 UI 호스팅용 골격
 */
export function createIframeSandboxHost(container: HTMLElement, srcDoc: string): {
  iframe: HTMLIFrameElement
  destroy: () => void
} {
  const iframe = document.createElement('iframe')
  iframe.sandbox.add('allow-scripts')
  iframe.setAttribute('referrerpolicy', 'no-referrer')
  iframe.style.width = '100%'
  iframe.style.border = '0'
  iframe.srcdoc = srcDoc
  container.appendChild(iframe)
  return {
    iframe,
    destroy: () => {
      iframe.remove()
    },
  }
}

/** 매니페스트 sandbox 모드에 따라 실행 */
export async function runSandboxed(
  mode: SandboxMode,
  scriptBody: string,
  input: unknown,
): Promise<SandboxResult> {
  if (mode === 'none') {
    try {
      // 신뢰된 none 모드 전용
      const fn = new Function('input', `${scriptBody}\n; return (typeof run === "function" ? run(input) : null);`)
      return { ok: true, result: fn(input), mode: 'none' }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
        mode: 'none',
      }
    }
  }
  if (mode === 'worker') {
    return runInWorkerSandbox(scriptBody, input)
  }
  return { ok: false, error: 'iframe_run_use_host', mode: 'iframe' }
}
