// 在后台线程里解析导出文件，避免页面卡住。
import { Unzip, UnzipInflate } from '../vendor/fflate.js'
import { Aggregator } from './lib/aggregate.js'
import { generateDemoXml } from './lib/demo.js'

/** 主导出文件：export.xml（中文系统为“导出.xml”），排除 export_cda.xml 临床文档 */
const isMainXml = (name) => /\.xml$/i.test(name) && !/cda/i.test(name) && !/__MACOSX/.test(name)

async function parse(file, name, zip) {
  const agg = new Aggregator()
  const decoder = new TextDecoder('utf-8')
  let read = 0
  let lastPost = 0
  let found = !zip
  const total = file.size || 1
  const onText = (bytes, final) => agg.feed(decoder.decode(bytes, { stream: !final }))

  let unzip = null
  if (zip) {
    unzip = new Unzip()
    unzip.register(UnzipInflate)
    unzip.onfile = (f) => {
      if (found || !isMainXml(f.name)) return
      found = true
      f.ondata = (err, chunk, final) => {
        if (err) throw err
        onText(chunk, final)
      }
      f.start()
    }
  }

  const reader = file.stream().getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    read += value.length
    if (unzip) unzip.push(value)
    else onText(value, false)
    const now = performance.now()
    if (now - lastPost > 150) {
      lastPost = now
      postMessage({ kind: 'progress', ratio: read / total, records: agg.records, stage: '解析中' })
    }
  }
  if (unzip) unzip.push(new Uint8Array(0), true)
  else onText(new Uint8Array(0), true)

  if (!found) throw new Error('压缩包里没有找到 export.xml。请确认上传的是“导出所有健康数据”得到的 zip 文件。')
  if (agg.records === 0) throw new Error('文件里没有找到健康记录。请确认这是苹果健康的导出文件。')
  postMessage({ kind: 'progress', ratio: 1, records: agg.records, stage: '汇总中' })
  return agg.finish(name)
}

self.onmessage = async (e) => {
  try {
    const msg = e.data
    if (msg.kind === 'demo') {
      postMessage({ kind: 'progress', ratio: 0, records: 0, stage: '生成示例数据' })
      const data = await parse(generateDemoXml(), '示例数据', false)
      data.meta.demo = true
      postMessage({ kind: 'done', data })
    } else {
      const f = msg.file
      const head = new Uint8Array(await f.slice(0, 4).arrayBuffer())
      const zip = head[0] === 0x50 && head[1] === 0x4b // "PK"
      postMessage({ kind: 'done', data: await parse(f, f.name, zip) })
    }
  } catch (err) {
    postMessage({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
