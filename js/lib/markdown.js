// 极简 Markdown 渲染：先转义 HTML，再处理标题、列表、表格、引用、粗体和行内代码。
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
}

export function renderMarkdown(src) {
  const lines = src.replace(/\r/g, '').split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }

    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const lv = Math.min(4, h[1].length + 1)
      out.push(`<h${lv}>${inline(h[2])}</h${lv}>`)
      i++
      continue
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) { out.push('<hr/>'); i++; continue }

    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = cells(line)
      i += 2
      const rows = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(cells(lines[i++]))
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`)
      continue
    }

    if (/^\s*>/.test(line)) {
      const buf = []
      while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''))
      out.push(`<blockquote>${buf.map(inline).join('<br/>')}</blockquote>`)
      continue
    }

    const listRe = /^(\s*)([-*•]|\d+[.)])\s+(.*)$/
    if (listRe.test(line)) {
      const ordered = /^\s*\d/.test(line)
      const items = []
      while (i < lines.length && (listRe.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && items.length))) {
        const m = lines[i].match(listRe)
        if (m && m[1].length < 2) items.push(m[3])
        else if (m) items[items.length - 1] += `<br/>· ${m[3]}`
        else items[items.length - 1] += ' ' + lines[i].trim()
        i++
      }
      const tag = ordered ? 'ol' : 'ul'
      out.push(`<${tag}>${items.map((it) => `<li>${it.includes('<br/>· ') ? it.split('<br/>· ').map((p, k) => (k ? '<br/>· ' : '') + inline(p)).join('') : inline(it)}</li>`).join('')}</${tag}>`)
      continue
    }

    const para = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\s*>|\s*([-*•]|\d+[.)])\s|\s*\|)/.test(lines[i])) para.push(lines[i++])
    if (!para.length) para.push(lines[i++])
    out.push(`<p>${para.map(inline).join('<br/>')}</p>`)
  }
  return out.join('\n')
}
