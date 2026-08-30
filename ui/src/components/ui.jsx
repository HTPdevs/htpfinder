/**
 * Shared primitives.
 *
 * Small enough to live in one file, which keeps the screens readable and makes
 * it obvious when something is a one off rather than a pattern.
 */

import clsx from 'clsx'
import { AlertTriangle, Check, Loader2, X } from 'lucide-react'

export function Button({ variant = 'default', className, loading, children, ...props }) {
  const variants = {
    primary: 'bg-signal text-ink hover:bg-signal-light',
    default: 'border border-ink-line bg-ink-panel text-text hover:border-text-faint',
    quiet: 'text-text-muted hover:text-text',
    danger: 'border border-alert/40 text-alert hover:bg-alert/10',
  }

  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-panel px-3 py-2 text-sm font-medium',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        className
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="eyebrow mb-1.5 block">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-text-faint">{hint}</span>}
    </label>
  )
}

const control =
  'w-full rounded-panel border border-ink-line bg-ink px-3 py-2 text-sm text-text ' +
  'placeholder:text-text-faint focus:border-signal'

// className is merged rather than spread over, so passing one adjusts these
// styles instead of silently replacing them and leaving a native control.
export function Input({ className, ...props }) {
  return <input className={clsx(control, className)} {...props} />
}

export function Select({ children, className, ...props }) {
  return (
    <select className={clsx(control, 'appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({ label, hint, ...props }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        className="mt-0.5 size-4 rounded border-ink-line bg-ink accent-signal"
        {...props}
      />
      <span>
        <span className="block text-sm text-text">{label}</span>
        {hint && <span className="block text-xs text-text-faint">{hint}</span>}
      </span>
    </label>
  )
}

/**
 * The signature element.
 *
 * Shows the command this action runs, before it runs. Someone who does not use
 * a terminal gets to see what the button actually does, which is the difference
 * between a tool that hides the machinery and one that explains it.
 */
export function Command({ children, className }) {
  return (
    <div className={clsx('command-line', className)}>
      <code className="command flex-1 break-all text-text">{children}</code>
    </div>
  )
}

/**
 * A prospect's score, as a meter.
 *
 * The one number this tool produces. Now that the accent is used throughout,
 * what makes this read at a glance in a dense table is the meter form rather
 * than the colour.
 */
export function Score({ value }) {
  if (value == null) return <span className="font-mono text-sm text-text-faint">&mdash;</span>

  return (
    <span className="flex items-center gap-2">
      <span className="font-mono text-sm tabular-nums text-text">{String(value).padStart(2, '0')}</span>
      <span className="h-1 w-10 overflow-hidden rounded-full bg-ink-line" aria-hidden="true">
        <span
          className="block h-full rounded-full bg-signal"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </span>
    </span>
  )
}

/**
 * Progress reads as it goes: neutral before any research, the accent once there
 * is something to show, then green once it has left the building. Contacted is
 * the only one that is an outcome rather than a stage, which is why it is the
 * only one that changes hue.
 */
const STATUS_TONES = {
  collected: 'text-text-muted border-ink-line',
  enriched: 'text-signal border-signal/40',
  built: 'text-signal border-signal/40 bg-signal-wash',
  contacted: 'text-ok border-ok/40 bg-ok-wash',
  rejected: 'text-text-faint border-ink-line line-through',
}

export function Status({ value }) {
  return (
    <span
      className={clsx(
        'inline-block rounded-full border px-2 py-0.5 font-mono text-micro uppercase tracking-wider',
        STATUS_TONES[value] || STATUS_TONES.collected
      )}
    >
      {value}
    </span>
  )
}

export function Note({ tone = 'info', title, children }) {
  // `good` is green rather than the accent, because it sits next to `warn` and
  // two amber notes would be one note.
  const tones = {
    info: 'border-ink-line text-text-muted',
    good: 'border-ok/30 bg-ok-wash text-text',
    warn: 'border-signal/30 bg-signal-dim text-text',
    bad: 'border-alert/30 bg-alert/10 text-text',
  }
  const icons = { info: null, good: Check, warn: AlertTriangle, bad: X }
  const Icon = icons[tone]

  return (
    <div className={clsx('flex gap-2.5 rounded-panel border p-3 text-sm', tones[tone])}>
      {Icon && <Icon size={15} className="mt-0.5 shrink-0" />}
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium text-text">{title}</p>}
        {children && <div className={clsx(title && 'mt-1', 'text-sm')}>{children}</div>}
      </div>
    </div>
  )
}

export function Empty({ title, children, action }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <p className="font-display text-lg text-text">{title}</p>
      {children && <div className="max-w-md text-sm text-text-muted">{children}</div>}
      {action}
    </div>
  )
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div className="flex items-center gap-2 px-1 py-8 text-sm text-text-muted">
      <Loader2 size={15} className="animate-spin" />
      {label}
    </div>
  )
}

/** A dense data table. Columns take `{ label, get, className }`. */
export function Table({ columns, rows, onRowClick, empty }) {
  if (!rows.length) return empty || null

  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-ink-line">
            {columns.map((column) => (
              <th key={column.label} className={clsx('eyebrow px-4 py-2.5 font-normal', column.className)}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.slug || row.id || index}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(
                'border-b border-ink-line/60 last:border-0',
                onRowClick && 'cursor-pointer hover:bg-ink-hover'
              )}
            >
              {columns.map((column) => (
                <td key={column.label} className={clsx('px-4 py-3 text-sm', column.className)}>
                  {column.get(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
