/**
 * Quality beacon helpers.
 *
 * On call end (hangup OR tab close), the frontend POSTs a 10-field quality
 * report to /chat/calls/<id>/quality/. The backend writes a CallQuality
 * row that feeds AdminCallMetricsView.
 *
 * Why navigator.sendBeacon: it's the only fetch variant guaranteed to flush
 * during page unload (close tab, navigate away). Regular fetch() is
 * aborted by the browser when the page is being torn down. Beacon ships
 * the payload via the browser's networking stack independent of the JS
 * context.
 *
 * Why 10 fields and not the full getStats() dump: raw getStats() returns
 * 500KB+ of nested stats. Projecting to a flat 2KB payload keeps the
 * backend cheap and the table queryable.
 *
 * Safari pre-15 caveat: some RTCStats fields are missing or have different
 * shapes. The collector marks reports with `partial: true` when it can't
 * extract a metric, so admin metrics can filter out incomplete data.
 */
import { API_BASE_URL } from './env'
import { getTokens } from './tokenStorage'

export type CallQualityReport = {
  ice_setup_ms: number
  candidate_type_used: 'host' | 'srflx' | 'prflx' | 'relay'
  selected_candidate_protocol?: 'udp' | 'tcp'
  duration_seconds: number
  bytes_sent: number
  bytes_received: number
  packet_loss_pct?: number | null
  avg_rtt_ms?: number | null
  user_agent?: string
  partial: boolean
  end_reason?: string
}

export type CollectStatsOptions = {
  /** When the local PC was created (ms epoch). Used for ice_setup_ms. */
  pcCreatedAt: number
  /** When iceConnectionState reached 'connected' (ms epoch). */
  connectedAt: number | null
  /** When the call ended (ms epoch). Defaults to now. */
  endedAt?: number
  /** Why the call ended ('hangup' | 'ice_failed' | 'page_close' | ...) */
  endReason?: string
}

/**
 * Extract a 10-field quality report from a peer connection's stats.
 *
 * Designed to never throw — if getStats fails or returns partial data,
 * sets `partial: true` and returns best-effort values. The backend can
 * choose to filter partial reports out of aggregations.
 */
export async function collectCallQualityStats(
  pc: RTCPeerConnection,
  options: CollectStatsOptions,
): Promise<CallQualityReport> {
  const endedAt = options.endedAt ?? Date.now()
  const iceSetupMs =
    options.connectedAt != null
      ? Math.max(0, options.connectedAt - options.pcCreatedAt)
      : 0

  // Defaults — we mark partial=true if any of these stay as defaults.
  let bytesSent = 0
  let bytesReceived = 0
  let packetLossPct: number | null = null
  let avgRttMs: number | null = null
  let candidateType: CallQualityReport['candidate_type_used'] = 'host'
  let selectedProtocol: 'udp' | 'tcp' | undefined
  let partial = false

  try {
    const stats = await pc.getStats()
    // Find the selected candidate pair to identify candidate type + protocol.
    let selectedPairId: string | undefined
    stats.forEach((report) => {
      if (
        report.type === 'transport' &&
        (report as RTCTransportStats).selectedCandidatePairId
      ) {
        selectedPairId = (report as RTCTransportStats).selectedCandidatePairId
      }
    })

    let localCandidateId: string | undefined
    if (selectedPairId) {
      const pair = stats.get(selectedPairId) as RTCIceCandidatePairStats | undefined
      if (pair) {
        localCandidateId = pair.localCandidateId
        if (pair.currentRoundTripTime != null) {
          avgRttMs = Math.round(pair.currentRoundTripTime * 1000)
        }
      }
    }

    if (localCandidateId) {
      // Structural type instead of `RTCIceCandidateStats` — that name was
      // removed from TS's lib.dom.d.ts between versions and isn't reliably
      // present on Vercel's build TS. We only touch two fields anyway.
      type LocalCandidate = { candidateType?: string; protocol?: string }
      const local = stats.get(localCandidateId) as LocalCandidate | undefined
      if (local) {
        const t = local.candidateType
        if (t === 'host' || t === 'srflx' || t === 'prflx' || t === 'relay') {
          candidateType = t
        }
        const proto = local.protocol
        if (proto === 'udp' || proto === 'tcp') {
          selectedProtocol = proto
        }
      }
    }

    // Aggregate inbound/outbound bytes + packet loss across all streams.
    let packetsLost = 0
    let packetsReceived = 0
    stats.forEach((report) => {
      if (report.type === 'outbound-rtp') {
        const r = report as RTCOutboundRtpStreamStats
        if (typeof r.bytesSent === 'number') bytesSent += r.bytesSent
      } else if (report.type === 'inbound-rtp') {
        const r = report as RTCInboundRtpStreamStats
        if (typeof r.bytesReceived === 'number') bytesReceived += r.bytesReceived
        if (typeof r.packetsLost === 'number') packetsLost += r.packetsLost
        if (typeof r.packetsReceived === 'number') packetsReceived += r.packetsReceived
      }
    })

    const totalPackets = packetsLost + packetsReceived
    if (totalPackets > 0) {
      packetLossPct = Number(((packetsLost / totalPackets) * 100).toFixed(2))
    } else {
      // No packets observed — Safari pre-15 commonly returns this.
      partial = true
    }
  } catch (err) {
    console.warn('[call] getStats failed; sending partial quality report', err)
    partial = true
  }

  // If we never reached 'connected' (call ended during ICE checking), ALL
  // setup-derived fields are meaningless. Mark partial so backend doesn't
  // pollute setup percentiles with a 0ms value.
  if (options.connectedAt == null) {
    partial = true
  }

  return {
    ice_setup_ms: iceSetupMs,
    candidate_type_used: candidateType,
    selected_candidate_protocol: selectedProtocol,
    duration_seconds: Math.max(
      0,
      Math.round((endedAt - options.pcCreatedAt) / 1000),
    ),
    bytes_sent: bytesSent,
    bytes_received: bytesReceived,
    packet_loss_pct: packetLossPct,
    avg_rtt_ms: avgRttMs,
    user_agent: navigator.userAgent.slice(0, 255),
    partial,
    end_reason: options.endReason ?? 'hangup',
  }
}

/**
 * Send the quality report to the backend.
 *
 * Tries navigator.sendBeacon first — it survives page unload. Falls back
 * to fetch() with keepalive when beacon isn't available (older Safari,
 * sandboxed environments).
 *
 * Never throws — quality reporting is best-effort and must not block
 * call cleanup.
 */
export function sendCallQualityBeacon(
  callId: string,
  report: CallQualityReport,
): void {
  const url = `${API_BASE_URL}/chat/calls/${callId}/quality/`
  const tokens = getTokens()
  const accessToken = tokens.accessToken

  // sendBeacon doesn't accept custom headers — we have to encode auth in
  // the URL as a query param (the backend should also accept this) or
  // use fetch() with keepalive as the fallback. We use fetch+keepalive
  // because we already require Authorization header — beacon would need
  // a backend change to accept query-param auth, which we don't want.
  //
  // fetch + keepalive: same survives-unload guarantee as beacon, supports
  // headers. Browser support: Chrome 66+, Firefox 73+, Safari 13+ — fine
  // for our user base.
  try {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(report),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {
      // Swallow — quality reporting is best-effort.
    })
  } catch {
    // Some environments (very old Safari) throw on keepalive. Last resort:
    // synchronous beacon without auth. Backend will 401, but that's better
    // than nothing in unloading-page paths.
    try {
      navigator.sendBeacon?.(url, JSON.stringify(report))
    } catch {
      // Truly stuck — drop the report.
    }
  }
}
