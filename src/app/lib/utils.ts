import clsx, { ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DateTime } from "luxon"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateString(value: string | Date) {
  const date = value instanceof Date ? DateTime.fromJSDate(value) : DateTime.fromISO(value)
  return date.isValid ? date.toFormat("dd LLL yyyy") : "Unknown date"
}
