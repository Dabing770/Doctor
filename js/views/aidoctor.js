// AI 医生：把健康数据摘要发给大模型，从医生的角度给出分析，并支持追问。
// 请求从浏览器直接发往模型服务商，使用用户自己的 API 密钥；本网站没有服务器。
import Anthropic, {
  APIConnectionError, APIError, APIUserAbortError, AuthenticationError, PermissionDeniedError, RateLimitError,
} from '../../vendor/anthropic.js'
import { ageFrom, buildSummary, exportSex } from '../lib/summary.js'
import { renderMarkdown } from '../lib/markdown.js'
import { checkup } from './doctor.js'
import { card, esc } from '../ui.js'

const PROVIDERS = {
  deepseek: {
    label: 'DeepSeek V4 Pro',
    company: 'DeepSeek（深度求索）',
    model: 'deepseek-v4-pro',
    keyStore: 'ai-doctor-key-deepseek',
    keyUrl: 'https://platform.deepseek.com/api_keys',
    console: 'DeepSeek 开放平台',
    placeholder: 'sk-…',
    cost: '一次完整分析大约 0.01–0.05 美元（北京时间夜间和周末更便宜），追问更便宜。',
    privacy: 'DeepSeek 的服务在中国境内运营，按其隐私政策处理这些数据。',
  },
  claude: {
    label: 'Claude Opus 5.5',
    company: 'Anthropic',
    model: 'claude-opus-5-5',
    keyStore: 'ai-doctor-key',
    keyUrl: 'https://console.anthropic.com/settings/keys',
    console: 'Anthropic 控制台',
    placeholder: 'sk-ant-…',
    cost: '一次完整分析大约 0.1–0.2 美元，追问更便宜。',
    privacy: 'Anthropic 按其 API 隐私条款处理这些数据。',
  },
}
const PROVIDER_STORE = 'ai-doctor-provider'
const PROFILE_STORE = 'ai-doctor-profile'

const SYSTEM = `你是一位经验丰富的医生，主修全科医学，同时熟悉运动医学和睡眠医学。用户会给你一份由 Apple Watch / iPhone「健康」数据整理出的统计摘要，以及他们自愿提供的年龄、性别和补充说明。请像门诊时认真看完这份资料的医生一样，用中文给出分析。

写作要求：
- 读者是普通人，不是医生。用平实的语言，专业术语第一次出现时用一句话解释。
- 每个判断都要引用摘要里的具体数字作为依据。摘要里没有的数据不要编造，也不要假设用户做过任何检查。
- 先看个人基线和变化趋势，再看与人群参考范围的比较；可穿戴设备的数值和临床测量有误差，需要时指出来。
- 结合年龄、性别和用户补充的情况（训练习惯、症状、用药、孕期等）调整判断标准；没有提供的信息不要猜测，可以说明“如果你是……则……”。
- 你不能做出诊断，也不能开药。可以说“这种模式可能与……有关”，并说明需要什么检查才能确认。
- 如果数据或用户描述里出现需要尽快就医的信号（例如反复的心律不齐通知、静息心率长期超过 100、血氧多次低于 90% 并伴有症状、胸痛、晕厥、非刻意的明显体重下降），把它放在最前面，明确建议就医或拨打急救电话，不要淡化。
- 语气温和、直接，不要制造焦虑，也不要空泛地鼓励。

第一次回答请使用以下结构（用 Markdown 二级标题）：
## 总体印象
两三句话概括这段时间的健康状况。
## 需要关注的问题
按重要程度排序，每项写：发现了什么（引用数字）、可能的原因、建议怎么做。没有就写“暂未发现需要特别关注的问题”。
## 做得好的地方
## 建议做的检查与就医时机
说明哪些情况下应该看医生、看什么科、可以做哪些检查；不需要就说明。
## 接下来 4 周的生活方式处方
3–6 条具体、可执行、可衡量的建议（例如“每周一、三、五晚饭后快走 30 分钟”），优先针对上面发现的问题。
## 数据的局限
简短说明这份分析的不足（缺少哪些数据、设备误差等）。

全文控制在 1200 字左右。之后用户追问时，直接回答问题，不必重复以上结构，仍然以数据为依据。`

