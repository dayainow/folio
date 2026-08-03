/**
 * P48 — WebRTC 시그널링 헬퍼 (음성/화면공유 옵션)
 * 실제 미디어 트랙은 브라우저 RTCPeerConnection 사용.
 */
'use client'

import type { CollabWsClient } from '@/lib/collab-ws-client'
import type { WebRtcSignal } from '@/lib/collab-protocol'

export type MediaSessionKind = 'voice' | 'screen'

export type CollabMediaSession = {
  kind: MediaSessionKind
  pc: RTCPeerConnection
  localStream: MediaStream | null
  destroy: () => void
}

const ICE: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

/**
 * 시그널링 콜백을 WS 클라이언트에 연결하고 PeerConnection을 생성한다.
 * 상대 peerId가 정해진 1:1 통화용.
 */
export async function startCollabMedia(options: {
  kind: MediaSessionKind
  selfId: string
  peerId: string
  ws: CollabWsClient
  onRemoteStream?: (stream: MediaStream) => void
}): Promise<CollabMediaSession> {
  const pc = new RTCPeerConnection(ICE)
  let localStream: MediaStream | null = null

  pc.ontrack = (ev) => {
    const stream = ev.streams[0]
    if (stream) options.onRemoteStream?.(stream)
  }

  pc.onicecandidate = (ev) => {
    if (!ev.candidate) return
    options.ws.sendSignal({
      from: options.selfId,
      to: options.peerId,
      kind: 'ice',
      payload: ev.candidate.toJSON(),
    })
  }

  if (options.kind === 'voice') {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
  } else {
    localStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
  }
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream)
  }

  const offer = await pc.createOffer()
  await pc.setLocalDescription(offer)
  options.ws.sendSignal({
    from: options.selfId,
    to: options.peerId,
    kind: options.kind === 'voice' ? 'offer' : 'screen-offer',
    payload: offer,
  })

  return {
    kind: options.kind,
    pc,
    localStream,
    destroy() {
      localStream?.getTracks().forEach((t) => t.stop())
      options.ws.sendSignal({
        from: options.selfId,
        to: options.peerId,
        kind: 'hangup',
      })
      pc.close()
    },
  }
}

export async function handleIncomingSignal(
  pc: RTCPeerConnection,
  signal: WebRtcSignal,
  selfId: string,
  ws: CollabWsClient,
): Promise<void> {
  if (signal.to !== '*' && signal.to !== selfId) return
  if (signal.kind === 'offer' || signal.kind === 'screen-offer') {
    await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    ws.sendSignal({
      from: selfId,
      to: signal.from,
      kind: signal.kind === 'offer' ? 'answer' : 'screen-answer',
      payload: answer,
    })
    return
  }
  if (signal.kind === 'answer' || signal.kind === 'screen-answer') {
    await pc.setRemoteDescription(signal.payload as RTCSessionDescriptionInit)
    return
  }
  if (signal.kind === 'ice' && signal.payload) {
    try {
      await pc.addIceCandidate(signal.payload as RTCIceCandidateInit)
    } catch {
      /* ignore */
    }
  }
}
