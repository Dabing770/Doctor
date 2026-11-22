// 把健康数据整理成一份紧凑的文字摘要，供 AI 医生阅读。
// 只包含汇总统计，不包含原始记录。
import { anomalies, dayNum, mean, median, numDay, previousRange, resample, slice, std, trendPer30, weekdayOf } from './analysis.js'
import { fmtClock, getSeries, metricDef, workoutLabel } from './metrics.js'

const Q = 'HKQuantityTypeIdentifier'
const C = 'HKCategoryTypeIdentifier'
const KEY_METRICS = [
  Q + 'StepCount', Q + 'ActiveEnergyBurned', Q + 'AppleExerciseTime', Q + 'AppleStandTime', Q + 'FlightsClimbed',
  Q + 'TimeInDaylight', 'sleep.asleep', 'sleep.deep', 'sleep.rem', 'sleep.inBed',
  Q + 'RestingHeartRate', Q + 'HeartRateVariabilitySDNN', Q + 'HeartRate', Q + 'WalkingHeartRateAverage',
  Q + 'HeartRateRecoveryOneMinute', Q + 'VO2Max', Q + 'OxygenSaturation', Q + 'RespiratoryRate',
  Q + 'AppleSleepingWristTemperature', Q + 'BodyMass', Q + 'BodyMassIndex', Q + 'BodyFatPercentage',
  Q + 'BloodPressureSystolic', Q + 'BloodPressureDiastolic', Q + 'BloodGlucose', Q + 'BodyTemperature',
  Q + 'WalkingSpeed', Q + 'WalkingStepLength', Q + 'WalkingAsymmetryPercentage', Q + 'WalkingDoubleSupportPercentage',
  Q + 'HeadphoneAudioExposure', Q + 'EnvironmentalAudioExposure', C + 'MindfulSession',
  Q + 'DietaryEnergyConsumed', Q + 'DietaryWater', Q + 'DietaryCaffeine',
]
const EVENTS = [
  [C + 'IrregularHeartRhythmEvent', '心律不齐通知'], [C + 'HighHeartRateEvent', '心率过高通知'],
  [C + 'LowHeartRateEvent', '心率过低通知'], [C + 'HeadphoneAudioExposureEvent', '耳机音量过高通知'],
]
const ANOMALY_WATCH = [
  Q + 'RestingHeartRate', Q + 'HeartRateVariabilitySDNN', Q + 'RespiratoryRate',
  Q + 'AppleSleepingWristTemperature', Q + 'OxygenSaturation', 'sleep.asleep',
]

const r = (v, d = 1) => (Number.isFinite(v) ? +v.toFixed(d) : '无')
const SEX = { HKBiologicalSexMale: '男', HKBiologicalSexFemale: '女', HKBiologicalSexOther: '其他' }

export function ageFrom(birthDate, onDate) {
  if (!birthDate) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  const [Y, M, D] = onDate.split('-').map(Number)
  return Y - y - (M < m || (M === m && D < d) ? 1 : 0)
}

export function exportSex(data) {
  return SEX[data.meta.sex] ?? ''
}

/**
 * @param profile {age, sex, notes}
 * @param findings 小医生规则检查的结果（标题与级别）
 */
