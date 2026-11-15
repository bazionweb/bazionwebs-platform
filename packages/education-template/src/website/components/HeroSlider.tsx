"use client";

import { useState, useEffect } from "react";

export default function HeroSlider({ images, title, subtitle, primaryAction, secondaryAction }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % images.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [images]);

  return (
    <header className="relative w-full h-[100vh] min-h-[600px] flex items-center justify-center text-center overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full -z-20">
        {images.map((src, index) => (
          <div
            key={src}
            className={`absolute top-0 left-0 w-full h-full bg-cover bg-center transition-opacity duration-1000 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
            style={{ backgroundImage: `url('${src}')` }}
          />
        ))}
      </div>
      
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[#0f172a]/40 to-[#0f172a]/80 -z-10" />

      <div className="max-w-[800px] px-8 z-10 animate-fade-in">
        <h1 className="text-white text-[clamp(2.5rem,5vw,4.5rem)] font-outfit font-bold mb-6 drop-shadow-lg leading-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-white text-[clamp(1.1rem,2vw,1.5rem)] font-light mb-10 opacity-90">
            {subtitle}
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {primaryAction && (
            <a href={primaryAction.href} className="btn btn-primary">
              {primaryAction.label}
            </a>
          )}
          {secondaryAction && (
            <a href={secondaryAction.href} className="btn btn-outline">
              {secondaryAction.label}
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
