import {
  align, anomalies, dayNum, linfit, mean, pct, pearson, previousRange, slice, trendPer30, weekdayOf,
} from '../lib/analysis.js'
import { fmtClock, fmtNum, getSeries, metricDef } from '../lib/metrics.js'
import { base, chart, tokens } from '../charts.js'
import { card, empty, esc, statusIcon } from '../ui.js'

const Q = 'HKQuantityTypeIdentifier'
const CORR = [
  Q + 'StepCount', Q + 'ActiveEnergyBurned', Q + 'AppleExerciseTime', Q + 'TimeInDaylight',
  'sleep.asleep', 'sleep.deep', Q + 'RestingHeartRate', Q + 'HeartRateVariabilitySDNN',
  Q + 'RespiratoryRate', Q + 'AppleSleepingWristTemperature',
]
const WATCH = [
  Q + 'RestingHeartRate', Q + 'HeartRateVariabilitySDNN', Q + 'RespiratoryRate',
  Q + 'AppleSleepingWristTemperature', Q + 'OxygenSaturation', 'sleep.asleep',
]
const SHORT = {
  [Q + 'StepCount']: '步数', [Q + 'ActiveEnergyBurned']: '活动能量', [Q + 'AppleExerciseTime']: '锻炼',
  [Q + 'TimeInDaylight']: '日光', 'sleep.asleep': '睡眠', 'sleep.deep': '深睡',
  [Q + 'RestingHeartRate']: '静息心率', [Q + 'HeartRateVariabilitySDNN']: 'HRV',
  [Q + 'RespiratoryRate']: '呼吸', [Q + 'AppleSleepingWristTemperature']: '手腕温度',
}

let lag = false
let pair = null

