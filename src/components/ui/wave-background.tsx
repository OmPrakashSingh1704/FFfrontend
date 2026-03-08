'use client'
import { useEffect, useRef } from 'react'
import { createNoise2D } from 'simplex-noise'

interface Point {
    x: number
    y: number
    wave: { x: number; y: number }
    cursor: {
        x: number
        y: number
        vx: number
        vy: number
    }
}

interface WavesProps {
    className?: string
    strokeColor?: string
    backgroundColor?: string
    pointerSize?: number
}

export function Waves({
    className = "",
    strokeColor = "hsl(var(--foreground))",
    backgroundColor = "transparent",
}: WavesProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const svgRef = useRef<SVGSVGElement>(null)
    const mouseRef = useRef({
        x: -10,
        y: 0,
        lx: 0,
        ly: 0,
        sx: 0,
        sy: 0,
        v: 0,
        vs: 0,
        a: 0,
        set: false,
    })
    const pathsRef = useRef<SVGPathElement[]>([])
    const linesRef = useRef<Point[][]>([])
    const noiseRef = useRef<((x: number, y: number) => number) | null>(null)
    const rafRef = useRef<number | null>(null)
    const boundingRef = useRef<DOMRect | null>(null)

    useEffect(() => {
        if (!containerRef.current || !svgRef.current) return

        noiseRef.current = createNoise2D()

        setSize()
        setLines()

        window.addEventListener('resize', onResize)
        window.addEventListener('mousemove', onMouseMove)

        const container = containerRef.current
        container.addEventListener('touchmove', onTouchMove, { passive: false })

        rafRef.current = requestAnimationFrame(tick)

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            window.removeEventListener('resize', onResize)
            window.removeEventListener('mousemove', onMouseMove)
            container?.removeEventListener('touchmove', onTouchMove)
        }
    }, [])

    const setSize = () => {
        if (!containerRef.current || !svgRef.current) return
        boundingRef.current = containerRef.current.getBoundingClientRect()
        const { width, height } = boundingRef.current
        svgRef.current.style.width = `${width}px`
        svgRef.current.style.height = `${height}px`
    }

    const setLines = () => {
        if (!svgRef.current || !boundingRef.current) return
        const { width, height } = boundingRef.current
        linesRef.current = []
        pathsRef.current.forEach(path => path.remove())
        pathsRef.current = []

        const xGap = 8
        const yGap = 8
        const oWidth = width + 200
        const oHeight = height + 30
        const totalLines = Math.ceil(oWidth / xGap)
        const totalPoints = Math.ceil(oHeight / yGap)
        const xStart = (width - xGap * totalLines) / 2
        const yStart = (height - yGap * totalPoints) / 2

        for (let i = 0; i < totalLines; i++) {
            const points: Point[] = []
            for (let j = 0; j < totalPoints; j++) {
                points.push({
                    x: xStart + xGap * i,
                    y: yStart + yGap * j,
                    wave: { x: 0, y: 0 },
                    cursor: { x: 0, y: 0, vx: 0, vy: 0 },
                })
            }

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
            path.setAttribute('fill', 'none')
            path.setAttribute('stroke', strokeColor)
            path.setAttribute('stroke-width', '1')
            path.setAttribute('stroke-opacity', '0.35')
            svgRef.current.appendChild(path)
            pathsRef.current.push(path)
            linesRef.current.push(points)
        }
    }

    const onResize = () => { setSize(); setLines() }

    const onMouseMove = (e: MouseEvent) => updateMousePosition(e.clientX, e.clientY)

    const onTouchMove = (e: TouchEvent) => {
        e.preventDefault()
        updateMousePosition(e.touches[0].clientX, e.touches[0].clientY)
    }

    const updateMousePosition = (x: number, y: number) => {
        if (!boundingRef.current) return
        const mouse = mouseRef.current
        mouse.x = x - boundingRef.current.left
        mouse.y = y - boundingRef.current.top
        if (!mouse.set) {
            mouse.sx = mouse.x; mouse.sy = mouse.y
            mouse.lx = mouse.x; mouse.ly = mouse.y
            mouse.set = true
        }
    }

    const movePoints = (time: number) => {
        const { current: lines } = linesRef
        const { current: mouse } = mouseRef
        const { current: noise } = noiseRef
        if (!noise) return

        lines.forEach((points) => {
            points.forEach((p: Point) => {
                const move = noise(
                    (p.x + time * 0.008) * 0.003,
                    (p.y + time * 0.003) * 0.002
                ) * 12
                p.wave.x = Math.cos(move) * 18
                p.wave.y = Math.sin(move) * 10

                const dx = p.x - mouse.sx
                const dy = p.y - mouse.sy
                const d = Math.hypot(dx, dy)
                const l = Math.max(300, mouse.vs * 1.5)

                if (d < l) {
                    const s = 1 - d / l
                    const f = Math.cos(d * 0.001) * s
                    p.cursor.vx += Math.cos(mouse.a) * f * l * mouse.vs * 0.0012
                    p.cursor.vy += Math.sin(mouse.a) * f * l * mouse.vs * 0.0012
                }

                p.cursor.vx += (0 - p.cursor.x) * 0.005
                p.cursor.vy += (0 - p.cursor.y) * 0.005
                p.cursor.vx *= 0.92
                p.cursor.vy *= 0.92
                p.cursor.x += p.cursor.vx
                p.cursor.y += p.cursor.vy
                p.cursor.x = Math.min(100, Math.max(-100, p.cursor.x))
                p.cursor.y = Math.min(100, Math.max(-100, p.cursor.y))
            })
        })
    }

    const moved = (point: Point, withCursorForce = true) => ({
        x: point.x + point.wave.x + (withCursorForce ? point.cursor.x : 0),
        y: point.y + point.wave.y + (withCursorForce ? point.cursor.y : 0),
    })

    const drawLines = () => {
        const { current: lines } = linesRef
        const { current: paths } = pathsRef
        lines.forEach((points, lIndex) => {
            if (points.length < 2 || !paths[lIndex]) return
            const firstPoint = moved(points[0], false)
            let d = `M ${firstPoint.x} ${firstPoint.y}`
            for (let i = 1; i < points.length; i++) {
                const current = moved(points[i])
                d += `L ${current.x} ${current.y}`
            }
            paths[lIndex].setAttribute('d', d)
        })
    }

    const tick = (time: number) => {
        const { current: mouse } = mouseRef
        mouse.sx += (mouse.x - mouse.sx) * 0.1
        mouse.sy += (mouse.y - mouse.sy) * 0.1
        const dx = mouse.x - mouse.lx
        const dy = mouse.y - mouse.ly
        mouse.v = Math.hypot(dx, dy)
        mouse.vs += (mouse.v - mouse.vs) * 0.1
        mouse.vs = Math.min(100, mouse.vs)
        mouse.lx = mouse.x
        mouse.ly = mouse.y
        mouse.a = Math.atan2(dy, dx)

        movePoints(time)
        drawLines()
        rafRef.current = requestAnimationFrame(tick)
    }

    return (
        <div
            ref={containerRef}
            className={`w-full h-full overflow-hidden ${className}`}
            style={{ backgroundColor }}
        >
            <svg ref={svgRef} className="absolute inset-0 w-full h-full" />
        </div>
    )
}
