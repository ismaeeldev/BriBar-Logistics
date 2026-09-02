import { UI } from '@/lib/i18n/messages';
import { cn } from '@/lib/utils/cn';

/**
 * The BRIBAR mark and lockup.
 *
 * Rendered as a CSS mask rather than an `<img>`, so the artwork takes
 * `currentColor` and works on both themes from one file. The supplied logo is a
 * solid navy PNG on white: dropped in directly it would sit in a white box on
 * the dark theme, and recolouring it would mean shipping a second asset that
 * can drift from the first.
 *
 * The mask files are alpha-only renders extracted from `public/logo.png` —
 * `logo-mark.png` is the BL road glyph, `logo-lockup.png` the glyph with the
 * wordmark beneath it.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={UI.common.appName}
      className={cn('inline-block shrink-0 bg-current', className)}
      style={{
        WebkitMaskImage: 'url(/logo-mark.png)',
        maskImage: 'url(/logo-mark.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}

export function LogoLockup({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label={UI.common.appName}
      className={cn('inline-block shrink-0 bg-current', className)}
      style={{
        WebkitMaskImage: 'url(/logo-lockup.png)',
        maskImage: 'url(/logo-lockup.png)',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