export function renderInsights(root, { data, range, openMetric, rerender }) {
  const t = tokens()
  const cur = new Map()
  for (const id of new Set([...CORR, ...WATCH])) cur.set(id, slice(getSeries(data, id), range))

  const ids = CORR.filter((id) => cur.get(id).days.length >= 20)
  const matrix = ids.map((a) => ids.map((b) => {
    if (!lag && a === b) return { r: 1, n: cur.get(a).days.length }
    const [x, y] = align(cur.get(a), cur.get(b), lag ? 1 : 0)
    return { r: x.length >= 20 ? pearson(x, y) : NaN, n: x.length }
  }))
  const insights = buildInsights(data, range, cur, ids, matrix)

  // 异常日：用完整序列算基线，只保留区间内的日期
  const byDate = new Map()
  for (const id of WATCH) {
    const def = metricDef(id, data)
    for (const a of anomalies(getSeries(data, id), def.watch ?? 'both')) {
      if (a.date < range.start || a.date > range.end) continue
      byDate.set(a.date, [...(byDate.get(a.date) ?? []), { def, ...a }])
    }
  }
  const flagged = [...byDate].sort((a, b) => b[0].localeCompare(a[0]))

  const sel = pair && ids.includes(pair[0]) && ids.includes(pair[1]) ? pair : strongest(ids, matrix)
  let sc = null
  if (sel) {
    const [x, y, ds] = align(cur.get(sel[0]), cur.get(sel[1]), lag ? 1 : 0)
    if (x.length >= 3) sc = { x, y, ds, r: pearson(x, y), da: metricDef(sel[0], data), db: metricDef(sel[1], data) }
  }

  const insightsHtml = insights.length
    ? `<ul class="insights">${insights.map((it, i) => `<li data-i="${i}" style="${it.metric ? 'cursor:pointer' : ''}">${statusIcon(it.kind)}<span>${esc(it.text)}</span></li>`).join('')}</ul>`
    : empty('数据太少，暂时没有可总结的规律。')

  const flaggedHtml = flagged.length
    ? `<div class="table-wrap" style="max-height:420px;overflow-y:auto"><table>
        <thead><tr><th>日期</th><th>异常指标</th><th>提示</th></tr></thead>
        <tbody>${flagged.slice(0, 60).map(([date, items]) => `<tr>
          <td>${date}</td>
          <td style="white-space:normal">${items.map((a) => `<span class="badge" data-metric="${esc(a.def.id)}" style="margin:0 6px 2px 0;cursor:pointer">
            ${esc(a.def.label)} ${fmtNum(a.value, a.def.decimals)}${a.def.unit === '%' ? '%' : ''}
            <span class="muted">（基线 ${fmtNum(a.baseline, a.def.decimals)}）</span></span>`).join('')}</td>
          <td>${items.length >= 2 ? `<span class="badge">${statusIcon('warning', true)}多项同时异常</span>` : '<span class="muted">单项</span>'}</td>
        </tr>`).join('')}</tbody></table></div>`
    : empty('这个时间范围内没有明显偏离基线的日子。')

  root.innerHTML = `
    ${card('自动发现', insightsHtml, { sub: '根据所选时间范围计算，点击条目查看对应趋势' })}
    <div class="grid two section">
      ${card('指标相关性',
        (ids.length >= 2 ? `<div id="corr" style="height:${Math.max(300, ids.length * 34 + 90)}px" role="img" aria-label="指标相关系数矩阵"></div>` : empty('需要至少两项指标各有 20 天以上的数据。'))
        + '<p class="muted small" style="margin-top:8px">|r| ≥ 0.3 才显示数值。相关不代表因果，仅作为观察线索。睡眠记在醒来那天，所以「睡眠 × 静息心率」不错开时，比较的是前一晚的睡眠与当天的心率。</p>',
        {
          sub: lag ? '行 = 当天，列 = 次日（例如当天运动与次日 HRV）' : '同一天的两项指标是否同涨同跌',
          right: `<label class="small secondary" style="display:flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" id="lag"${lag ? ' checked' : ''}/> 错开一天</label>`,
        })}
      ${card(sc ? `${esc(sc.da.label)} × ${esc(sc.db.label)}${lag ? '（次日）' : ''}` : '散点图',
        sc ? '<div id="scatter" style="height:320px" role="img" aria-label="两项指标的散点图与拟合线"></div>' : empty('点击左侧矩阵中的格子查看。'),
        { sub: sc ? `r = ${fmtNum(sc.r, 2)} · ${sc.x.length} 天 · ${describeR(sc.r)}` : '点击左侧矩阵中的格子' })}
    </div>
    <div class="section">
      ${card('异常日', flaggedHtml, { sub: '与此前 28 天的个人基线相比偏离 2 个标准差以上。多项指标同时异常时，常见于生病、饮酒、熬夜或训练过量。' })}
    </div>`

  root.querySelectorAll('.insights li').forEach((li) => li.addEventListener('click', () => {
    const it = insights[+li.dataset.i]
    if (it.metric) openMetric(it.metric)
  }))
  root.querySelectorAll('[data-metric]').forEach((el) => el.addEventListener('click', () => openMetric(el.dataset.metric)))
  root.querySelector('#lag').addEventListener('change', (e) => { lag = e.target.checked; rerender() })

  const b = base(t)
  if (ids.length >= 2) {
    const labels = ids.map((id) => SHORT[id] ?? metricDef(id).label)
    const cells = []
    matrix.forEach((row, i) => row.forEach((c, j) => cells.push([j, ids.length - 1 - i, Number.isFinite(c.r) ? +c.r.toFixed(2) : '-'])))
    chart(root.querySelector('#corr'), {
      ...b,
      grid: { left: 8, right: 8, top: 8, bottom: 44, containLabel: true },
      tooltip: {
        ...b.tooltip, trigger: 'item',
        formatter: (p) => {
          const i = ids.length - 1 - p.value[1], j = p.value[0]
          return `${labels[i]}${lag ? '（当天）' : ''} × ${labels[j]}${lag ? '（次日）' : ''}<br/>相关系数 r = <b>${p.value[2]}</b><br/><span style="color:${t.muted}">${matrix[i][j].n} 天重叠数据 · 点击查看散点图</span>`
        },
      },
      xAxis: { ...b.xAxisCommon, type: 'category', data: labels, axisLine: { show: false }, axisLabel: { ...b.xAxisCommon.axisLabel, rotate: 40, interval: 0 } },
      yAxis: { ...b.yAxisCommon, type: 'category', data: [...labels].reverse(), splitLine: { show: false }, axisLabel: { ...b.yAxisCommon.axisLabel, interval: 0 } },
      visualMap: {
        min: -1, max: 1, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 140,
        inRange: { color: [t.divNeg, t.divMid, t.divPos] }, text: ['正相关 +1', '负相关 −1'], textStyle: { color: t.muted, fontSize: 11 },
      },
      series: [{
        type: 'heatmap', data: cells,
        label: { show: true, fontSize: 10, color: t.text, formatter: (p) => (typeof p.value[2] === 'number' && Math.abs(p.value[2]) >= 0.3 ? p.value[2].toFixed(1) : '') },
        itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: t.text, borderWidth: 1 } },
      }],
    }, (p) => { pair = [ids[ids.length - 1 - p.value[1]], ids[p.value[0]]]; rerender() })
  }

  if (sc) {
    const { x, y, ds, da, db } = sc
    const fit = linfit(x, y)
    const xmin = Math.min(...x), xmax = Math.max(...x)
    chart(root.querySelector('#scatter'), {
      ...b,
      grid: { left: 8, right: 16, top: 16, bottom: 28, containLabel: true },
      tooltip: { ...b.tooltip, trigger: 'item', formatter: (p) => (p.seriesIndex ? '' : `${ds[p.dataIndex]}<br/>${esc(da.label)} ${fmtNum(x[p.dataIndex], da.decimals)} ${esc(da.unit)}<br/>${esc(db.label)}${lag ? '（次日）' : ''} ${fmtNum(y[p.dataIndex], db.decimals)} ${esc(db.unit)}`) },
      xAxis: { ...b.yAxisCommon, type: 'value', scale: true, name: `${da.label}（${da.unit}）`, nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: t.muted, fontSize: 11 } },
      yAxis: { ...b.yAxisCommon, type: 'value', scale: true },
      series: [
        { type: 'scatter', data: x.map((v, i) => [v, y[i]]), symbolSize: 8, itemStyle: { color: t.series[0], opacity: 0.55, borderColor: t.surface, borderWidth: 1 } },
        { type: 'line', data: [[xmin, fit.a + fit.b * xmin], [xmax, fit.a + fit.b * xmax]], symbol: 'none', lineStyle: { color: t.text2, width: 2 }, silent: true, tooltip: { show: false } },
      ],
    })
  }
}

