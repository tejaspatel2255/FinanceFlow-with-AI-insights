import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines multiple CSS class names safely using clsx and tailwind-merge.
 * This is the standard utility function required by Shadcn/UI.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
