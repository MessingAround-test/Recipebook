import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function safeToObject(obj: any) {
  if (obj && typeof obj.toObject === 'function') {
    return obj.toObject();
  }
  return obj;
}
