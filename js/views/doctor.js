// 小医生：根据数据给出生活方式提醒。规则基于常见的公共健康建议，不做诊断。
import { dayNum, mean, numDay, slice, std } from '../lib/analysis.js'
import { fmtClock, fmtNum, getSeries } from '../lib/metrics.js'
import { card, esc } from '../ui.js'

const Q = 'HKQuantityTypeIdentifier'
const C = 'HKCategoryTypeIdentifier'

const LEVELS = {
  doctor: { label: '建议咨询医生', order: 0 },
  warning: { label: '需要注意', order: 1 },
  info: { label: '小提示', order: 2 },
  good: { label: '保持得不错', order: 3 },
}

let filter = 'all'

export function renderDoctor(root, { data, range, openMetric, rerender }) {
  const items = checkup(data, range).sort((a, b) => LEVELS[a.level].order - LEVELS[b.level].order)
  const count = (lv) => items.filter((i) => i.level === lv).length
  const shown = filter === 'all' ? items : items.filter((i) => i.level === filter)
  const nDoctor = count('doctor'), nWarn = count('warning')

  const greeting = nDoctor
    ? `这段时间有 <b>${nDoctor}</b> 项指标建议找医生聊聊，另有 <b>${nWarn}</b> 项需要留意。别紧张，可穿戴设备的数据有误差，先看看下面的说明。`
    : nWarn
      ? `整体还可以，有 <b>${nWarn}</b> 项值得调整一下生活习惯。`
      : '这段时间的数据看起来都不错，继续保持！'

  root.innerHTML = `
    <section class="card doctor-hero">
      <div class="doctor-avatar" aria-hidden="true">
        <svg viewBox="0 0 64 64" width="56" height="56">
          <circle cx="32" cy="32" r="32" fill="var(--accent-soft)"/>
          <circle cx="32" cy="26" r="11" fill="var(--surface-1)"/>
          <path d="M14 56c2-10 9-15 18-15s16 5 18 15" fill="var(--surface-1)"/>
          <path d="M25 42v6a5 5 0 0 0 10 0" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
          <circle cx="35" cy="48" r="2.5" fill="var(--accent)"/>
          <rect x="29" y="12" width="6" height="2" rx="1" fill="var(--series-8)"/><rect x="31" y="10" width="2" height="6" rx="1" fill="var(--series-8)"/>
        </svg>
      </div>
      <div>
        <h2>小医生的健康提醒</h2>
        <p class="secondary" style="margin-top:4px">${greeting}</p>
        <p class="muted small" style="margin-top:6px">基于 ${range.start} 至 ${range.end} 的数据（可在上方切换时间范围）。这些提醒来自常见的公共健康建议，不是诊断，也不能代替医生。</p>
      </div>
    </section>

    <div class="toolbar section" style="margin-bottom:12px">
      <div class="seg" role="group" aria-label="筛选" id="doc-filter">
        <button data-f="all" aria-pressed="${filter === 'all'}">全部 ${items.length}</button>
        ${Object.entries(LEVELS).map(([k, v]) => `<button data-f="${k}" aria-pressed="${filter === k}">${v.label} ${count(k)}</button>`).join('')}
      </div>
    </div>

    <div class="advice-list">
      ${shown.length ? shown.map((it, i) => `
        <article class="advice lv-${it.level}" ${it.metric ? `data-metric="${esc(it.metric)}" tabindex="0" role="button"` : ''} data-i="${i}">
          <div class="advice-head">
            <span class="lv-badge">${LEVELS[it.level].label}</span>
            <h3>${esc(it.title)}</h3>
          </div>
          <p class="finding">${it.finding}</p>
          ${it.advice ? `<p class="tip"><b>建议：</b>${it.advice}</p>` : ''}
          ${it.basis ? `<p class="basis">依据：${it.basis}</p>` : ''}
        </article>`).join('') : '<p class="muted small" style="padding:24px 0;text-align:center">这一类没有提醒。</p>'}
    </div>

    <div class="grid two section">
      ${card('日常叮嘱', `<ul class="plain-list">
        <li>固定起床时间比固定入睡时间更重要，周末也尽量不差超过 1 小时。</li>
        <li>睡前 1 小时放下手机，卧室保持暗、静、偏凉。</li>
        <li>每坐 1 小时起来活动几分钟；每周至少 150 分钟中等强度运动，外加 2 次力量训练。</li>
        <li>白天到户外晒太阳 20–30 分钟，有助于晚上入睡和情绪稳定。</li>
        <li>下午 2 点后少喝咖啡和浓茶；酒精会明显降低睡眠质量和心率变异性。</li>
        <li>戴耳机时音量不超过最大音量的 60%，连续听 60 分钟就休息一下。</li>
        <li>生病、发烧期间暂停高强度训练，等静息心率回到平时水平再恢复。</li>
      </ul>`)}
      ${card('出现这些情况请及时就医', `<ul class="plain-list urgent">
        <li>胸痛、胸闷或压迫感，尤其伴随出汗、恶心、左臂或下巴疼痛。</li>
        <li>晕倒、突然头晕眼前发黑，或说话不清、一侧肢体无力、口角歪斜。</li>
        <li>静坐时心跳持续超过 120 次/分，或低于 40 次/分并感到不适。</li>
        <li>手表反复提示心律不齐，或自己感觉心跳乱、心慌。</li>
        <li>血氧多次低于 90%，同时有气短、嘴唇发紫。</li>
        <li>没有刻意减肥，半年内体重下降超过 5%。</li>
      </ul>
      <p class="small secondary" style="margin-top:10px">紧急情况请立即拨打急救电话：芬兰及欧盟 <b>112</b>，中国大陆 <b>120</b>。</p>`)}
    </div>`

  root.querySelector('#doc-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-f]')
    if (b) { filter = b.dataset.f; rerender() }
  })
  root.querySelectorAll('.advice[data-metric]').forEach((el) => {
    const go = () => openMetric(el.dataset.metric)
    el.addEventListener('click', go)
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') go() })
  })
}

