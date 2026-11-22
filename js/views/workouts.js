import { dayNum, mean } from '../lib/analysis.js'
import { fmtDuration, fmtNum, workoutLabel } from '../lib/metrics.js'
import { base, chart, dotHtml, tokens } from '../charts.js'
import { card, empty, esc, legend, statCard } from '../ui.js'

const toKm = (w) => (w.distanceUnit === 'mi' ? (w.distance ?? 0) * 1.609 : w.distanceUnit === 'm' ? (w.distance ?? 0) / 1000 : (w.distance ?? 0))

export function renderWorkouts(root, { data, range }) {
  const t = tokens()
  const list = data.workouts.filter((w) => w.date >= range.start && w.date <= range.end)
  if (!list.length) { root.innerHTML = empty('这个时间范围内没有体能训练记录。'); return }

  // 颜色跟随运动类型（按全部数据的频次固定），不随时间范围变化
  const cnt = new Map()
  for (const w of data.workouts) cnt.set(w.type, (cnt.get(w.type) ?? 0) + 1)
  const topTypes = [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k]) => k)
  const colorOf = (type) => { const i = topTypes.indexOf(type); return i >= 0 ? t.series[i] : t.deemph }

  const byType = new Map()
  for (const w of list) byType.set(w.type, [...(byType.get(w.type) ?? []), w])
  const types = [...byType].sort((a, b) => b[1].length - a[1].length)

  // 按周（≤120 天）或按月汇总时长
  const spanDays = dayNum(range.end) - dayNum(range.start) + 1
  const weekly = spanDays <= 120
  const key = (d) => {
    if (!weekly) return d.slice(0, 7)
    const n = dayNum(d)
    const w = (new Date(n * 86400000).getUTCDay() + 6) % 7
    return new Date((n - w) * 86400000).toISOString().slice(5, 10)
  }
  const buckets = []
  for (let n = dayNum(range.start); n <= dayNum(range.end); n++) {
    const k = key(new Date(n * 86400000).toISOString().slice(0, 10))
    if (buckets[buckets.length - 1] !== k) buckets.push(k)
  }
  const groups = [...topTypes.filter((tp) => list.some((w) => w.type === tp)), ...(list.some((w) => !topTypes.includes(w.type)) ? ['__other'] : [])]
  const stacks = groups.map((g) => ({ g, label: g === '__other' ? '其他' : workoutLabel(g), color: g === '__other' ? t.deemph : colorOf(g), vals: buckets.map(() => 0) }))
  for (const w of list) {
    const g = topTypes.includes(w.type) ? w.type : '__other'
    stacks.find((x) => x.g === g).vals[buckets.indexOf(key(w.date))] += w.duration
  }

  const weeks = spanDays / 7
  const totalMin = list.reduce((s, w) => s + w.duration, 0)
  const totalKm = list.reduce((s, w) => s + toKm(w), 0)
  const totalKcal = list.reduce((s, w) => s + (w.energy ?? 0), 0)

  const typeRows = types.map(([type, ws]) => {
    const hr = mean(ws.filter((w) => w.avgHR).map((w) => w.avgHR))
    const dist = ws.reduce((s, w) => s + (w.distance ?? 0), 0)
    return `<tr>
      <td><span class="dot" style="background:${colorOf(type)};margin-right:8px"></span>${esc(workoutLabel(type))}</td>
      <td class="num">${ws.length}</td>
      <td class="num">${fmtNum(ws.reduce((s, w) => s + w.duration, 0) / 60, 1)} h</td>
      <td class="num">${fmtNum(mean(ws.map((w) => w.duration)))} 分</td>
      <td class="num">${Number.isFinite(hr) ? fmtNum(hr) : '—'}</td>
      <td class="num">${dist ? `${fmtNum(dist, 1)} ${esc(ws.find((w) => w.distanceUnit)?.distanceUnit ?? '')}` : '—'}</td>
    </tr>`
  }).join('')

  const recentRows = [...list].reverse().slice(0, 100).map((w) => {
    const pace = w.distance && w.distanceUnit === 'km' && /Running|Walking|Hiking/.test(w.type) ? w.duration / w.distance : NaN
    let paceTxt = '—'
    if (Number.isFinite(pace)) {
      const total = Math.round(pace * 60)
      paceTxt = `${Math.floor(total / 60)}′${String(total % 60).padStart(2, '0')}″/km`
    }
    return `<tr>
      <td>${esc(w.start)}</td><td>${esc(workoutLabel(w.type))}</td>
      <td class="num">${fmtNum(w.duration)} 分</td>
      <td class="num">${w.distance ? `${fmtNum(w.distance, 2)} ${esc(w.distanceUnit ?? '')}` : '—'}</td>
      <td class="num">${paceTxt}</td>
      <td class="num">${w.avgHR ? fmtNum(w.avgHR) : '—'}</td>
    </tr>`
  }).join('')

  root.innerHTML = `
    <div class="grid tiles">
      ${statCard('训练次数', `${list.length} 次`)}
      ${statCard('每周平均', `${fmtNum(list.length / weeks, 1)} 次 · ${fmtNum(totalMin / weeks)} 分钟`)}
      ${statCard('总时长', fmtDuration(totalMin))}
      ${statCard('总距离', `${fmtNum(totalKm, 1)} km`)}
      ${statCard('消耗能量', `${fmtNum(totalKcal)} 千卡`)}
    </div>
    <div class="section">
      ${card(weekly ? '每周训练时长' : '每月训练时长', '<div id="wchart" style="height:280px" role="img" aria-label="训练时长堆叠柱状图"></div>',
        { sub: '按运动类型堆叠', right: legend(stacks) })}
    </div>
    <div class="grid two section">
      ${card('按类型汇总', `<div class="table-wrap"><table>
        <thead><tr><th>类型</th><th class="num">次数</th><th class="num">总时长</th><th class="num">平均时长</th><th class="num">平均心率</th><th class="num">总距离</th></tr></thead>
        <tbody>${typeRows}</tbody></table></div>`)}
      ${card('最近的训练', `<div class="table-wrap" style="max-height:360px;overflow-y:auto"><table>
        <thead><tr><th>时间</th><th>类型</th><th class="num">时长</th><th class="num">距离</th><th class="num">配速</th><th class="num">心率</th></tr></thead>
        <tbody>${recentRows}</tbody></table></div>`)}
    </div>`

  const b = base(t)
  chart(root.querySelector('#wchart'), {
    ...b,
    tooltip: {
      ...b.tooltip, axisPointer: { type: 'shadow' },
      formatter: (ps) => `<b>${weekly ? ps[0].axisValue + ' 这周' : ps[0].axisValue}</b>` + ps.filter((p) => p.value > 0).map((p) => `<br/>${dotHtml(p.color, true)}${p.seriesName} ${fmtDuration(p.value)}`).join(''),
    },
    xAxis: { ...b.xAxisCommon, type: 'category', data: buckets },
    yAxis: { ...b.yAxisCommon, type: 'value', axisLabel: { ...b.yAxisCommon.axisLabel, formatter: (v) => `${fmtNum(v / 60, v % 60 ? 1 : 0)}h` } },
    series: stacks.map((s, i) => ({
      name: s.label, type: 'bar', stack: 'w', data: s.vals, barMaxWidth: 24,
      itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 1, borderRadius: i === stacks.length - 1 ? [4, 4, 0, 0] : 0 },
    })),
  })
}
