// 小型 HTML 片段生成函数
import { fmtNum } from './lib/metrics.js'

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

export function delta(value, better, label = '较上一周期') {
  if (!Number.isFinite(value)) return `<span class="delta">${label}：无对比数据</span>`
  const up = value > 0
  const flat = Math.abs(value) < 0.05
  const cls = flat || !better ? '' : up === (better === 'up') ? 'up-good' : 'up-bad'
  return `<span class="delta"><span class="${cls}">${flat ? '持平' : `${up ? '▲' : '▼'} ${fmtNum(Math.abs(value), 1)}%`}</span> ${label}</span>`
}

export function card(title, body, { sub = '', right = '', id = '' } = {}) {
  return `<section class="card"${id ? ` id="${id}"` : ''}>
    <div class="card-head"><div><h2>${title}</h2>${sub ? `<p>${sub}</p>` : ''}</div>${right}</div>
    ${body}
  </section>`
}

export const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`
export const statCard = (k, v) => `<div class="card">${stat(k, v)}</div>`

export function dataTable(head, rows, summary = '查看数据表') {
  return `<details class="data-table"><summary>${summary}（${rows.length} 行）</summary>
    <div class="table-wrap"><table>
      <thead><tr>${head.map((h, i) => `<th class="${i ? 'num' : ''}">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c, j) => `<td class="${j ? 'num' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div></details>`
}

export function legend(items) {
  return `<div class="legend">${items.map((it) => `<span><i class="${it.line ? 'line' : ''}" style="background:${it.color}"></i>${esc(it.label)}</span>`).join('')}</div>`
}

export const empty = (text) => `<p class="muted small" style="padding:24px 0;text-align:center">${text}</p>`

export function spark(values, color, accent) {
  if (values.length < 2) return ''
  const w = 160, h = 30, pad = 4
  const lo = Math.min(...values), hi = Math.max(...values)
  const x = (i) => pad + (i / (values.length - 1)) * (w - pad * 2)
  const y = (v) => (hi === lo ? h / 2 : h - pad - ((v - lo) / (hi - lo)) * (h - pad * 2))
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
  const li = values.length - 1
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true" style="margin-top:6px">
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${x(li)}" cy="${y(values[li])}" r="3.5" fill="${accent}"/></svg>`
}

export function statusIcon(kind, small) {
  const map = { good: ['var(--good)', '✓', '#fff', '积极'], warning: ['var(--warning)', '!', '#0b0b0b', '注意'], info: ['var(--accent)', 'i', '#fff', '信息'] }
  const [bg, ch, fg, label] = map[kind]
  const s = small ? 14 : 18
  return `<span class="status-icon" aria-label="${label}" style="background:${bg};color:${fg};width:${s}px;height:${s}px;font-size:${small ? 9 : 11}px">${ch}</span>`
}
