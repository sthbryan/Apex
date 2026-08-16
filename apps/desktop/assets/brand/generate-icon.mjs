import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SIZE = 1024
const PLATE = '#0C0D10'
const VARIANTS = {
  amber: '#E8A33D',
  blue: '#4A9EFF',
}

function squirclePath(size, n = 5, samples = 256) {
  const r = size / 2
  const pts = []
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI * 2
    const c = Math.cos(t)
    const s = Math.sin(t)
    pts.push([
      r + r * Math.sign(c) * Math.abs(c) ** (2 / n),
      r + r * Math.sign(s) * Math.abs(s) ** (2 / n),
    ])
  }
  return `${pts.map(([x, y], i) => `${i ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')} Z`
}

function diamond(half) {
  const c = SIZE / 2
  return `M ${c} ${c - half} L ${c + half} ${c} L ${c} ${c + half} L ${c - half} ${c} Z`
}

const outer = SIZE * 0.275
const stroke = SIZE * 0.075

function render(accent) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}" fill="none">
  <defs>
    <clipPath id="plate">
      <path d="${squirclePath(SIZE, 5)}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#plate)">
    <rect width="${SIZE}" height="${SIZE}" fill="${PLATE}"/>
    <path d="${diamond(outer)}" fill="none" stroke="${accent}" stroke-width="${stroke.toFixed(2)}" stroke-linejoin="miter"/>
    <path d="${diamond(outer * 0.28)}" fill="${accent}"/>
  </g>
</svg>
`
}

const dir = dirname(fileURLToPath(import.meta.url))
for (const [name, accent] of Object.entries(VARIANTS)) {
  const out = join(dir, `apex-icon-${name}.svg`)
  writeFileSync(out, render(accent))
  console.log(`wrote ${out}`)
}