export function buildSummary(data, range, profile, findings) {
  const L = []
  const days = dayNum(range.end) - dayNum(range.start) + 1
  const prev = previousRange(range)
  const end = range.end
  const recent7 = { start: numDay(dayNum(end) - 6), end }
  const base60 = { start: numDay(dayNum(end) - 66), end: numDay(dayNum(end) - 7) }

  L.push('# 个人信息')
  L.push(`- 年龄：${profile.age || '未提供'}`)
  L.push(`- 性别：${profile.sex || '未提供'}`)
  L.push(`- 用户补充说明：${profile.notes?.trim() || '无'}`)
  L.push('')
  L.push('# 数据说明')
  L.push(`- 来源：苹果健康导出（设备：${data.meta.sources.slice(0, 8).join('、')}）`)
  L.push(`- 分析区间：${range.start} 至 ${range.end}，共 ${days} 天；对比区间：${prev.start} 至 ${prev.end}`)
  L.push(`- 全部数据跨度：${data.meta.firstDate} 至 ${data.meta.lastDate}`)
  L.push('- 累计型指标（步数、能量、锻炼时间等）为每日总和；其余为每日平均。睡眠记在醒来那天。')
  L.push('')

  L.push('# 指标统计')
  L.push('格式：指标（单位）：区间均值 | 中位数 | 最低–最高 | 有数据天数 | 每30天趋势 | 上一区间均值 | 最近7天均值 | 此前60天基线均值±标准差')
  for (const id of KEY_METRICS) {
    const all = getSeries(data, id)
    const cur = slice(all, range)
    if (!cur.values.length) continue
    const def = metricDef(id, data)
    const d = Math.max(def.decimals, 1)
    const p = slice(all, prev).values
    const rc = slice(all, recent7).values
    const b = slice(all, base60).values
    L.push(`- ${def.label}（${def.unit || '无单位'}）：${r(mean(cur.values), d)} | ${r(median(cur.values), d)} | ${r(Math.min(...cur.values), d)}–${r(Math.max(...cur.values), d)} | ${cur.values.length} | ${r(trendPer30(cur), d)} | ${r(mean(p), d)} | ${r(mean(rc), d)} | ${r(mean(b), d)}±${r(std(b), d)}`)
  }
  L.push('')

  L.push('# 近 12 周的周均值（从早到晚）')
  for (const id of [Q + 'StepCount', 'sleep.asleep', Q + 'RestingHeartRate', Q + 'HeartRateVariabilitySDNN', Q + 'AppleExerciseTime', Q + 'BodyMass', Q + 'VO2Max']) {
    const w = resample(slice(getSeries(data, id), { start: '0000', end }), 'week')
    if (w.values.length < 3) continue
    const def = metricDef(id, data)
    L.push(`- ${def.label}：${w.values.slice(-12).map((v) => r(v, def.decimals)).join(', ')}`)
  }
  L.push('')

  const nights = data.sleep.filter((n) => n.date >= range.start && n.date <= range.end && n.asleep > 0)
  if (nights.length) {
    const staged = nights.filter((n) => n.hasStages)
    const wkend = nights.filter((n) => [0, 6].includes(weekdayOf(n.date)))
    const wk = nights.filter((n) => ![0, 6].includes(weekdayOf(n.date)))
    L.push('# 睡眠')
    L.push(`- 有记录的夜晚：${nights.length}/${days}；带分期的：${staged.length}`)
    L.push(`- 平均睡眠 ${r(mean(nights.map((n) => n.asleep)) / 60, 2)} 小时；不足 7 小时的夜晚占 ${r((nights.filter((n) => n.asleep < 420).length / nights.length) * 100, 0)}%；不足 6 小时占 ${r((nights.filter((n) => n.asleep < 360).length / nights.length) * 100, 0)}%`)
    L.push(`- 平均入睡 ${fmtClock(mean(nights.map((n) => n.bedtime)))}（标准差 ${r(std(nights.map((n) => n.bedtime)), 0)} 分钟），平均醒来 ${fmtClock(mean(nights.map((n) => n.wake)))}（标准差 ${r(std(nights.map((n) => n.wake)), 0)} 分钟）`)
    if (wkend.length && wk.length) L.push(`- 周五、六晚平均入睡 ${fmtClock(mean(wkend.map((n) => n.bedtime)))}、睡 ${r(mean(wkend.map((n) => n.asleep)) / 60, 1)} 小时；其余夜晚 ${fmtClock(mean(wk.map((n) => n.bedtime)))}、${r(mean(wk.map((n) => n.asleep)) / 60, 1)} 小时`)
    if (staged.length) L.push(`- 分期占比：深度 ${r(mean(staged.map((n) => n.deep / n.asleep)) * 100, 0)}%，核心 ${r(mean(staged.map((n) => n.core / n.asleep)) * 100, 0)}%，快速动眼 ${r(mean(staged.map((n) => n.rem / n.asleep)) * 100, 0)}%；平均夜间清醒 ${r(mean(staged.map((n) => n.awake)), 0)} 分钟`)
    const eff = nights.filter((n) => n.inBed > 0)
    if (eff.length) L.push(`- 睡眠效率（睡眠/卧床）：${r(mean(eff.map((n) => Math.min(1, n.asleep / n.inBed))) * 100, 0)}%`)
    L.push('')
  }

  const ws = data.workouts.filter((w) => w.date >= range.start && w.date <= range.end)
  L.push('# 体能训练')
  if (ws.length) {
    const byType = new Map()
    for (const w of ws) byType.set(w.type, [...(byType.get(w.type) ?? []), w])
    L.push(`- 共 ${ws.length} 次，平均每周 ${r(ws.length / (days / 7), 1)} 次、${r(ws.reduce((s, w) => s + w.duration, 0) / (days / 7), 0)} 分钟`)
    for (const [type, list] of [...byType].sort((a, b) => b[1].length - a[1].length).slice(0, 8)) {
      const hr = mean(list.filter((w) => w.avgHR).map((w) => w.avgHR))
      const dist = list.reduce((s, w) => s + (w.distance ?? 0), 0)
      L.push(`- ${workoutLabel(type)}：${list.length} 次，平均 ${r(mean(list.map((w) => w.duration)), 0)} 分钟，平均心率 ${r(hr, 0)}${dist ? `，总距离 ${r(dist, 1)} ${list.find((w) => w.distanceUnit)?.distanceUnit ?? ''}` : ''}`)
    }
  } else {
    L.push('- 区间内没有体能训练记录')
  }
  L.push('')

  const act = data.activity.filter((a) => a.date >= range.start && a.date <= range.end)
  if (act.length) {
    const rate = (f) => r((act.filter(f).length / act.length) * 100, 0)
    L.push('# 健身记录圆环达成率')
    L.push(`- 活动 ${rate((a) => a.moveGoal > 0 && a.move >= a.moveGoal)}%，锻炼 ${rate((a) => a.exerciseGoal > 0 && a.exercise >= a.exerciseGoal)}%，站立 ${rate((a) => a.standGoal > 0 && a.stand >= a.standGoal)}%（共 ${act.length} 天）`)
    L.push('')
  }

  const ev = EVENTS.map(([id, label]) => {
    const s = slice(getSeries(data, id), range)
    const n = s.values.reduce((a, b) => a + b, 0)
    return n ? `${label} ${n} 次（最近 ${s.days[s.days.length - 1]}）` : ''
  }).filter(Boolean)
  L.push('# Apple Watch 健康通知')
  L.push(ev.length ? ev.map((x) => `- ${x}`).join('\n') : '- 区间内没有')
  L.push('')

  const flagged = new Map()
  for (const id of ANOMALY_WATCH) {
    const def = metricDef(id, data)
    for (const a of anomalies(getSeries(data, id), def.watch ?? 'both')) {
      if (a.date < range.start || a.date > range.end) continue
      flagged.set(a.date, [...(flagged.get(a.date) ?? []), `${def.label} ${r(a.value, def.decimals)}（基线 ${r(a.baseline, def.decimals)}）`])
    }
  }
  L.push('# 异常日（与此前 28 天个人基线相比偏离 ≥2 个标准差，最多列 25 天）')
  const fl = [...flagged].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 25)
  L.push(fl.length ? fl.map(([d, items]) => `- ${d}：${items.join('；')}`).join('\n') : '- 没有')
  L.push('')

  if (findings?.length) {
    L.push('# 网页规则检查的结果（供参考）')
    for (const f of findings) L.push(`- [${f.levelLabel}] ${f.title}`)
  }
  return L.join('\n')
}
