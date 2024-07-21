import clsx, { ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { DateTime } from "luxon"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateString(s: string) {
  return DateTime.fromISO(s).toFormat("yyyy-MM-dd (HH:mm)")
}
