"use client";
import { useEffect, useRef } from "react";

/**
 * PageHero — full-bleed inner-page hero banner with dynamic particle canvas.
 * Designed to sit flush with fixed navigation with zero gap.
 */
export default function PageHero({ image, eyebrow, title, subtitle }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId;
    let particles = [];
    const PARTICLE_COUNT = 45;

    const resize = () => {
      if (!canvas.parentElement) return;
      canvas.width = canvas.parentElement.offsetWidth;
      canvas.height = canvas.parentElement.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    // Initialize particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * (canvas.width || 800),
        y: Math.random() * (canvas.height || 400),
        r: Math.random() * 2 + 0.6,
        dx: (Math.random() - 0.5) * 0.4,
        dy: -(Math.random() * 0.45 + 0.15),
        baseAlpha: Math.random() * 0.45 + 0.25,
        twinkleSpeed: Math.random() * 0.04 + 0.015,
        twinkleOffset: Math.random() * Math.PI * 2,
      });
    }

    let frame = 0;
    const draw = () => {
      frame++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;

        // Wrap around
        if (p.y < -5) p.y = canvas.height + 5;
        if (p.x < -5) p.x = canvas.width + 5;
        if (p.x > canvas.width + 5) p.x = -5;

        const currentAlpha = p.baseAlpha * (0.65 + 0.35 * Math.sin(frame * p.twinkleSpeed + p.twinkleOffset));
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(229, 197, 120, ${currentAlpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "rgba(229, 197, 120, 0.6)";
        ctx.fill();
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <header
      className="page-hero-container"
      style={{
        position: "relative",
        width: "100%",
        minHeight: "440px",
        height: "50vh",
        maxHeight: "560px",
        display: "flex",
        alignItems: "flex-end",
        backgroundImage: `url('${image}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        paddingBottom: "3.5rem",
        paddingTop: "120px",
        overflow: "hidden",
        margin: 0,
      }}
    >
      {/* Rich Crimson & Deep Navy Gradient Tint Overlay */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(135deg, rgba(120, 15, 32, 0.72) 0%, rgba(55, 12, 24, 0.65) 42%, rgba(9, 18, 35, 0.92) 100%)",
          zIndex: 1,
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(9, 18, 35, 0.95) 0%, rgba(9, 18, 35, 0.45) 50%, rgba(9, 18, 35, 0.2) 100%)",
          zIndex: 1,
        }}
      />

      {/* Particle Canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Hero Content */}
      <div
        style={{
          position: "relative",
          zIndex: 3,
          maxWidth: "1280px",
          width: "100%",
          margin: "0 auto",
          padding: "0 2rem",
        }}
      >
        {eyebrow && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
              background: "rgba(197, 160, 72, 0.15)",
              border: "1.5px solid rgba(197, 160, 72, 0.55)",
              color: "#e5c578",
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              padding: "0.45rem 1.15rem",
              borderRadius: "999px",
              marginBottom: "1.25rem",
              backdropFilter: "blur(12px)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
            }}
          >
            <span>✦</span> {eyebrow}
          </div>
        )}

        <h1
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 900,
            fontSize: "clamp(2.4rem, 5.5vw, 4.2rem)",
            color: "#ffffff",
            lineHeight: 1.08,
            marginBottom: "0.85rem",
            letterSpacing: "-0.035em",
            textShadow: "0 4px 25px rgba(0,0,0,0.6)",
          }}
        >
          {title}
        </h1>

        {subtitle && (
          <p
            style={{
              color: "rgba(255, 255, 255, 0.88)",
              fontSize: "clamp(1rem, 1.8vw, 1.25rem)",
              lineHeight: 1.7,
              maxWidth: "680px",
              margin: 0,
              fontWeight: 400,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </header>
  );
}
