import { icons, type LucideIcon } from 'lucide-react';

/**
 * Resolve a Lucide icon component by its name string.
 * Returns undefined when the name doesn't match any known icon.
 */
export function getLucideIcon(name: string | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  return (icons as Record<string, LucideIcon>)[name];
}