function describeR(r) {
  const a = Math.abs(r)
  if (a < 0.1) return '几乎无相关'
  return `${a >= 0.5 ? '较强' : a >= 0.3 ? '中等' : '较弱'}${r > 0 ? '正' : '负'}相关`
}

/** 步数和活动能量这类本来就同源的指标，不作为“最强发现” */
function sameFamily(a, b) {
  const fam = (id) => (/StepCount|ActiveEnergy|ExerciseTime/.test(id) ? 'act' : id.startsWith('sleep.') ? 'sleep' : id)
  return fam(a) === fam(b)
}

function strongest(ids, m) {
  let best = null, br = 0
  for (let i = 0; i < ids.length; i++) for (let j = 0; j < ids.length; j++) {
    if (i === j) continue
    const r = Math.abs(m[i][j].r)
    if (Number.isFinite(r) && r > br && !sameFamily(ids[i], ids[j])) { br = r; best = [ids[i], ids[j]] }
  }
  return best
}

function buildInsights(data, range, cur, ids, matrix) {
  const out = []
  const prev = previousRange(range)
  const days = dayNum(range.end) - dayNum(range.start) + 1
  const isWeekend = (d) => [0, 6].includes(weekdayOf(d))

  const steps = cur.get(Q + 'StepCount') ?? slice(getSeries(data, Q + 'StepCount'), range)
  if (steps.values.length >= 7) {
    const m = mean(steps.values)
    const d = pct(m, mean(slice(getSeries(data, Q + 'StepCount'), prev).values))
    out.push({
      kind: m >= 8000 ? 'good' : m < 5000 ? 'warning' : 'info', metric: Q + 'StepCount',
      text: `日均步数 ${fmtNum(m)} 步${Number.isFinite(d) ? `，比上一个 ${days} 天${d >= 0 ? '多' : '少'} ${fmtNum(Math.abs(d))}%` : ''}。${m < 5000 ? '低于 5000 步通常被视为久坐。' : ''}`,
    })
    const we = steps.values.filter((_, i) => isWeekend(steps.days[i]))
    const wk = steps.values.filter((_, i) => !isWeekend(steps.days[i]))
    if (we.length >= 4 && wk.length >= 8) {
      const d2 = pct(mean(we), mean(wk))
      if (Math.abs(d2) >= 10) out.push({ kind: 'info', metric: Q + 'StepCount', text: `周末的步数比工作日${d2 > 0 ? '多' : '少'} ${fmtNum(Math.abs(d2))}%。` })
    }
  }

  const nights = data.sleep.filter((n) => n.date >= range.start && n.date <= range.end && n.asleep > 0)
  if (nights.length >= 7) {
    const avg = mean(nights.map((n) => n.asleep))
    const short = nights.filter((n) => n.asleep < 420).length / nights.length
    out.push({
      kind: avg >= 420 ? 'good' : 'warning', metric: 'sleep.asleep',
      text: `平均每晚睡 ${fmtNum(avg / 60, 1)} 小时，${fmtNum(short * 100)}% 的夜晚不足 7 小时（成年人一般建议 7–9 小时）。`,
    })
    const weN = nights.filter((n) => isWeekend(n.date))
    const wkN = nights.filter((n) => !isWeekend(n.date))
    if (weN.length >= 3 && wkN.length >= 5) {
      const a = mean(weN.map((n) => n.bedtime)), b = mean(wkN.map((n) => n.bedtime))
      if (Math.abs(a - b) >= 30) {
        out.push({
          kind: Math.abs(a - b) >= 60 ? 'warning' : 'info', metric: 'sleep.asleep',
          text: `周五、周六晚比工作日${a > b ? '晚' : '早'} ${fmtNum(Math.abs(a - b))} 分钟入睡（平均 ${fmtClock(a)} 对 ${fmtClock(b)}）。作息差超过 1 小时容易造成“社交时差”。`,
        })
      }
    }
  }

  for (const [id, name, goodDir] of [[Q + 'RestingHeartRate', '静息心率', 'down'], [Q + 'HeartRateVariabilitySDNN', '心率变异性（HRV）', 'up']]) {
    const s = cur.get(id)
    if (!s || s.values.length < 20) continue
    const slope = trendPer30(s)
    const m = mean(s.values)
    const def = metricDef(id)
    if (Math.abs(slope / m) >= 0.01) {
      const up = slope > 0
      out.push({
        kind: up === (goodDir === 'up') ? 'good' : 'warning', metric: id,
        text: `${name}呈${up ? '上升' : '下降'}趋势，平均每 30 天${up ? '增加' : '减少'} ${fmtNum(Math.abs(slope), 1)} ${def.unit}（区间平均 ${fmtNum(m, def.decimals)} ${def.unit}）。`,
      })
    } else {
      out.push({ kind: 'info', metric: id, text: `${name}保持稳定，区间平均 ${fmtNum(m, def.decimals)} ${def.unit}。` })
    }
  }

  const vo2 = slice(getSeries(data, Q + 'VO2Max'), range)
  if (vo2.values.length >= 4) {
    const first = mean(vo2.values.slice(0, 3)), last = mean(vo2.values.slice(-3))
    const d = last - first
    if (Math.abs(d) >= 0.5) out.push({ kind: d > 0 ? 'good' : 'warning', metric: Q + 'VO2Max', text: `最大摄氧量从 ${fmtNum(first, 1)} ${d > 0 ? '升至' : '降至'} ${fmtNum(last, 1)}，心肺耐力${d > 0 ? '在提升' : '有所下降'}。` })
  }

  if (days >= 14 && data.workouts.length) {
    const ws = data.workouts.filter((w) => w.date >= range.start && w.date <= range.end)
    const minPerWeek = ws.reduce((s, w) => s + w.duration, 0) / (days / 7)
    out.push({
      kind: minPerWeek >= 150 ? 'good' : 'info',
      text: `平均每周训练 ${fmtNum(ws.length / (days / 7), 1)} 次、共 ${fmtNum(minPerWeek)} 分钟。${minPerWeek >= 150 ? '达到了' : '未达到'}世界卫生组织建议的每周 150 分钟中等强度运动。`,
    })
  }

  const best = strongest(ids, matrix)
  if (best) {
    const r = matrix[ids.indexOf(best[0])][ids.indexOf(best[1])].r
    if (Math.abs(r) >= 0.3) {
      out.push({ kind: 'info', text: `在你的数据里，${metricDef(best[0]).label}${lag ? '（当天）' : ''}与${metricDef(best[1]).label}${lag ? '（次日）' : ''}的关联最明显：${describeR(r)}（r = ${fmtNum(r, 2)}）。` })
    }
  }
  return out
}
