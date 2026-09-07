'use client';

import { useRef, useEffect, useState, type ElementType, type ReactNode, type HTMLAttributes } from 'react';

interface FadeInProps extends HTMLAttributes<HTMLElement> {
  delay?: number;
  as?: ElementType;
  children: ReactNode;
}

export default function FadeIn({
  delay = 0,
  as: Component = 'div',
  className = '',
  children,
  ...rest
}: FadeInProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    setMounted(true);

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) {
      setVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) {
      setVisible(true);
      return;
    }

    // If element top is well within the viewport on mount (top 75%), show
    // immediately with no animation — it was visible from SSR, animating
    // would flash it invisible. Elements near the bottom edge or below
    // the fold should still animate on scroll.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.75 && rect.bottom > 0) {
      setVisible(true);
      return;
    }

    // Far below the fold (past 2x viewport): never hide it. A blank panel is
    // worse than a missed animation, and on short/mobile viewports the
    // observer's rootMargin can fail to fire before first paint.
    if (rect.top > window.innerHeight * 2) {
      setVisible(true);
      return;
    }

    // Only fold-adjacent elements animate: hide until scrolled into view
    setShouldAnimate(true);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      // rootMargin must reach the SAME 2x-viewport boundary as the never-hide
      // check above, or blocks in the band between them animate but the observer
      // can never fire for them — a permanent blank panel until the user scrolls.
      { threshold: 0, rootMargin: `${window.innerHeight}px 0px` }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const staggerClass = delay > 0 ? `stagger-${Math.min(Math.ceil(delay / 80), 3)}` : '';

  // Before hydration: render fully visible (matches SSR output)
  if (!mounted) {
    return (
      <Component ref={ref} className={className} {...rest}>
        {children}
      </Component>
    );
  }

  // After hydration: only animate elements that were off-screen on mount
  if (shouldAnimate) {
    return (
      <Component
        ref={ref}
        className={`${className} ${visible ? `animate-fade-up ${staggerClass}`.trim() : ''}`.trim()}
        style={!visible ? { opacity: 0 } : undefined}
        {...rest}
      >
        {children}
      </Component>
    );
  }

  // In-viewport on mount: no animation, just show
  return (
    <Component ref={ref} className={className} {...rest}>
      {children}
    </Component>
  );
}
