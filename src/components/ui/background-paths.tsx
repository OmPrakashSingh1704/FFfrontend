"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { createNoise2D } from "simplex-noise";
import { Button } from "./button";

/**
 * Unified interactive background: curved flowing paths that respond to cursor movement.
 * No separate layers — one continuous field of interactive curves.
 */
export function InteractivePaths() {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({
        x: -1000, y: -1000, lx: 0, ly: 0,
        sx: -1000, sy: -1000, v: 0, vs: 0, a: 0, set: false,
    });
    const noiseRef = useRef<ReturnType<typeof createNoise2D> | null>(null);
    const rafRef = useRef<number | null>(null);
    const sizeRef = useRef({ w: 0, h: 0 });
    const dprRef = useRef(1);

    const updateMouse = useCallback((x: number, y: number) => {
        const m = mouseRef.current;
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        m.x = x - rect.left;
        m.y = y - rect.top;
        if (!m.set) {
            m.sx = m.x; m.sy = m.y;
            m.lx = m.x; m.ly = m.y;
            m.set = true;
        }
    }, []);

    const setSize = useCallback(() => {
        if (!containerRef.current || !canvasRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        dprRef.current = dpr;
        sizeRef.current = { w: rect.width, h: rect.height };
        canvasRef.current.width = rect.width * dpr;
        canvasRef.current.height = rect.height * dpr;
        canvasRef.current.style.width = `${rect.width}px`;
        canvasRef.current.style.height = `${rect.height}px`;
    }, []);

    useEffect(() => {
        if (!containerRef.current || !canvasRef.current) return;
        noiseRef.current = createNoise2D();
        setSize();

        const onResize = () => setSize();
        const onMouseMove = (e: MouseEvent) => updateMouse(e.clientX, e.clientY);
        const onTouchMove = (e: TouchEvent) => {
            e.preventDefault();
            updateMouse(e.touches[0].clientX, e.touches[0].clientY);
        };

        window.addEventListener("resize", onResize);
        window.addEventListener("mousemove", onMouseMove);
        const el = containerRef.current;
        el.addEventListener("touchmove", onTouchMove, { passive: false });

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            window.removeEventListener("resize", onResize);
            window.removeEventListener("mousemove", onMouseMove);
            el?.removeEventListener("touchmove", onTouchMove);
        };
    }, [setSize, updateMouse]);

    const tick = (time: number) => {
        const ctx = canvasRef.current?.getContext("2d");
        const noise = noiseRef.current;
        const m = mouseRef.current;
        const { w, h } = sizeRef.current;
        const dpr = dprRef.current;

        if (!ctx || !noise || w === 0) {
            rafRef.current = requestAnimationFrame(tick);
            return;
        }

        // Smooth mouse position
        m.sx += (m.x - m.sx) * 0.08;
        m.sy += (m.y - m.sy) * 0.08;
        const dx = m.x - m.lx;
        const dy = m.y - m.ly;
        m.v = Math.hypot(dx, dy);
        m.vs += (m.v - m.vs) * 0.12;
        m.vs = Math.min(120, m.vs);
        m.lx = m.x;
        m.ly = m.y;
        m.a = Math.atan2(dy, dx);

        ctx.clearRect(0, 0, w * dpr, h * dpr);
        ctx.save();
        ctx.scale(dpr, dpr);

        // Get computed colors from CSS
        const style = getComputedStyle(containerRef.current!);
        const fg = style.color; // inherits text-foreground

        const totalCurves = 48;
        const t = time * 0.0004;

        for (let i = 0; i < totalCurves; i++) {
            const progress = i / totalCurves;
            const baseOpacity = 0.03 + progress * 0.08;

            // Each curve is a flowing path across the screen
            ctx.beginPath();
            ctx.strokeStyle = fg;
            ctx.globalAlpha = baseOpacity;
            ctx.lineWidth = 0.4 + progress * 0.6;

            const segments = 80;
            const yBase = h * 0.15 + (h * 0.7) * progress;

            for (let s = 0; s <= segments; s++) {
                const sx = (w / segments) * s;
                const frac = s / segments;

                // Layered noise for organic flowing motion
                const n1 = noise((sx * 0.003 + t + i * 0.5), (yBase * 0.003 + t * 0.7)) * 30;
                const n2 = noise((sx * 0.006 + t * 1.3 + i * 0.3), (yBase * 0.006)) * 15;
                const n3 = noise((sx * 0.001 + t * 0.5), (yBase * 0.001 + i * 0.2)) * 50;

                let sy = yBase + n1 + n2 + n3;

                // Mouse interaction — curves bend away/toward cursor
                const mdx = sx - m.sx;
                const mdy = sy - m.sy;
                const dist = Math.hypot(mdx, mdy);
                const radius = 180 + m.vs * 1.5;

                if (dist < radius && dist > 0) {
                    const strength = (1 - dist / radius);
                    const force = strength * strength * (40 + m.vs * 0.5);
                    // Push points away from cursor along the normal
                    sy += (mdy / dist) * force;
                    // Also add velocity-based displacement
                    const velForce = strength * m.vs * 0.15;
                    sy += Math.sin(m.a) * velForce;
                }

                // Edge fade
                const edgeFade = Math.min(frac * 4, (1 - frac) * 4, 1);
                const finalY = sy;

                if (s === 0) {
                    ctx.moveTo(sx, finalY);
                } else {
                    ctx.quadraticCurveTo(sx - (w / segments) * 0.5, finalY - edgeFade * 2, sx, finalY);
                }
            }

            ctx.stroke();
        }

        ctx.restore();
        rafRef.current = requestAnimationFrame(tick);
    };

    return (
        <div ref={containerRef} className="fixed inset-0 text-foreground pointer-events-none z-0">
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
        </div>
    );
}

export function BackgroundPaths({ title = "Background Paths" }: { title?: string }) {
    const words = title.split(" ");

    return (
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
            {/* Interactive paths now rendered at page level */}

            {/* Content */}
            <div className="relative z-10 container mx-auto px-4 md:px-6 text-center">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 2 }}
                    className="max-w-4xl mx-auto"
                >
                    <h1 className="text-5xl sm:text-7xl md:text-8xl font-bold mb-8 tracking-tighter">
                        {words.map((word, wordIndex) => (
                            <span key={wordIndex} className="inline-block mr-4 last:mr-0">
                                {word.split("").map((letter, letterIndex) => (
                                    <motion.span
                                        key={`${wordIndex}-${letterIndex}`}
                                        initial={{ y: 100, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{
                                            delay: wordIndex * 0.1 + letterIndex * 0.03,
                                            type: "spring",
                                            stiffness: 150,
                                            damping: 25,
                                        }}
                                        className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-foreground to-foreground/80"
                                    >
                                        {letter}
                                    </motion.span>
                                ))}
                            </span>
                        ))}
                    </h1>

                    <div className="inline-block group relative bg-gradient-to-b from-foreground/10 to-foreground/5 p-px rounded-2xl backdrop-blur-lg overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300">
                        <Button
                            variant="ghost"
                            className="rounded-[1.15rem] px-8 py-6 text-lg font-semibold backdrop-blur-md bg-background/50 hover:bg-background/80 text-foreground transition-all duration-300 group-hover:-translate-y-0.5 border border-foreground/10 hover:border-foreground/20"
                        >
                            <span className="opacity-90 group-hover:opacity-100 transition-opacity">
                                Get Started
                            </span>
                            <span className="ml-3 opacity-70 group-hover:opacity-100 group-hover:translate-x-1.5 transition-all duration-300">
                                →
                            </span>
                        </Button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