// ---------- 模块状态（切换页面后保留） ----------
let provider = PROVIDERS[load(PROVIDER_STORE)] ? load(PROVIDER_STORE) : 'deepseek'
const keys = Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, load(p.keyStore) ?? '']))
const remember = Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, !!load(p.keyStore)]))
let profile = (() => { try { return JSON.parse(load(PROFILE_STORE) ?? 'null') } catch { return null } })()
let consent = false
/** 对话历史：{ role, text, claudeContent? }；claudeContent 是 Claude 返回的原始内容块（含思考块） */
let history = []
/** 显示用：{ role, text, thinking?, status?, error?, by? } */
let transcript = []
let busy = false
let abort = null
let rootRef = null
let ctxRef = null

function load(k) { try { return localStorage.getItem(k) } catch { return null } }
function save(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v) } catch { /* 隐私模式下忽略 */ } }

export function renderAiDoctor(root, ctx) {
  rootRef = root
  ctxRef = ctx
  const { data, range } = ctx
  if (!profile) {
    const age = ageFrom(data.meta.birthDate, data.meta.lastDate)
    profile = { age: age ?? '', sex: exportSex(data), notes: '' }
  }
  const P = PROVIDERS[provider]
  const started = transcript.length > 0

  root.innerHTML = `
    <section class="card ai-hero">
      <div>
        <h2>AI 医生 · 专业解读</h2>
        <p class="secondary" style="margin-top:4px">把这段时间的健康数据摘要交给大模型，让它以全科、运动医学和睡眠医学医生的视角写一份分析，之后还可以继续追问。</p>
        <p class="muted small" style="margin-top:6px">AI 的分析不是诊断，不能代替面诊。身体不适请直接就医。</p>
      </div>
    </section>

    <div class="grid two section">
      ${card('1. 选择模型并连接 API', `
        <label class="field"><span>模型</span>
          <select id="ai-provider">${Object.entries(PROVIDERS).map(([k, p]) => `<option value="${k}"${k === provider ? ' selected' : ''}>${p.label}（${p.company}）</option>`).join('')}</select>
        </label>
        <label class="field"><span>${esc(P.company)} API 密钥</span>
          <input id="ai-key" class="input" type="password" autocomplete="off" spellcheck="false" placeholder="${P.placeholder}" value="${esc(keys[provider])}" />
        </label>
        <label class="check"><input id="ai-remember" type="checkbox"${remember[provider] ? ' checked' : ''}/> 在这台设备上记住密钥</label>
        <p class="muted small">没有密钥可以在 <a href="${P.keyUrl}" target="_blank" rel="noopener">${P.console}</a> 创建并充值。密钥只保存在你的浏览器里，直接发给 ${esc(P.company)}，不会经过其他服务器。公用电脑上不要勾选“记住”。</p>
        <p class="muted small">模型：<code>${P.model}</code>。${P.cost}</p>`)}
      ${card('2. 补充个人情况（可选）', `
        <div class="field-row">
          <label class="field"><span>年龄</span><input id="ai-age" class="input" type="number" min="1" max="120" value="${esc(profile.age)}" /></label>
          <label class="field"><span>性别</span>
            <select id="ai-sex">${['', '男', '女', '其他'].map((s) => `<option value="${s}"${profile.sex === s ? ' selected' : ''}>${s || '不填写'}</option>`).join('')}</select>
          </label>
        </div>
        <label class="field"><span>其他情况</span>
          <textarea id="ai-notes" class="input" rows="4" placeholder="例如：每周跑步 3 次在备赛；最近经常觉得累、下午犯困；在服用某种药；有过敏性鼻炎……">${esc(profile.notes)}</textarea>
        </label>
        <p class="muted small">年龄和性别从导出文件中自动读取（如果有）。这些信息帮助 AI 按你的情况判断，只保存在本机。</p>`)}
    </div>

    <div class="section">
      ${card('3. 确认发送的内容', `
        <p class="small secondary">会发送给 ${esc(P.company)} 的只是一份<strong>统计摘要</strong>（各项指标的均值、趋势、睡眠与训练汇总、异常日期），以及你在上面填写的信息；不会发送原始记录或导出文件。时间范围跟随页面顶部的选择（当前 ${range.start} 至 ${range.end}）。${P.privacy}</p>
        <details class="data-table"><summary>查看将要发送的完整内容</summary><pre id="ai-preview" class="preview"></pre></details>
        <label class="check" style="margin-top:10px"><input id="ai-consent" type="checkbox"${consent ? ' checked' : ''}/> 我已了解，同意把以上内容发送给 ${esc(P.company)} 进行分析</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
          <button id="ai-start" class="btn primary">${started ? '用当前数据重新分析' : '开始分析'}</button>
          ${started ? '<button id="ai-clear" class="btn ghost">清空对话</button>' : ''}
        </div>
        <p id="ai-hint" class="error small" hidden></p>`)}
    </div>

    <div class="section" id="ai-chat-wrap" ${started ? '' : 'hidden'}>
      ${card('分析结果', `
        <div id="ai-chat" class="chat"></div>
        <form id="ai-follow" class="follow">
          <textarea id="ai-q" class="input" rows="2" placeholder="继续追问，例如：我的 HRV 为什么周一总是偏低？（Ctrl+Enter 发送）"></textarea>
          <div class="follow-actions">
            <button type="submit" id="ai-send" class="btn primary">发送</button>
            <button type="button" id="ai-stop" class="btn" hidden>停止</button>
            <button type="button" id="ai-copy" class="btn ghost">复制全部</button>
          </div>
        </form>`)}
    </div>`

  const $ = (id) => root.querySelector('#' + id)
  const readProfile = () => {
    profile = { age: $('ai-age').value, sex: $('ai-sex').value, notes: $('ai-notes').value }
    save(PROFILE_STORE, JSON.stringify(profile))
  }
  const preview = () => { $('ai-preview').textContent = currentSummary() }

  $('ai-provider').addEventListener('change', (e) => {
    provider = e.target.value
    save(PROVIDER_STORE, provider)
    consent = false // 换了接收方，需要重新确认
    ctx.rerender()
  })
  $('ai-key').addEventListener('input', (e) => {
    keys[provider] = e.target.value.trim()
    if (remember[provider]) save(P.keyStore, keys[provider])
  })
  $('ai-remember').addEventListener('change', (e) => {
    remember[provider] = e.target.checked
    save(P.keyStore, e.target.checked ? keys[provider] : null)
  })
  for (const id of ['ai-age', 'ai-sex', 'ai-notes']) $(id).addEventListener('change', () => { readProfile(); preview() })
  $('ai-consent').addEventListener('change', (e) => { consent = e.target.checked })
  root.querySelector('details.data-table').addEventListener('toggle', preview, { once: true })

  $('ai-start').addEventListener('click', () => {
    readProfile()
    const hint = $('ai-hint')
    const problem = !keys[provider] ? '请先填写 API 密钥。' : !consent ? '请先勾选同意发送。' : busy ? '上一条回答还在生成中。' : ''
    hint.hidden = !problem
    hint.textContent = problem
    if (problem) return
    history = []
    transcript = []
    ask(`以下是我的健康数据摘要，请按要求分析。\n\n${currentSummary()}`, '请分析我这段时间的健康数据')
  })
  $('ai-clear')?.addEventListener('click', () => {
    abort?.()
    history = []
    transcript = []
    ctx.rerender()
  })
  $('ai-follow').addEventListener('submit', (e) => {
    e.preventDefault()
    const q = $('ai-q').value.trim()
    if (!q || busy) return
    if (!keys[provider]) { $('ai-q').placeholder = '请先在上方填写 API 密钥'; return }
    $('ai-q').value = ''
    ask(q, q)
  })
  $('ai-q').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('ai-follow').requestSubmit() })
  $('ai-stop').addEventListener('click', () => abort?.())
  $('ai-copy').addEventListener('click', () => {
    const text = transcript.map((m) => (m.role === 'user' ? `【我】${m.text}` : `【AI 医生 · ${m.by}】\n${m.text}`)).join('\n\n')
    navigator.clipboard?.writeText(text)
    $('ai-copy').textContent = '已复制'
    setTimeout(() => { if ($('ai-copy')) $('ai-copy').textContent = '复制全部' }, 1500)
  })

  paintChat()
}

