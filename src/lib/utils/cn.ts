import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind class names.
 *
 * `clsx` resolves the conditionals; `twMerge` then resolves conflicts by
 * keeping the last utility of each family, so a component's default
 * (`px-4`) can be overridden by a caller's prop (`px-2`) instead of both
 * landing in the class list and the outcome depending on CSS source order.
 *
 * Every shadcn/ui component expects this helper at this path.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
