'use client';

import { useEffect, useLayoutEffect, useRef } from 'react';

import { NUMBER_LOCALE } from '@/lib/i18n/messages';

/**
 * `useLayoutEffect` runs after commit but *before* the browser paints, which is
 * the whole point here: the count has to be seeded at zero in the same frame
 * the element first appears, or the reader sees the final figure for one frame
 * and then watches it drop. On the server there is no layout pass and React
 * warns about the hook, so it falls back to `useEffect` — which never runs
 * there anyway.
 */
const useBeforePaint = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * A headline figure that counts up to its value once, on first paint.
 *
 * Not decoration for its own sake: a number that moves is a number the eye
 * lands on, and a dashboard's job is to put the figures that matter in front of
 * someone before they start reading. It runs for well under a second and then
 * never again, so it stops competing for attention immediately.
 *
 * Three things keep it honest:
 *
 *   - the real value is what the server renders and what stays in the DOM if
 *     the effect never runs, so a reader with JavaScript off, a screen reader,
 *     and a find-in-page all get the number rather than a zero;
 *   - `prefers-reduced-motion` skips the count entirely — this is exactly the
 *     kind of movement that setting exists to refuse;
 *   - the easing is the `out-expo` curve everything else on the page
 *     decelerates on, so it belongs to the same system.
 *
 * The frames are written straight to `textContent` rather than through state.
 * Forty re-renders a second to change a string inside one `<span>` is work
 * React does not need to do, and it keeps the animation out of the render path
 * entirely.
 */
export function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useBeforePaint(() => {
    const element = ref.current;
    if (!element) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Leave the server-rendered text exactly as it is.
    if (reduced || value === 0) return;

    const duration = 620;
    let raf = 0;
    let start = 0;

    const step = (now: number) => {
      if (start === 0) start = now;
      const progress = Math.min(1, (now - start) / duration);
      // The `--ease-out-expo` curve, in one line.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      element.textContent = Math.round(value * eased).toLocaleString(NUMBER_LOCALE);
      if (progress < 1) raf = requestAnimationFrame(step);
    };

    element.textContent = '0';
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      // Whatever interrupted the count, the correct number is what stays.
      element.textContent = value.toLocaleString(NUMBER_LOCALE);
    };
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {value.toLocaleString(NUMBER_LOCALE)}
    </span>
  );
}
