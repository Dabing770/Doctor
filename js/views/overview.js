import { mean, pct, previousRange, resample, slice, WEEK_ORDER, WEEKDAYS } from '../lib/analysis.js'
import { fmtNum, getSeries, metricDef } from '../lib/metrics.js'
import { base, chart, tokens } from '../charts.js'
import { card, delta, empty, esc, spark } from '../ui.js'

const Q = 'HKQuantityTypeIdentifier'
/** [指标, 显示方式]：mean = 区间日均，latest = 最近一次 */
const TILES = [
  [Q + 'StepCount', 'mean'],
  [Q + 'ActiveEnergyBurned', 'mean'],
  [Q + 'AppleExerciseTime', 'mean'],
  ['sleep.asleep', 'mean'],
  [Q + 'RestingHeartRate', 'mean'],
  [Q + 'HeartRateVariabilitySDNN', 'mean'],
  [Q + 'VO2Max', 'latest'],
  [Q + 'BodyMass', 'latest'],
  [Q + 'OxygenSaturation', 'mean'],
  [Q + 'RespiratoryRate', 'mean'],
  [Q + 'WalkingSpeed', 'mean'],
  [Q + 'TimeInDaylight', 'mean'],
]

export function renderOverview(root, { data, range, openMetric }) {
  const t = tokens()
  const prev = previousRange(range)
  const tiles = TILES.flatMap(([id, mode]) => {
    const def = metricDef(id, data)
    const all = getSeries(data, id)
    const cur = slice(all, range)
    if (!cur.values.length) return []
    const before = slice(all, prev)
    let value, compare, note
    if (mode === 'latest') {
      value = cur.values[cur.values.length - 1]
      compare = before.values.length ? before.values[before.values.length - 1] : NaN
      note = `最近一次 ${cur.days[cur.days.length - 1].slice(5)}`
    } else {
      value = mean(cur.values)
      compare = mean(before.values)
      note = def.agg === 'sum' ? '日均' : '平均'
    }
    const weekly = resample(slice(all, { start: '0000', end: range.end }), 'week').values.slice(-12)
    return [{ def, value, d: pct(value, compare), note, weekly }]
  })

  const tilesHtml = tiles.length
    ? `<div class="grid tiles">${tiles.map(({ def, value, d, note, weekly }) => `
        <button class="card tile" data-metric="${esc(def.id)}">
          <span class="label">${esc(def.label)} · ${note}</span>
          <span class="value">${fmtNum(value, def.decimals)}<small>${esc(def.unit)}</small></span>
          ${delta(d, def.better)}
          ${spark(weekly, t.deemph, t.series[0])}
        </button>`).join('')}</div>`
    : empty('这个时间范围内没有常见指标的数据，试试选择「全部」。')

  root.innerHTML = `
    ${tilesHtml}
    <div class="grid two section">
      ${rings(data, range)}
      ${card('一周步数节律', data.stepsByHour ? '<div id="heat" style="height:260px" role="img" aria-label="按星期和小时的平均步数热力图"></div>' : empty('没有步数数据。'), { sub: '每个时段的平均步数（全部数据）' })}
    </div>`

  root.querySelectorAll('[data-metric]').forEach((b) => b.addEventListener('click', () => openMetric(b.dataset.metric)))

  const grid = data.stepsByHour
  if (grid) {
    const b = base(t)
    const cells = []
    let max = 0
    WEEK_ORDER.forEach((w, row) => grid[w].forEach((v, h) => { cells.push([h, 6 - row, v]); max = Math.max(max, v) }))
    chart(root.querySelector('#heat'), {
      ...b,
      grid: { left: 8, right: 8, top: 8, bottom: 40, containLabel: true },
      tooltip: {
        ...b.tooltip, trigger: 'item',
        formatter: (p) => `${WEEKDAYS[WEEK_ORDER[6 - p.value[1]]]} ${p.value[0]}:00–${p.value[0] + 1}:00<br/>平均 <b>${fmtNum(p.value[2])}</b> 步`,
      },
      xAxis: { ...b.xAxisCommon, type: 'category', data: Array.from({ length: 24 }, (_, i) => String(i)), axisLine: { show: false }, axisLabel: { ...b.xAxisCommon.axisLabel, interval: 2 } },
      yAxis: { ...b.yAxisCommon, type: 'category', data: [...WEEK_ORDER].reverse().map((w) => WEEKDAYS[w]), splitLine: { show: false } },
      visualMap: {
        min: 0, max, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 120,
        inRange: { color: t.seq }, textStyle: { color: t.muted, fontSize: 11 }, text: ['多', '少'],
      },
      series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 }, emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } } }],
    })
  }
}

function rings(data, range) {
  const days = data.activity.filter((a) => a.date >= range.start && a.date <= range.end)
  if (!days.length) return card('健身记录圆环', empty('没有健身记录圆环数据（需要 Apple Watch）。'))
  const rate = (f) => (days.filter(f).length / days.length) * 100
  const rows = [
    { label: '活动（千卡）', v: rate((a) => a.moveGoal > 0 && a.move >= a.moveGoal), avg: mean(days.map((a) => a.move)), color: 'var(--series-8)' },
    { label: '锻炼（分钟）', v: rate((a) => a.exerciseGoal > 0 && a.exercise >= a.exerciseGoal), avg: mean(days.map((a) => a.exercise)), color: 'var(--series-6)' },
    { label: '站立（小时）', v: rate((a) => a.standGoal > 0 && a.stand >= a.standGoal), avg: mean(days.map((a) => a.stand)), color: 'var(--series-1)' },
  ]
  const body = `<div style="display:grid;gap:16px;margin-top:8px">
    ${rows.map((r) => `<div>
      <div style="display:flex;justify-content:space-between;font-size:13px"><span class="secondary">${r.label} · 日均 ${fmtNum(r.avg)}</span><strong>${fmtNum(r.v)}%</strong></div>
      <div class="meter"><div style="width:${r.v || 0}%;background:${r.color}"></div></div>
    </div>`).join('')}
    <p class="muted small">共 ${days.length} 天的圆环记录（需要 Apple Watch）。</p></div>`
  return card('健身记录圆环', body, { sub: '区间内达成每日目标的天数占比' })
}
