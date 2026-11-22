import { mean, std, weekdayOf, WEEK_ORDER, WEEKDAYS } from '../lib/analysis.js'
import { fmtClock, fmtDuration, fmtNum } from '../lib/metrics.js'
import { base, chart, dotHtml, tokens } from '../charts.js'
import { card, dataTable, empty, legend, statCard } from '../ui.js'

/** 时间轴从前一天 18:00 开始，避免负数 */
const SHIFT = 360

export function renderSleep(root, { data, range }) {
  const t = tokens()
  const nights = data.sleep.filter((n) => n.date >= range.start && n.date <= range.end && n.asleep > 0)
  if (!nights.length) {
    root.innerHTML = empty('这个时间范围内没有睡眠数据。睡眠分期需要 Apple Watch 佩戴入睡（watchOS 9 及以上）。')
    return
  }
  const staged = nights.filter((n) => n.hasStages)
  const stages = [
    { key: 'deep', label: '深度', color: t.seq[3] },
    { key: 'core', label: '核心', color: t.seq[2] },
    { key: 'rem', label: '快速动眼', color: t.seq[1] },
    { key: 'unspecified', label: '睡眠（未分期）', color: t.deemph },
    { key: 'awake', label: '清醒', color: t.series[1] },
  ].filter((s) => nights.some((n) => n[s.key] > 0))

  const avg = mean(nights.map((n) => n.asleep))
  const short = nights.filter((n) => n.asleep < 420).length / nights.length
  const bedSd = std(nights.map((n) => n.bedtime))
  const deepPct = staged.length ? mean(staged.map((n) => n.deep / n.asleep)) * 100 : NaN
  const remPct = staged.length ? mean(staged.map((n) => n.rem / n.asleep)) * 100 : NaN
  const eff = mean(nights.filter((n) => n.inBed > 0).map((n) => Math.min(1, n.asleep / n.inBed))) * 100

  root.innerHTML = `
    <div class="grid tiles">
      ${statCard('平均睡眠', fmtDuration(avg))}
      ${statCard('平均入睡 / 醒来', `${fmtClock(mean(nights.map((n) => n.bedtime)))} / ${fmtClock(mean(nights.map((n) => n.wake)))}`)}
      ${statCard('不足 7 小时的夜晚', `${fmtNum(short * 100)}%`)}
      ${statCard('入睡时间波动（标准差）', `±${fmtNum(bedSd)} 分钟`)}
      ${statCard('深度 / 快速动眼占比', `${fmtNum(deepPct)}% / ${fmtNum(remPct)}%`)}
      ${statCard('睡眠效率（睡眠 ÷ 卧床）', Number.isFinite(eff) ? `${fmtNum(eff)}%` : '—')}
    </div>
    <div class="section">
      ${card('每晚睡眠分期',
        `<div id="stages" style="height:300px" role="img" aria-label="每晚睡眠分期堆叠柱状图"></div>
         ${dataTable(['日期', '入睡', '醒来', '睡眠', '深度', '核心', '快速动眼', '清醒', '来源'],
           [...nights].reverse().map((n) => [n.date, fmtClock(n.bedtime), fmtClock(n.wake), fmtDuration(n.asleep), n.deep, n.core, n.rem, n.awake, n.source]))}`,
        { sub: `共 ${nights.length} 晚 · 日期为醒来当天`, right: legend(stages) })}
    </div>
    <div class="grid two section">
      ${card('作息时间', '<div id="clock" style="height:280px" role="img" aria-label="每晚入睡与醒来时间"></div>', { sub: '每条竖条从入睡到醒来' })}
      ${card('星期规律', '<div id="swd" style="height:280px" role="img" aria-label="按星期的平均睡眠时长"></div>', { sub: '按醒来那天统计的平均睡眠时长' })}
    </div>`

  const b = base(t)
  const zoom = nights.length > 120 ? [{ type: 'inside' }] : []
  const dates = nights.map((n) => n.date)

  chart(root.querySelector('#stages'), {
    ...b,
    tooltip: {
      ...b.tooltip, axisPointer: { type: 'shadow' },
      formatter: (ps) => `<b>${ps[0].axisValue}</b>` + ps.filter((p) => p.value > 0).map((p) => `<br/>${dotHtml(p.color, true)}${p.seriesName} ${fmtDuration(p.value)}`).join(''),
    },
    xAxis: { ...b.xAxisCommon, type: 'category', data: dates },
    yAxis: { ...b.yAxisCommon, type: 'value', interval: 120, axisLabel: { ...b.yAxisCommon.axisLabel, formatter: (v) => `${v / 60}h` } },
    dataZoom: zoom,
    series: stages.map((s, i) => ({
      name: s.label, type: 'bar', stack: 'sleep', data: nights.map((n) => n[s.key]), barMaxWidth: 24,
      itemStyle: { color: s.color, borderColor: t.surface, borderWidth: nights.length > 90 ? 0 : 1, borderRadius: i === stages.length - 1 ? [4, 4, 0, 0] : 0 },
    })),
  })

  chart(root.querySelector('#clock'), {
    ...b,
    tooltip: {
      ...b.tooltip, axisPointer: { type: 'shadow' },
      formatter: (ps) => {
        const n = nights[ps[0].dataIndex]
        return `<b>${n.date}</b><br/>入睡 ${fmtClock(n.bedtime)} → 醒来 ${fmtClock(n.wake)}<br/>睡眠 ${fmtDuration(n.asleep)}`
      },
    },
    xAxis: { ...b.xAxisCommon, type: 'category', data: dates },
    yAxis: {
      ...b.yAxisCommon, type: 'value', inverse: true, interval: 120,
      min: (v) => Math.floor(v.min / 120) * 120, max: (v) => Math.ceil(v.max / 120) * 120,
      axisLabel: { ...b.yAxisCommon.axisLabel, formatter: (v) => fmtClock(v - SHIFT) },
    },
    dataZoom: zoom,
    series: [
      { type: 'bar', stack: 'c', data: nights.map((n) => n.bedtime + SHIFT), itemStyle: { color: 'transparent' }, barMaxWidth: 24, silent: true },
      { name: '睡眠时段', type: 'bar', stack: 'c', data: nights.map((n) => n.wake - n.bedtime), itemStyle: { color: t.series[0], borderRadius: 4 }, barMaxWidth: 24 },
    ],
  })

  const sum = Array(7).fill(0), cnt = Array(7).fill(0), bed = Array(7).fill(0)
  for (const n of nights) { const w = weekdayOf(n.date); sum[w] += n.asleep; bed[w] += n.bedtime; cnt[w]++ }
  const wd = WEEK_ORDER.map((w) => ({ w, asleep: cnt[w] ? sum[w] / cnt[w] : NaN, bed: cnt[w] ? bed[w] / cnt[w] : NaN }))
  chart(root.querySelector('#swd'), {
    ...b,
    tooltip: { ...b.tooltip, axisPointer: { type: 'shadow' }, formatter: (ps) => { const r = wd[ps[0].dataIndex]; return `<b>醒来于${WEEKDAYS[r.w]}</b><br/>平均睡眠 ${fmtDuration(r.asleep)}<br/>平均入睡 ${fmtClock(r.bed)}` } },
    xAxis: { ...b.xAxisCommon, type: 'category', data: wd.map((r) => WEEKDAYS[r.w]) },
    yAxis: { ...b.yAxisCommon, type: 'value', min: (v) => Math.max(0, Math.floor(v.min / 60 - 1) * 60), interval: 60, axisLabel: { ...b.yAxisCommon.axisLabel, formatter: (v) => `${v / 60}h` } },
    series: [{ type: 'bar', data: wd.map((r) => r.asleep), barMaxWidth: 24, itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] } }],
  })
}
