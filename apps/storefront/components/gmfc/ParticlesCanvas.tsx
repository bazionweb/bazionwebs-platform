"use client";

import { useEffect, useRef } from "react";

export function ParticlesCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const particles: Particle[] = [];
    let animationFrameId = 0;

    const resizeCanvas = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };

    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    const shapes = ["circle", "cross", "diamond"] as const;

    class Particle {
      x = 0;
      y = 0;
      size = 3;
      speed = 0.8;
      opacity = 0.3;
      shape: (typeof shapes)[number] = "circle";
      angle = 0;
      swing = 0.2;

      constructor() {
        this.reset();
        this.y = Math.random() * (canvas?.height ?? 600);
      }

      reset() {
        const w = canvas?.width || 1200;
        const h = canvas?.height || 600;
        this.x = Math.random() * w;
        this.y = h + 50;
        this.size = Math.random() * 4 + 2;
        this.speed = Math.random() * 1 + 0.5;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.shape = shapes[Math.floor(Math.random() * shapes.length)] ?? "circle";
        this.angle = Math.random() * Math.PI * 2;
        this.swing = Math.random() * 0.5 + 0.1;
      }

      update() {
        this.y -= this.speed;
        this.x += Math.sin(this.angle) * this.swing;
        this.angle += 0.02;
        if (this.y < -50) {
          this.reset();
        }
      }

      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle * 0.2);
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = "#D9A857";

        if (this.shape === "circle") {
          ctx.beginPath();
          ctx.arc(0, 0, this.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (this.shape === "diamond") {
          ctx.beginPath();
          ctx.moveTo(0, -this.size);
          ctx.lineTo(this.size, 0);
          ctx.lineTo(0, this.size);
          ctx.lineTo(-this.size, 0);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.rect(-this.size / 4, -this.size, this.size / 2, this.size * 2);
          ctx.rect(-this.size, -this.size / 4, this.size * 2, this.size / 2);
          ctx.fill();
        }

        ctx.restore();
      }
    }

    const particleCount = Math.min(Math.floor(canvas.width / 15), 100);
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return <canvas ref={canvasRef} className="gmfci-particles-canvas" />;
}

export default ParticlesCanvas;

