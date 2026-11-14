"use client";

import { useEffect, useState } from "react";

export interface AnimatedWordRotatorProps {
  words: string[];
  defaultWord?: string | undefined;
}

export function AnimatedWordRotator({ words, defaultWord }: AnimatedWordRotatorProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!words || words.length <= 1) return;
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % words.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [words]);

  if (!words || words.length === 0) {
    return defaultWord ? <span>{defaultWord}</span> : null;
  }

  return (
    <span className="gmfci-word-rotator gmfci-highlight" aria-live="polite">
      {words.map((word, i) => {
        const isCurrent = i === index;
        const isPrevious = i === (index - 1 + words.length) % words.length;
        const stateClass = isCurrent ? "active" : isPrevious ? "exit" : "";
        return (
          <span key={`${word}-${i}`} className={`gmfci-word ${stateClass}`}>
            {word}
          </span>
        );
      })}
    </span>
  );
}
