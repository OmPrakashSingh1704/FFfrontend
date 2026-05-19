import { describe, expect, it, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import {
  collectCallQualityStats,
  sendCallQualityBeacon,
  type CallQualityReport,
} from '../callQuality'
import { setTokens } from '../tokenStorage'
import { server } from '../../test/server'

describe('collectCallQualityStats', () => {
  function fakePc(stats: Map<string, RTCStats>): RTCPeerConnection {
    // Minimal fake that satisfies the parts of RTCPeerConnection we use.
    return {
      getStats: vi.fn().mockResolvedValue(stats),
    } as unknown as RTCPeerConnection
  }

  it('returns partial=true when getStats throws', async () => {
    const pc = {
      getStats: vi.fn().mockRejectedValue(new Error('no stats')),
    } as unknown as RTCPeerConnection
    const report = await collectCallQualityStats(pc, {
      pcCreatedAt: 1000,
      connectedAt: 2000,
      endedAt: 10000,
    })
    expect(report.partial).toBe(true)
    // ice_setup_ms still computed from timings
    expect(report.ice_setup_ms).toBe(1000)
    expect(report.duration_seconds).toBe(9)
  })

  it('marks partial when connectedAt is null (call never connected)', async () => {
    const pc = fakePc(new Map())
    const report = await collectCallQualityStats(pc, {
      pcCreatedAt: 1000,
      connectedAt: null,
      endedAt: 5000,
    })
    expect(report.partial).toBe(true)
    expect(report.ice_setup_ms).toBe(0)
  })

  it('extracts candidate type from transport + local candidate', async () => {
    const stats = new Map<string, RTCStats>([
      ['t1', { id: 't1', type: 'transport', selectedCandidatePairId: 'pair1' } as RTCStats],
      [
        'pair1',
        {
          id: 'pair1',
          type: 'candidate-pair',
          localCandidateId: 'local1',
          currentRoundTripTime: 0.12,
        } as RTCStats,
      ],
      [
        'local1',
        {
          id: 'local1',
          type: 'local-candidate',
          candidateType: 'relay',
          protocol: 'udp',
        } as RTCStats,
      ],
    ])
    const pc = fakePc(stats)
    const report = await collectCallQualityStats(pc, {
      pcCreatedAt: 1000,
      connectedAt: 2000,
      endedAt: 5000,
    })
    expect(report.candidate_type_used).toBe('relay')
    expect(report.selected_candidate_protocol).toBe('udp')
    expect(report.avg_rtt_ms).toBe(120)
    // partial=true here because no inbound/outbound packets were observed
    expect(report.partial).toBe(true)
  })

  it('aggregates inbound/outbound bytes + packet loss', async () => {
    const stats = new Map<string, RTCStats>([
      [
        'out1',
        {
          id: 'out1',
          type: 'outbound-rtp',
          bytesSent: 100_000,
        } as RTCStats,
      ],
      [
        'in1',
        {
          id: 'in1',
          type: 'inbound-rtp',
          bytesReceived: 200_000,
          packetsLost: 5,
          packetsReceived: 95,
        } as RTCStats,
      ],
    ])
    const pc = fakePc(stats)
    const report = await collectCallQualityStats(pc, {
      pcCreatedAt: 1000,
      connectedAt: 2000,
      endedAt: 10000,
    })
    expect(report.bytes_sent).toBe(100_000)
    expect(report.bytes_received).toBe(200_000)
    expect(report.packet_loss_pct).toBe(5) // 5 / 100 packets = 5%
    expect(report.partial).toBe(false)
  })

  it('defaults end_reason to hangup', async () => {
    const pc = fakePc(new Map())
    const report = await collectCallQualityStats(pc, {
      pcCreatedAt: 0,
      connectedAt: 100,
      endedAt: 1100,
    })
    expect(report.end_reason).toBe('hangup')
  })

  it('honors explicit end_reason', async () => {
    const pc = fakePc(new Map())
    const report = await collectCallQualityStats(pc, {
      pcCreatedAt: 0,
      connectedAt: 100,
      endedAt: 1100,
      endReason: 'ice_failed',
    })
    expect(report.end_reason).toBe('ice_failed')
  })
})

describe('sendCallQualityBeacon', () => {
  beforeEach(() => {
    setTokens({ accessToken: 'test-token', refreshToken: null })
  })

  it('POSTs to /chat/calls/<id>/quality/ with auth header', async () => {
    let receivedAuth: string | null = null
    let receivedBody: unknown = null

    server.use(
      http.post('http://localhost:8000/api/v1/chat/calls/abc-123/quality/', async ({ request }) => {
        receivedAuth = request.headers.get('authorization')
        receivedBody = await request.json()
        return HttpResponse.json({ ok: true })
      }),
    )

    const report: CallQualityReport = {
      ice_setup_ms: 1500,
      candidate_type_used: 'relay',
      duration_seconds: 120,
      bytes_sent: 1000,
      bytes_received: 2000,
      partial: false,
    }
    sendCallQualityBeacon('abc-123', report)

    // Wait for the keepalive fetch to actually fire
    await new Promise((r) => setTimeout(r, 50))

    expect(receivedAuth).toBe('Bearer test-token')
    expect(receivedBody).toMatchObject({
      ice_setup_ms: 1500,
      candidate_type_used: 'relay',
    })
  })

  it('does not throw when network fails', async () => {
    server.use(
      http.post('http://localhost:8000/api/v1/chat/calls/dead/quality/', () =>
        HttpResponse.error(),
      ),
    )
    const report: CallQualityReport = {
      ice_setup_ms: 0,
      candidate_type_used: 'host',
      duration_seconds: 0,
      bytes_sent: 0,
      bytes_received: 0,
      partial: true,
    }
    // Must not throw — best-effort
    expect(() => sendCallQualityBeacon('dead', report)).not.toThrow()
  })
})
