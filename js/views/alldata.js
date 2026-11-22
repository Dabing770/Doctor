import { fmtNum, metricDef } from '../lib/metrics.js'
import { card, esc } from '../ui.js'

let query = ''

export function renderAllData(root, { data, openMetric }) {
  const m = data.meta
  root.innerHTML = `
    <div class="grid two">
      ${card('导出信息', `<table><tbody>
        <tr><td class="muted">文件</td><td>${esc(m.fileName)}</td></tr>
        ${m.exportDate ? `<tr><td class="muted">导出时间</td><td>${esc(m.exportDate)}</td></tr>` : ''}
        <tr><td class="muted">数据范围</td><td>${m.firstDate} 至 ${m.lastDate}</td></tr>
        <tr><td class="muted">记录数</td><td>${fmtNum(m.recordCount)}</td></tr>
        <tr><td class="muted">数据类型</td><td>${Object.keys(data.types).length} 种</td></tr>
        <tr><td class="muted">睡眠 / 训练</td><td>${data.sleep.length} 晚 / ${data.workouts.length} 次</td></tr>
      </tbody></table>`)}
      ${card('数据来源', `<div style="display:flex;flex-wrap:wrap;gap:6px">${m.sources.map((s) => `<span class="badge">${esc(s)}</span>`).join('')}</div>`,
        { sub: '同一指标有多个设备记录时（如 iPhone 与 Apple Watch 都计步），累计量取当天记录最多的单一来源，避免重复计算。' })}
    </div>
    <div class="section">
      ${card('全部数据类型', '<div class="table-wrap"><table id="types-table"></table></div>',
        { right: `<input type="search" id="type-search" class="input" placeholder="搜索" value="${esc(query)}" />` })}
    </div>`

  const table = root.querySelector('#types-table')
  const draw = () => {
    const rows = Object.values(data.types)
      .map((tp) => ({ tp, def: metricDef(tp.id, data), sleep: tp.id.endsWith('SleepAnalysis') }))
      .filter(({ tp, def }) => !query || (def.label + tp.id).toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.tp.records - a.tp.records)
    table.innerHTML = `<thead><tr><th>名称</th><th>类别</th><th class="num">记录数</th><th>最早</th><th>最晚</th><th>单位</th><th>来源</th></tr></thead>
      <tbody>${rows.map(({ tp, def, sleep }) => {
        const target = sleep ? 'sleep.asleep' : data.daily[tp.id] ? tp.id : ''
        return `<tr class="${target ? 'clickable' : ''}" data-target="${esc(target)}">
          <td>${sleep ? '睡眠分析' : esc(def.label)}<div class="muted" style="font-size:11px">${esc(tp.id.replace(/^HK\w+?TypeIdentifier/, ''))}</div></td>
          <td>${esc(sleep ? '睡眠' : def.group)}</td>
          <td class="num">${fmtNum(tp.records)}</td>
          <td>${tp.first}</td><td>${tp.last}</td>
          <td>${esc(tp.unit || '—')}</td>
          <td style="white-space:normal;min-width:160px">${tp.sources.map(esc).join('、')}</td>
        </tr>`
      }).join('')}</tbody>`
  }
  draw()
  table.addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-target]')
    if (tr?.dataset.target) openMetric(tr.dataset.target)
  })
  root.querySelector('#type-search').addEventListener('input', (e) => { query = e.target.value; draw() })
}
