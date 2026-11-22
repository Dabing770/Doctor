import { makeRange } from './lib/analysis.js'
import { fmtNum } from './lib/metrics.js'
import { clearData, loadData, saveData } from './store.js'
import { disposeCharts } from './charts.js'
import { renderOverview } from './views/overview.js'
import { renderTrends } from './views/trends.js'
import { renderSleep } from './views/sleep.js'
import { renderWorkouts } from './views/workouts.js'
import { renderInsights } from './views/insights.js'
import { renderAllData } from './views/alldata.js'

const VIEWS = {
  overview: renderOverview,
  trends: renderTrends,
  sleep: renderSleep,
  workouts: renderWorkouts,
  insights: renderInsights,
  all: renderAllData,
}

const $ = (id) => document.getElementById(id)
const state = {
  data: null,
  tab: 'overview',
  days: 90,
  metric: 'HKQuantityTypeIdentifierStepCount',
  busy: false,
}
let worker = null

// ---------- 渲染 ----------
function render() {
  const d = state.data
  $('landing').hidden = !!d
  $('main').hidden = !d
  if (!d) return
  const range = makeRange(d.meta.lastDate, d.meta.firstDate, state.days)
  $('meta-line').textContent = `${d.meta.demo ? '示例数据 · ' : ''}${d.meta.firstDate} 至 ${d.meta.lastDate} · ${fmtNum(d.meta.recordCount)} 条记录`
  $('range-label').textContent = `${range.start} – ${range.end}`
  for (const b of $('tabs').children) b.setAttribute('aria-selected', String(b.dataset.tab === state.tab))
  for (const b of $('ranges').children) b.setAttribute('aria-pressed', String(+b.dataset.days === state.days))

  disposeCharts()
  const ctx = {
    data: d,
    range,
    metric: state.metric,
    setMetric: (id) => { state.metric = id; render() },
    openMetric: (id) => { state.metric = id; state.tab = 'trends'; render(); scrollTo({ top: 0 }) },
    rerender: render,
  }
  VIEWS[state.tab]($('view'), ctx)
}

// ---------- 解析 ----------
function showProgress(p) {
  const pct = Math.round(p.ratio * 100)
  if (state.data) {
    $('main-status').hidden = false
    $('main-status').textContent = `正在导入新文件：${p.stage} ${pct}% · ${fmtNum(p.records)} 条`
  } else {
    $('drop-idle').hidden = true
    $('drop-busy').hidden = false
    $('busy-label').textContent = `${p.stage}… ${pct}%`
    $('busy-bar').style.width = pct + '%'
    $('busy-count').textContent = `已读取 ${fmtNum(p.records)} 条记录。大文件可能需要一两分钟，请勿关闭页面。`
  }
}

function endBusy() {
  state.busy = false
  $('drop-idle').hidden = false
  $('drop-busy').hidden = true
  $('main-status').hidden = true
  $('demo-btn').disabled = false
}

function showError(msg) {
  const el = state.data ? $('main-status') : $('landing-error')
  el.hidden = false
  el.className = state.data ? 'error small' : 'error small'
  el.textContent = msg
}

function run(msg) {
  worker?.terminate()
  worker = new Worker(new URL('./parse.worker.js', import.meta.url), { type: 'module' })
  state.busy = true
  $('landing-error').hidden = true
  $('demo-btn').disabled = true
  showProgress({ ratio: 0, records: 0, stage: '读取文件' })
  worker.onmessage = (e) => {
    const m = e.data
    if (m.kind === 'progress') return showProgress(m)
    worker.terminate()
    worker = null
    endBusy()
    if (m.kind === 'error') return showError(m.message)
    state.data = m.data
    state.tab = 'overview'
    saveData(m.data)
    render()
  }
  worker.onerror = (e) => {
    endBusy()
    showError('解析失败：' + (e.message || '未知错误') + '。如果是 zip 文件，可以先解压，再上传其中的 export.xml。')
  }
  worker.postMessage(msg)
}

const pickFile = () => { if (!state.busy) $('file-input').click() }

// ---------- 事件 ----------
$('file-input').addEventListener('change', (e) => {
  const f = e.target.files?.[0]
  if (f) run({ kind: 'file', file: f })
  e.target.value = ''
})
$('drop').addEventListener('click', pickFile)
$('drop').addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pickFile() } })
$('drop').addEventListener('dragover', (e) => { e.preventDefault(); $('drop').classList.add('over') })
$('drop').addEventListener('dragleave', () => $('drop').classList.remove('over'))
$('drop').addEventListener('drop', (e) => {
  e.preventDefault()
  $('drop').classList.remove('over')
  const f = e.dataTransfer.files[0]
  if (f && !state.busy) run({ kind: 'file', file: f })
})
$('demo-btn').addEventListener('click', () => run({ kind: 'demo' }))
$('import-btn').addEventListener('click', pickFile)
$('clear-btn').addEventListener('click', async () => {
  if (!confirm('清除本机浏览器中保存的健康数据分析结果？原始导出文件不受影响。')) return
  await clearData()
  state.data = null
  disposeCharts()
  render()
})
$('tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]')
  if (b) { state.tab = b.dataset.tab; render() }
})
$('ranges').addEventListener('click', (e) => {
  const b = e.target.closest('[data-days]')
  if (b) { state.days = +b.dataset.days; render() }
})
// 系统深浅色切换时重画图表
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render())

// ---------- 启动 ----------
const saved = await loadData()
if (saved?.version === 1) state.data = saved
render()