function currentSummary() {
  const { data, range } = ctxRef
  const LV = { doctor: '建议咨询医生', warning: '需要注意', info: '小提示', good: '良好' }
  const findings = checkup(data, range).map((f) => ({ title: f.title, levelLabel: LV[f.level] }))
  return buildSummary(data, range, profile ?? {}, findings)
}

// ---------- 对话 ----------
async function ask(apiText, displayText) {
  const p = provider
  history.push({ role: 'user', text: apiText })
  transcript.push({ role: 'user', text: displayText })
  const reply = { role: 'assistant', text: '', thinking: '', status: '正在阅读你的数据…', by: PROVIDERS[p].label }
  transcript.push(reply)
  busy = true
  paintChat()

  try {
    const done = p === 'deepseek' ? await streamDeepSeek(reply) : await streamClaude(reply)
    if (done.ok) history.push({ role: 'assistant', text: reply.text, claudeContent: done.claudeContent })
    else history.pop()
    if (done.warning) reply.error = done.warning
  } catch (err) {
    history.pop()
    reply.error = p === 'deepseek' ? describeDeepSeekError(err) : describeClaudeError(err)
  } finally {
    busy = false
    abort = null
    reply.status = ''
    paintChat()
  }
}

/** DeepSeek：OpenAI 兼容的 /chat/completions，SSE 流式返回 */
async function streamDeepSeek(reply) {
  const ctrl = new AbortController()
  abort = () => ctrl.abort()
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    signal: ctrl.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${keys.deepseek}` },
    body: JSON.stringify({
      model: PROVIDERS.deepseek.model,
      messages: [{ role: 'system', content: SYSTEM }, ...history.map((m) => ({ role: m.role, content: m.text }))],
      stream: true,
      reasoning_effort: 'high',
      max_tokens: 32768,
    }),
  })
  if (!res.ok) {
    let message = ''
    try { message = (await res.json()).error?.message ?? '' } catch { /* 非 JSON 错误体 */ }
    throw Object.assign(new Error(message || res.statusText), { status: res.status })
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let finish = null
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') continue
      let chunk
      try { chunk = JSON.parse(payload) } catch { continue }
      const choice = chunk.choices?.[0]
      if (!choice) continue
      const d = choice.delta ?? {}
      if (d.reasoning_content) { reply.thinking += d.reasoning_content; reply.status = '正在思考…' }
      if (d.content) { reply.text += d.content; reply.status = '' }
      if (choice.finish_reason) finish = choice.finish_reason
      paintChat()
    }
  }
  if (!reply.text) return { ok: false, warning: '没有收到回答内容，请重试。' }
  if (finish === 'length') return { ok: true, warning: '回答太长被截断了，可以让它“继续”。' }
  if (finish === 'content_filter') return { ok: true, warning: '回答被内容过滤中断了。' }
  return { ok: true }
}

/** Claude：官方 SDK，流式返回 */
async function streamClaude(reply) {
  const client = new Anthropic({ apiKey: keys.claude, dangerouslyAllowBrowser: true })
  const stream = client.beta.messages.stream({
    model: PROVIDERS.claude.model,
    max_tokens: 16000,
    system: SYSTEM,
    // 有 Claude 原始内容块（含思考块）时原样发回，否则发文字
    messages: history.map((m) => ({ role: m.role, content: m.claudeContent ?? m.text })),
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: 'high' },
    cache_control: { type: 'ephemeral' },
    // 如果请求被安全分类器拒绝，由服务器自动改用合适的备用模型重试
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
  })
  abort = () => stream.abort()
  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') { reply.text += event.delta.text; reply.status = '' }
      else if (event.delta.type === 'thinking_delta') { reply.thinking += event.delta.thinking; reply.status = '正在思考…' }
      paintChat()
    }
  }
  const final = await stream.finalMessage()
  if (final.stop_reason === 'refusal') return { ok: false, warning: 'AI 拒绝回答这个请求。可以换一种问法再试。' }
  return { ok: true, claudeContent: final.content, warning: final.stop_reason === 'max_tokens' ? '回答太长被截断了，可以让它“继续”。' : '' }
}

function describeDeepSeekError(err) {
  if (err?.name === 'AbortError') return '已停止生成。'
  switch (err?.status) {
    case 401: return 'API 密钥无效，请检查是否复制完整。'
    case 402: return '账户余额不足，请到 DeepSeek 开放平台充值。'
    case 400: case 422: return `请求参数有误：${err.message}`
    case 429: return '请求太频繁，请稍后再试。'
    case 500: case 503: return 'DeepSeek 服务器繁忙，请稍后再试。'
  }
  if (err instanceof TypeError) return '无法连接到 DeepSeek，请检查网络。'
  return `请求失败${err?.status ? `（${err.status}）` : ''}：${err?.message ?? err}`
}

function describeClaudeError(err) {
  if (err instanceof APIUserAbortError) return '已停止生成。'
  if (err instanceof AuthenticationError) return 'API 密钥无效，请检查是否复制完整。'
  if (err instanceof PermissionDeniedError) return '这个 API 密钥没有权限使用该模型，请在 Anthropic 控制台检查账户。'
  if (err instanceof RateLimitError) return '请求太频繁或额度不足，请稍后再试，或检查账户余额。'
  if (err instanceof APIConnectionError) return '无法连接到 Anthropic，请检查网络。'
  if (err instanceof APIError) return `请求失败（${err.status ?? '未知状态'}）：${err.message}`
  return '出错了：' + (err?.message ?? String(err))
}

function paintChat() {
  const root = rootRef
  if (!root || !root.isConnected) return
  const wrap = root.querySelector('#ai-chat-wrap')
  const chat = root.querySelector('#ai-chat')
  if (!wrap || !chat) return
  wrap.hidden = transcript.length === 0
  // 重绘时保持“思考过程”的展开状态
  const open = new Set([...chat.querySelectorAll('details.thinking[open]')].map((d) => d.dataset.i))
  chat.innerHTML = transcript.map((m, i) => {
    if (m.role === 'user') return `<div class="msg user"><div class="bubble">${esc(m.text)}</div></div>`
    return `<div class="msg ai">
      <p class="muted small" style="margin-bottom:4px">${esc(m.by)}</p>
      ${m.thinking ? `<details class="thinking" data-i="${i}"${open.has(String(i)) ? ' open' : ''}><summary>${m.status === '正在思考…' ? '正在思考…' : '查看思考过程'}</summary><div>${renderMarkdown(m.thinking)}</div></details>` : ''}
      ${m.status && !m.text ? `<p class="muted small typing">${m.status}</p>` : ''}
      ${m.text ? `<div class="md">${renderMarkdown(m.text)}</div>` : ''}
      ${m.error ? `<p class="error small">${esc(m.error)}</p>` : ''}
    </div>`
  }).join('')
  const send = root.querySelector('#ai-send')
  const stop = root.querySelector('#ai-stop')
  if (send) send.disabled = busy
  if (stop) stop.hidden = !busy
  const start = root.querySelector('#ai-start')
  if (start) start.disabled = busy
}
