/**
 * Explicit icon registry.
 *
 * Demo content files reference icons by string name, but we import each one
 * by hand so Rollup can still tree shake. A wildcard `import * as Icons`
 * would pull the entire lucide set into every bundle.
 */
import {
  Axe,
  CalendarCheck,
  Droplets,
  Flower2,
  Fence,
  Hammer,
  Leaf,
  Layers,
  Lightbulb,
  Scissors,
  ShieldCheck,
  Shovel,
  Sparkles,
  Sprout,
  Trash2,
  TreeDeciduous,
  Truck,
  Wrench,
} from 'lucide-react'

import { ICON_NAMES } from './icon-names.js'

export const ICONS = {
  Axe,
  CalendarCheck,
  Droplets,
  Fence,
  Flower2,
  Hammer,
  Layers,
  Leaf,
  Lightbulb,
  Scissors,
  ShieldCheck,
  Shovel,
  Sparkles,
  Sprout,
  Trash2,
  TreeDeciduous,
  Truck,
  Wrench,
}

// The CLI validates industry profiles against ICON_NAMES without importing
// lucide, so the two lists have to stay in step. Fail loudly in development
// rather than silently rendering a fallback leaf for a real service.
if (import.meta.env?.DEV) {
  const missing = ICON_NAMES.filter((name) => !ICONS[name])
  if (missing.length) {
    console.error(`icon-names.js lists icons missing from icons.js: ${missing.join(', ')}`)
  }
}

export function getIcon(name) {
  return ICONS[name] || Leaf
}
