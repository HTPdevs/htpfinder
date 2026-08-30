import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/** plural(1, 'review') -> "1 review"; plural(12, 'review') -> "12 reviews" */
export function plural(count, word, suffix = 's') {
  return `${count} ${word}${Number(count) === 1 ? '' : suffix}`
}

/** "(503) 839-8283" -> "tel:+15038398283". Returns null when no phone is on file. */
export function telHref(phone) {
  if (!phone) return null
  // NANP area codes never start with 1, so a leading 1 is always a country code.
  const digits = phone.replace(/\D/g, '').replace(/^1/, '')
  return digits.length === 10 ? `tel:+1${digits}` : null
}
