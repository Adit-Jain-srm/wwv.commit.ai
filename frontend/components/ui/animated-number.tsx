"use client";

import { useEffect, useState, useRef } from "react";

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
  useLocale?: boolean;
  animateOnMount?: boolean;
}

export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  duration = 600,
  decimals = 0,
  className = "",
  useLocale = true,
  animateOnMount = false
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(animateOnMount ? 0 : value);
  const prevValue = useRef(value);
  const hasAnimated = useRef(!animateOnMount);

  useEffect(() => {
    const start = animateOnMount && !hasAnimated.current ? 0 : prevValue.current;
    const end = value;
    prevValue.current = value;
    if (animateOnMount) hasAnimated.current = true;

    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - (1 - progress) ** 2;
      const current = start + (end - start) * eased;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [value, duration, animateOnMount]);

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : useLocale
      ? Math.round(display).toLocaleString()
      : Math.round(display).toString();

  return (
    <span className={className} suppressHydrationWarning>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
