import {
  mean, median, pct, previousRange, resample, rolling, slice, trendPer30, weekdayMeans, WEEK_ORDER, WEEKDAYS,
} from '../lib/analysis.js'
import { availableMetrics, fmtNum, getSeries, metricDef } from '../lib/metrics.js'
import { base, chart, dotHtml, tokens } from '../charts.js'
import { card, dataTable, delta, empty, esc, legend, stat } from '../ui.js'

let grain = 'day'

const tick = (v) => (Math.abs(v) >= 10000 ? v / 1000 + 'K' : (+v.toFixed(4)).toLocaleString('zh-CN', { maximumFractionDigits: 4 }))

export function renderTrends(root, { data, range, metric, setMetric, rerender }) {
  const t = tokens()
  const metrics = availableMetrics(data)
  if (!metrics.length) { root.innerHTML = empty('没有可以显示的指标。'); return }
  const id = metrics.some((m) => m.id === metric) ? metric : metrics[0].id
  const def = metricDef(id, data)
  const groups = new Map()
  for (const m of metrics) groups.set(m.group, [...(groups.get(m.group) ?? []), m])

  const all = getSeries(data, id)
  const cur = slice(all, range)
  const shown = resample(cur, grain)
  const avg7 = rolling(cur, 7)
  const prev = slice(all, previousRange(range))
  const d = def.decimals
  const unit = def.unit
  const per = grain === 'day' ? '' : def.agg === 'sum' ? '（日均）' : '（平均）'
  const hasBand = grain === 'day' && !!cur.min && def.agg === 'avg' && cur.min.some((v, i) => v !== cur.max[i])
  const isBar = def.agg === 'sum' && (grain !== 'day' || shown.days.length <= 120)

  const controls = `<div class="toolbar">
    <select id="metric" aria-label="选择指标">
      ${[...groups].map(([g, ms]) => `<optgroup label="${esc(g)}">${ms.map((x) => `<option value="${esc(x.id)}"${x.id === id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</optgroup>`).join('')}
    </select>
    <div class="seg" role="group" aria-label="粒度" id="grain">
      ${[['day', '日'], ['week', '周'], ['month', '月']].map(([g, l]) => `<button data-g="${g}" aria-pressed="${grain === g}">${l}</button>`).join('')}
    </div>
  </div>`

  let body
  if (cur.values.length) {
    const m = mean(cur.values)
    const slope = trendPer30(cur)
    body = `<div id="trend" style="height:320px" role="img" aria-label="${esc(def.label)}趋势图"></div>
      <div class="stats">
        ${stat(def.agg === 'sum' ? '日均' : '平均', `${fmtNum(m, d)} <small class="muted">${esc(unit)}</small>`)}
        ${stat('中位数', fmtNum(median(cur.values), d))}
        ${stat('最低', fmtNum(Math.min(...cur.values), d))}
        ${stat('最高', fmtNum(Math.max(...cur.values), d))}
        ${stat('有数据的天数', fmtNum(cur.values.length))}
        ${stat('每 30 天变化', Number.isFinite(slope) ? `${slope > 0 ? '+' : ''}${fmtNum(slope, d || 1)}` : '—')}
      </div>
      <p style="margin-top:8px">${delta(pct(m, mean(prev.values)), def.better, '平均值较上一个同等长度的时间段')}</p>
      ${dataTable(['日期', `${def.label}${per}（${unit}）`], shown.days.map((day, i) => [day, fmtNum(shown.values[i], d)]).reverse())}`
  } else {
    body = empty(`这个时间范围内没有「${esc(def.label)}」的数据。最早 ${all.days[0] ?? '—'}，最晚 ${all.days[all.days.length - 1] ?? '—'}。`)
  }

  const legendHtml = grain === 'day' ? legend([
    { label: '每日', color: t.deemph, line: !isBar },
    { label: '7日平均', color: t.series[0], line: true },
    ...(hasBand ? [{ label: '当日最低–最高', color: t.accentSoft }] : []),
  ]) : ''

  root.innerHTML = controls
    + card(`${esc(def.label)}${per}`, body, { sub: unit ? `单位：${esc(unit)}` : '', right: legendHtml })
    + (cur.values.length > 14 ? `<div class="section">${card('星期规律', '<div id="wd" style="height:220px" role="img" aria-label="按星期的平均值柱状图"></div>', { sub: `各星期几的${def.agg === 'sum' ? '日均' : '平均'}值` })}</div>` : '')

  root.querySelector('#metric').addEventListener('change', (e) => setMetric(e.target.value))
  root.querySelector('#grain').addEventListener('click', (e) => {
    const b = e.target.closest('[data-g]')
    if (b) { grain = b.dataset.g; rerender() }
  })
  if (!cur.values.length) return

  // 主趋势图
  const b = base(t)
  const fmt = (v) => fmtNum(v, d)
  const series = []
  if (hasBand) {
    series.push(
      { name: 'min', type: 'line', data: cur.min, stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
      { name: '当日范围', type: 'line', data: cur.max.map((v, i) => v - cur.min[i]), stack: 'band', symbol: 'none', lineStyle: { opacity: 0 }, areaStyle: { color: t.series[0], opacity: 0.1 }, silent: true, tooltip: { show: false } },
    )
  }
  series.push({
    name: grain === 'day' ? '每日' : grain === 'week' ? '每周' : '每月',
    type: isBar ? 'bar' : 'line',
    data: shown.values,
    barMaxWidth: 24,
    itemStyle: { color: grain === 'day' ? t.deemph : t.series[0], borderRadius: [4, 4, 0, 0] },
    lineStyle: { width: grain === 'day' ? 1 : 2, color: grain === 'day' ? t.deemph : t.series[0] },
    symbolSize: 8,
    showSymbol: grain !== 'day' || shown.days.length <= 60,
    connectNulls: true,
  })
  if (grain === 'day') {
    series.push({ name: '7日平均', type: 'line', data: avg7, symbol: 'none', lineStyle: { width: 2, color: t.series[0], cap: 'round', join: 'round' }, itemStyle: { color: t.series[0] } })
  }
  chart(root.querySelector('#trend'), {
    ...b,
    tooltip: {
      ...b.tooltip,
      formatter: (ps) => {
        const p0 = ps[0]
        let s = `<b>${p0.axisValue}</b>`
        for (const p of ps) s += `<br/>${dotHtml(p.color)}${p.seriesName} <b>${fmt(p.value)}</b> ${esc(unit)}`
        if (hasBand) s += `<br/><span style="color:${t.muted}">当日范围 ${fmt(cur.min[p0.dataIndex])} – ${fmt(cur.max[p0.dataIndex])}</span>`
        return s
      },
    },
    xAxis: { ...b.xAxisCommon, type: 'category', data: shown.days, boundaryGap: isBar },
    yAxis: { ...b.yAxisCommon, type: 'value', scale: def.agg !== 'sum', axisLabel: { ...b.yAxisCommon.axisLabel, formatter: tick } },
    dataZoom: shown.days.length > 120 ? [{ type: 'inside' }] : [],
    series,
  })

  // 星期规律
  if (cur.values.length > 14) {
    const wd = weekdayMeans(cur)
    const vals = WEEK_ORDER.map((w) => wd[w])
    chart(root.querySelector('#wd'), {
      ...b,
      tooltip: { ...b.tooltip, axisPointer: { type: 'shadow' }, formatter: (ps) => `${ps[0].name}<br/>平均 <b>${fmt(ps[0].value)}</b> ${esc(unit)}` },
      xAxis: { ...b.xAxisCommon, type: 'category', data: WEEK_ORDER.map((w) => WEEKDAYS[w]) },
      yAxis: { ...b.yAxisCommon, type: 'value', scale: def.agg !== 'sum', axisLabel: { ...b.yAxisCommon.axisLabel, formatter: tick } },
      series: [{
        type: 'bar', data: vals, barMaxWidth: 24, itemStyle: { color: t.series[0], borderRadius: [4, 4, 0, 0] },
        markLine: { symbol: 'none', silent: true, data: [{ yAxis: mean(vals.filter(Number.isFinite)) }], lineStyle: { color: t.axis, type: 'solid' }, label: { formatter: '平均', color: t.muted, fontSize: 11 } },
      }],
    })
  }
}
