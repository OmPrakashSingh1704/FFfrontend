/**
 * 5-segment audio level meter.
 *
 * Renders 5 horizontal bars that fill based on the current mic level
 * (0-100). Used in the pre-call device test page to give users immediate
 * feedback that their mic is working.
 *
 * Why segmented instead of continuous: a continuous progress bar reads as
 * "loading" to most users. Discrete bars (wifi-signal style) read as
 * "level indicator" — closer to the real-world mental model of audio
 * volume on a hardware device.
 */
import { useEffect, useRef, useState } from 'react'

export type DeviceLevelMeterProps = {
  /** The MediaStream from getUserMedia. Pass null when not yet granted. */
  stream: MediaStream | null
  segments?: number
}

export function DeviceLevelMeter({ stream, segments = 5 }: DeviceLevelMeterProps) {
  const [level, setLevel] = useState(0)
  const rafRef = useRef<number | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!stream) {
      setLevel(0)
      return
    }

    let audioCtx: AudioContext
    try {
      audioCtx = new AudioContext()
    } catch {
      // Some browsers (Safari iOS in some modes) block AudioContext until
      // user gesture. Silently degrade — the meter just won't move.
      return
    }
    ctxRef.current = audioCtx
    const source = audioCtx.createMediaStreamSource(stream)
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    source.connect(analyser)

    const buffer = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteFrequencyData(buffer)
      // Average over the buffer → 0-255 → scale to 0-100.
      let sum = 0
      for (const v of buffer) sum += v
      const avg = sum / buffer.length
      // Boost a bit so normal speech reaches ~60-80% — pure average is too quiet.
      setLevel(Math.min(100, Math.round((avg / 128) * 100)))
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      try {
        source.disconnect()
        analyser.disconnect()
        void audioCtx.close()
      } catch {
        // ignore
      }
    }
  }, [stream])

  const filledSegments = Math.round((level / 100) * segments)

  return (
    <div
      role="meter"
      aria-valuenow={level}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Microphone level: ${level}%`}
      style={{ display: 'inline-flex', gap: '0.25rem', alignItems: 'center' }}
      data-testid="device-level-meter"
    >
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          style={{
            width: '0.5rem',
            height: '1.5rem',
            borderRadius: '2px',
            background:
              i < filledSegments ? 'hsl(var(--gold, 0 0% 9%))' : 'hsl(var(--muted))',
            transition: 'background-color 100ms ease-out',
          }}
        />
      ))}
      <span style={{ visibility: 'hidden', position: 'absolute' }}>
        Microphone level: {level}%
      </span>
    </div>
  )
}
