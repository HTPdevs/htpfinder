const useColor = process.stdout.isTTY && !process.env.NO_COLOR

const ESC = String.fromCharCode(27)
const paint = (code) => (text) => (useColor ? `${ESC}[${code}m${text}${ESC}[0m` : text)

export const dim = paint('2')
export const bold = paint('1')
export const green = paint('32')
export const yellow = paint('33')
export const red = paint('31')
export const cyan = paint('36')

export function info(message) {
  console.log(message)
}

export function step(message) {
  console.log(`${cyan('>')} ${message}`)
}

export function ok(message) {
  console.log(`${green('ok')}  ${message}`)
}

export function warn(message) {
  console.log(`${yellow('warn')} ${message}`)
}

export function fail(message) {
  console.error(`${red('fail')} ${message}`)
}

export function table(rows, columns) {
  if (!rows.length) return
  const widths = columns.map((col) =>
    Math.max(col.label.length, ...rows.map((row) => String(col.get(row) ?? '').length))
  )
  const line = (cells) => cells.map((cell, i) => String(cell ?? '').padEnd(widths[i])).join('  ')
  console.log(dim(line(columns.map((c) => c.label))))
  rows.forEach((row) => console.log(line(columns.map((c) => c.get(row)))))
}