// ---------------- 检查规则 ----------------

/** 最近 7 天与此前 60 天的对比（以区间结束日为准） */
function recentVsBase(s, end, recentDays = 7, baseDays = 60) {
  const e = dayNum(end)
  const recent = slice(s, { start: numDay(e - recentDays + 1), end })
  const basis = slice(s, { start: numDay(e - recentDays - baseDays + 1), end: numDay(e - recentDays) })
  return { recent: mean(recent.values), nRecent: recent.values.length, base: mean(basis.values), sd: std(basis.values), nBase: basis.values.length }
}

export function checkup(data, range) {
  const out = []
  const add = (level, title, finding, advice, basis, metric) => out.push({ level, title, finding, advice, basis, metric })
  const cur = (id) => slice(getSeries(data, id), range)
  const days = dayNum(range.end) - dayNum(range.start) + 1

  // ---- 睡眠 ----
  const nights = data.sleep.filter((n) => n.date >= range.start && n.date <= range.end && n.asleep > 0)
  if (nights.length >= 5) {
    const avg = mean(nights.map((n) => n.asleep)) / 60
    const short6 = nights.filter((n) => n.asleep < 360).length / nights.length
    if (avg < 6) add('warning', '睡眠明显不足', `平均每晚只睡 <b>${fmtNum(avg, 1)}</b> 小时，${fmtNum(short6 * 100)}% 的夜晚不到 6 小时。`, '长期睡眠不足会影响免疫力、记忆力和情绪。试着把上床时间提前 30 分钟，坚持两周再看变化。', '成年人一般建议每晚睡 7–9 小时。', 'sleep.asleep')
    else if (avg < 7) add('info', '睡眠略少', `平均每晚睡 <b>${fmtNum(avg, 1)}</b> 小时，接近但没达到 7 小时。`, '每晚再多睡 20–30 分钟会有明显帮助，尤其在考试、训练量大的时期。', '成年人一般建议每晚睡 7–9 小时。', 'sleep.asleep')
    else add('good', '睡眠时长充足', `平均每晚睡 <b>${fmtNum(avg, 1)}</b> 小时。`, '继续保持规律作息。', '成年人一般建议每晚睡 7–9 小时。', 'sleep.asleep')

    const bedSd = std(nights.map((n) => n.bedtime))
    const bedAvg = mean(nights.map((n) => n.bedtime))
    if (bedSd > 60) add('warning', '作息不太规律', `入睡时间前后波动约 <b>±${fmtNum(bedSd)}</b> 分钟。`, '先固定起床时间（包括周末），入睡时间会慢慢跟着稳定下来。', '入睡时间波动超过 1 小时与睡眠质量下降、白天疲劳有关。', 'sleep.asleep')
    else if (bedSd <= 40) add('good', '作息规律', `入睡时间波动只有 ±${fmtNum(bedSd)} 分钟。`, '规律的作息是好睡眠的基础，继续保持。', '', 'sleep.asleep')
    if (bedAvg > 45) add('info', '入睡偏晚', `平均 <b>${fmtClock(bedAvg)}</b> 才入睡。`, '晚睡本身不一定有害，但如果早上必须早起，就容易睡不够。可以把屏幕时间往前收一收。', '', 'sleep.asleep')
  }

  // ---- 静息心率 ----
  const rhr = cur(Q + 'RestingHeartRate')
  if (rhr.values.length >= 5) {
    const m = mean(rhr.values)
    if (m > 100) add('doctor', '静息心率偏高', `区间平均静息心率 <b>${fmtNum(m)}</b> 次/分，超过 100。`, '静息心率长期超过 100 次/分称为心动过速，可能与甲状腺、贫血、感染等有关，建议找医生检查。', '成年人静息心率正常范围通常为 60–100 次/分。', Q + 'RestingHeartRate')
    else if (m > 85) add('warning', '静息心率偏高', `区间平均静息心率 <b>${fmtNum(m)}</b> 次/分。`, '规律的有氧运动、充足睡眠、减少咖啡因和酒精通常能让静息心率慢慢下降。', '正常范围 60–100 次/分，但长期处于偏高水平与心血管风险增加相关。', Q + 'RestingHeartRate')
    else if (m < 45) add('info', '静息心率很低', `区间平均静息心率 <b>${fmtNum(m)}</b> 次/分。`, '经常运动的人心率低很正常。如果同时有头晕、乏力、晕倒，请咨询医生。', '', Q + 'RestingHeartRate')
    else add('good', '静息心率正常', `区间平均静息心率 ${fmtNum(m)} 次/分。`, '保持运动习惯，静息心率是心肺健康的好指标。', '', Q + 'RestingHeartRate')

    const r = recentVsBase(getSeries(data, Q + 'RestingHeartRate'), range.end)
    if (r.nRecent >= 3 && r.nBase >= 14 && r.recent - r.base >= 5) {
      add('warning', '最近静息心率升高', `最近 7 天平均 <b>${fmtNum(r.recent)}</b> 次/分，比之前的 ${fmtNum(r.base)} 高了 ${fmtNum(r.recent - r.base)}。`, '这常见于感冒前兆、睡眠不足、压力大、饮酒或训练过量。这几天多休息、多喝水，暂缓高强度训练。', '静息心率比个人平时高出 5 次/分以上，通常提示身体还没恢复。', Q + 'RestingHeartRate')
    }
  }

  // ---- 心率变异性 ----
  const h = recentVsBase(getSeries(data, Q + 'HeartRateVariabilitySDNN'), range.end)
  if (h.nRecent >= 3 && h.nBase >= 14) {
    const drop = (h.base - h.recent) / h.base
    if (drop >= 0.2) add('warning', '最近恢复状态偏差', `最近 7 天心率变异性（HRV）平均 <b>${fmtNum(h.recent)}</b> 毫秒，比之前低了 ${fmtNum(drop * 100)}%。`, 'HRV 下降说明身体压力大、恢复不足。优先保证睡眠，安排轻松的活动，留意是否在生病。', 'HRV 只适合和自己的平时水平比较，不同人之间差异很大。', Q + 'HeartRateVariabilitySDNN')
    else if (drop <= -0.1) add('good', '恢复状态良好', `最近 7 天 HRV 比之前高 ${fmtNum(-drop * 100)}%。`, '身体恢复得不错，适合安排质量更高的训练。', '', Q + 'HeartRateVariabilitySDNN')
  }

  // ---- 心脏通知 ----
  for (const [id, title, level, advice] of [
    [C + 'IrregularHeartRhythmEvent', '收到心律不齐通知', 'doctor', '心律不齐通知可能提示心房颤动。请把这些记录给医生看，必要时做心电图检查。'],
    [C + 'HighHeartRateEvent', '收到心率过高通知', 'warning', '如果当时在静坐且没有紧张、发烧、喝咖啡，又反复出现，建议咨询医生。'],
    [C + 'LowHeartRateEvent', '收到心率过低通知', 'warning', '如果同时感到头晕、乏力，建议咨询医生；运动员偶尔出现通常无碍。'],
  ]) {
    const s = cur(id)
    const n = s.values.reduce((a, b) => a + b, 0)
    if (n > 0) add(level, title, `这段时间 Apple Watch 共提醒了 <b>${n}</b> 次，最近一次在 ${s.days[s.days.length - 1]}。`, advice, '', id)
  }

  // ---- 血氧 ----
  const spo = getSeries(data, Q + 'OxygenSaturation')
  const spoCur = slice(spo, range)
  if (spoCur.values.length >= 5) {
    const m = mean(spoCur.values)
    const lowDays = spoCur.min ? spoCur.min.filter((v) => v < 90).length : 0
    if (m < 95) add('doctor', '血氧偏低', `区间平均血氧 <b>${fmtNum(m, 1)}%</b>。`, '如果同时有气短、乏力，请咨询医生。先确认手表佩戴是否贴合，测量时手腕保持静止。', '健康人血氧通常在 95%–100%。', Q + 'OxygenSaturation')
    else if (lowDays >= 3) add('warning', '夜间血氧偶有偏低', `有 <b>${lowDays}</b> 天出现低于 90% 的读数（平均 ${fmtNum(m, 1)}%）。`, '偶尔的低读数多半是佩戴松动造成的。如果家人说你打鼾严重、憋气，或白天特别困，可以咨询医生是否需要做睡眠呼吸检查。', '', Q + 'OxygenSaturation')
    else add('good', '血氧正常', `区间平均血氧 ${fmtNum(m, 1)}%。`, '', '健康人血氧通常在 95%–100%。', Q + 'OxygenSaturation')
  }

  // ---- 呼吸频率、手腕温度：可能生病的信号 ----
  const resp = recentVsBase(getSeries(data, Q + 'RespiratoryRate'), range.end)
  const temp = recentVsBase(getSeries(data, Q + 'AppleSleepingWristTemperature'), range.end)
  const signals = []
  if (resp.nRecent >= 3 && resp.nBase >= 14 && resp.recent - resp.base >= 1.5) signals.push(`睡眠呼吸频率升高 ${fmtNum(resp.recent - resp.base, 1)} 次/分`)
  if (temp.nRecent >= 3 && temp.nBase >= 14 && temp.recent - temp.base >= 0.4) signals.push(`睡眠手腕温度升高 ${fmtNum(temp.recent - temp.base, 2)} °C`)
  if (signals.length) add('warning', '身体可能在对抗感染', `最近 7 天${signals.join('，')}（与之前相比）。`, '这常出现在感冒、发烧前后（女性也可能与生理周期有关）。注意休息，如有发烧、咳嗽等症状请及时就医。', '手腕温度和呼吸频率只适合和自己的平时水平比较。', signals[0].startsWith('睡眠呼吸') ? Q + 'RespiratoryRate' : Q + 'AppleSleepingWristTemperature')

  // ---- 活动 ----
  const steps = cur(Q + 'StepCount')
  if (steps.values.length >= 7) {
    const m = mean(steps.values)
    if (m < 5000) add('warning', '活动量偏少', `日均只有 <b>${fmtNum(m)}</b> 步。`, '从每天多走 1000–2000 步开始：午饭后散步 15 分钟、提前一站下车、用楼梯代替电梯。', '日均低于 5000 步通常被视为久坐生活方式。', Q + 'StepCount')
    else if (m >= 8000) add('good', '每天走得够多', `日均 ${fmtNum(m)} 步。`, '', '研究显示每天 7000–10000 步与较低的全因死亡风险相关。', Q + 'StepCount')
    else add('info', '步数还可以再多一点', `日均 ${fmtNum(m)} 步。`, '目标可以定在每天 8000 步左右。', '', Q + 'StepCount')
  }
  if (days >= 14 && (data.workouts.length || cur(Q + 'AppleExerciseTime').values.length)) {
    const ws = data.workouts.filter((w) => w.date >= range.start && w.date <= range.end)
    const ex = cur(Q + 'AppleExerciseTime')
    const perWeek = ex.values.length ? (ex.values.reduce((a, b) => a + b, 0) / days) * 7 : ws.reduce((s, w) => s + w.duration, 0) / (days / 7)
    if (perWeek < 75) add('warning', '运动太少', `每周锻炼约 <b>${fmtNum(perWeek)}</b> 分钟。`, '不需要一下子练很多。先每周安排 3 次、每次 25 分钟快走或骑车，比完全不动好很多。', '世界卫生组织建议成年人每周 150–300 分钟中等强度有氧运动。', Q + 'AppleExerciseTime')
    else if (perWeek < 150) add('info', '运动量接近建议值', `每周锻炼约 <b>${fmtNum(perWeek)}</b> 分钟。`, '再加一两次运动就能达到 150 分钟。', '世界卫生组织建议成年人每周 150–300 分钟中等强度有氧运动。', Q + 'AppleExerciseTime')
    else add('good', '运动量达标', `每周锻炼约 ${fmtNum(perWeek)} 分钟。`, '别忘了每周 2 次力量训练，并给身体留出恢复日。', '世界卫生组织建议每周 150–300 分钟中等强度有氧运动。', Q + 'AppleExerciseTime')
    const strength = ws.filter((w) => /Strength|Core|HighIntensity|CrossTraining/.test(w.type)).length / (days / 7)
    if (ws.length && strength < 1) add('info', '力量训练较少', `每周力量训练约 ${fmtNum(strength, 1)} 次。`, '每周 2 次力量训练（深蹲、俯卧撑、弹力带都可以）能保护关节、改善体态和代谢。', '世界卫生组织建议每周至少 2 天进行肌肉力量训练。')
  }

  // ---- 体重、BMI、血压 ----
  const wAll = getSeries(data, Q + 'BodyMass')
  const wRecent = slice(wAll, { start: numDay(dayNum(range.end) - 30), end: range.end })
  const wOld = slice(wAll, { start: numDay(dayNum(range.end) - 210), end: numDay(dayNum(range.end) - 150) })
  if (wRecent.values.length && wOld.values.length) {
    const change = (mean(wRecent.values) - mean(wOld.values)) / mean(wOld.values)
    if (change <= -0.05) add('doctor', '体重明显下降', `近半年体重下降约 <b>${fmtNum(-change * 100, 1)}%</b>（${fmtNum(mean(wOld.values), 1)} → ${fmtNum(mean(wRecent.values), 1)} kg）。`, '如果不是刻意减重，体重下降超过 5% 需要找医生查找原因。', '6–12 个月内非刻意体重下降超过 5% 通常需要就医评估。', Q + 'BodyMass')
    else if (change >= 0.05) add('warning', '体重明显上升', `近半年体重增加约 <b>${fmtNum(change * 100, 1)}%</b>。`, '留意饮食和活动量的变化；如果伴随水肿、气短，请咨询医生。', '', Q + 'BodyMass')
  }
  const bmi = cur(Q + 'BodyMassIndex')
  if (bmi.values.length) {
    const v = bmi.values[bmi.values.length - 1]
    if (v < 18.5) add('warning', 'BMI 偏低', `最近一次 BMI <b>${fmtNum(v, 1)}</b>。`, '保证足够的蛋白质和热量摄入，配合力量训练。', '中国成人标准：18.5–23.9 为正常。', Q + 'BodyMassIndex')
    else if (v >= 28) add('warning', 'BMI 偏高', `最近一次 BMI <b>${fmtNum(v, 1)}</b>。`, '每月减重 1–2 公斤是比较安全的速度，可以咨询医生或营养师制定计划。', '中国成人标准：24–27.9 为超重，28 及以上为肥胖。', Q + 'BodyMassIndex')
    else if (v >= 24) add('info', 'BMI 略高', `最近一次 BMI ${fmtNum(v, 1)}。`, '肌肉量大的人 BMI 也会偏高，可以结合腰围一起判断。', '中国成人标准：24–27.9 为超重。', Q + 'BodyMassIndex')
  }
  const sys = cur(Q + 'BloodPressureSystolic'), dia = cur(Q + 'BloodPressureDiastolic')
  if (sys.values.length >= 3 && dia.values.length >= 3) {
    const s = mean(sys.values), d = mean(dia.values)
    if (s >= 140 || d >= 90) add('doctor', '血压偏高', `平均血压 <b>${fmtNum(s)}/${fmtNum(d)}</b> mmHg。`, '多次测量都在 140/90 以上，建议就医确认是否为高血压。少盐、控制体重、规律运动都有帮助。', '中国高血压诊断标准：收缩压 ≥140 或舒张压 ≥90 mmHg。', Q + 'BloodPressureSystolic')
    else if (s >= 130 || d >= 85) add('warning', '血压处于正常高值', `平均血压 <b>${fmtNum(s)}/${fmtNum(d)}</b> mmHg。`, '每天食盐控制在 5 克以内，坚持运动，定期复测。', '理想血压低于 120/80 mmHg。', Q + 'BloodPressureSystolic')
    else add('good', '血压正常', `平均血压 ${fmtNum(s)}/${fmtNum(d)} mmHg。`, '', '', Q + 'BloodPressureSystolic')
  }

  // ---- 听力、日光 ----
  const hp = cur(Q + 'HeadphoneAudioExposure')
  if (hp.values.length >= 5) {
    const m = mean(hp.values)
    if (m >= 80) add('warning', '耳机音量偏大', `耳机平均音量 <b>${fmtNum(m)}</b> 分贝。`, '把音量降到最大音量的 60% 以下，嘈杂环境优先用降噪而不是调大音量。', '世界卫生组织建议 80 分贝每周不超过 40 小时。', Q + 'HeadphoneAudioExposure')
  }
  const sun = cur(Q + 'TimeInDaylight')
  if (sun.values.length >= 7) {
    const m = mean(sun.values)
    if (m < 20) add('info', '晒太阳太少', `每天在日光下平均只有 <b>${fmtNum(m)}</b> 分钟。`, '尤其在北欧的冬天，白天尽量出门走走；医生也常建议冬季适量补充维生素 D。', '白天的自然光有助于稳定生物钟和情绪。', Q + 'TimeInDaylight')
  }

  // ---- 数据完整性 ----
  if (days >= 14 && data.sleep.length) {
    const coverage = nights.length / days
    if (coverage < 0.5) add('info', '睡眠记录不完整', `这段时间只有 ${fmtNum(coverage * 100)}% 的夜晚有睡眠记录。`, '如果想要更准确的分析，可以戴着手表睡觉，并在「健康」App 里开启睡眠追踪。', '')
  }

  return out
}
