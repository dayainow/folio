import { NextResponse } from 'next/server'
import { mkdir, appendFile } from 'node:fs/promises'
import path from 'node:path'

export const runtime = 'nodejs'

type Body = {
  to?: string
  subject?: string
  text?: string
  html?: string
  kind?: string
}

async function writeOutbox(entry: Record<string, unknown>) {
  const dir = path.join(process.cwd(), '.data', 'email-outbox')
  await mkdir(dir, { recursive: true })
  const file = path.join(dir, `${new Date().toISOString().slice(0, 10)}.jsonl`)
  await appendFile(file, `${JSON.stringify(entry)}\n`, 'utf8')
}

/** POST /api/email/notify — Resend 또는 로컬 outbox */
export async function POST(request: Request) {
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const to = body.to?.trim()
  const subject = body.subject?.trim()
  const text = body.text?.trim() || ''
  if (!to?.includes('@') || !subject) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const entry = {
    at: new Date().toISOString(),
    to,
    subject,
    text,
    html: body.html ?? null,
    kind: body.kind ?? 'important',
  }

  const resendKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.FOLIO_EMAIL_FROM?.trim() || 'Folio <onboarding@resend.dev>'

  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          text,
          html: body.html || undefined,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        await writeOutbox({ ...entry, mode: 'resend_failed', error: errText.slice(0, 400) })
        return NextResponse.json({ error: 'resend_failed', detail: errText.slice(0, 200) }, { status: 502 })
      }
      await writeOutbox({ ...entry, mode: 'resend' })
      return NextResponse.json({ ok: true, mode: 'resend' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'send_failed'
      await writeOutbox({ ...entry, mode: 'resend_error', error: message })
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  try {
    await writeOutbox({ ...entry, mode: 'outbox' })
  } catch {
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: 'outbox_unavailable',
    })
  }

  return NextResponse.json({
    ok: true,
    skipped: true,
    reason: 'resend_not_configured',
    mode: 'outbox',
  })
}
