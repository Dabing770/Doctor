# 健康数据分析

在浏览器里可视化和分析 iPhone「健康」App 导出的数据。纯 HTML + CSS + JavaScript，不需要构建，可以直接用 GitHub Pages 发布。

**隐私**：你选择的文件只在自己的浏览器里解析，不会上传到 GitHub 或任何服务器。只有在「AI 医生」页面主动点击分析时，才会把一份统计摘要发送给 Anthropic API（见下文）。解析结果保存在当前设备浏览器的 IndexedDB 中，可在页面上「清除数据」。仓库里只有网页代码，没有任何健康数据。

## 使用

1. iPhone「健康」App → 右上角头像 → 「导出所有健康数据」，得到「导出.zip」。
2. 打开网页，把 zip（或解压后的 `export.xml`／`导出.xml`）拖进去，或点击选择文件。手机上也能在「文件」里直接选择。
3. 可以先点「先用示例数据看看」。

## 页面

- **概览**：主要指标的区间均值、与上一周期对比、12 周走势；健身记录圆环达成率；一周步数节律热力图。
- **趋势**：任一指标按日、周、月查看，含 7 日平均、当日范围、统计值、星期规律和数据表。
- **睡眠**：每晚分期、作息时间、规律性、睡眠效率。
- **运动**：按类型汇总的训练次数、时长、距离、心率和配速。
- **洞察**：自动总结、指标相关性矩阵（可错开一天）、散点图、基于个人 28 天基线的异常日。
- **小医生**：根据数据给出健康提醒，按「建议咨询医生／需要注意／小提示／保持得不错」分级，涵盖睡眠、静息心率、HRV、心脏通知、血氧、可能生病的信号、活动量、体重、BMI、血压、耳机音量、日光等；附日常叮嘱和需要及时就医的情况。这些只是基于公共健康建议的提醒，不是诊断。
- **AI 医生**：把健康数据的统计摘要发给 Claude（Claude Opus 5.5），从全科、运动医学和睡眠医学医生的角度写一份分析报告，并可以继续追问。见下文。
- **全部数据**：导出里所有数据类型、记录数和来源。

## AI 医生

- 需要自己的 Anthropic API 密钥（在 https://console.anthropic.com/settings/keys 创建，建议设置每月花费上限）。每位使用者用自己的密钥，网站本身不保存任何密钥。
- 请求从浏览器直接发往 `api.anthropic.com`，使用官方 TypeScript SDK（`vendor/anthropic.js`，浏览器模式）。密钥默认只留在当前页面；勾选“记住”后保存在本机浏览器的 localStorage 中，公用电脑上不要勾选。
- 发送的内容是统计摘要（各指标均值、趋势、个人基线、睡眠与训练汇总、异常日期）和你自愿填写的年龄、性别、补充说明，不发送原始记录。发送前可以在页面上查看完整内容，并需要勾选同意。
- 使用自适应思考和 `effort: high`；启用了服务器端备用模型（`fallbacks: "default"`），请求被安全分类器拒绝时会自动改用合适的模型重试。
- 一次完整分析约 0.1–0.2 美元，追问更便宜。
- AI 的分析不是诊断，不能代替面诊。提示词在 `js/views/aidoctor.js` 的 `SYSTEM` 中，可按需修改。

## 发布到 GitHub Pages

1. 在 GitHub 新建仓库，把本目录的文件推送到 `main` 分支。
2. 仓库 → Settings → Pages → Build and deployment：Source 选 **Deploy from a branch**，Branch 选 `main`、文件夹 `/ (root)`，保存。
3. 一两分钟后访问 `https://<用户名>.github.io/<仓库名>/`。

免费账号的 GitHub Pages 需要公开仓库。代码公开没关系，健康数据不会进仓库；`.gitignore` 也已排除 zip 和 xml 文件，防止误提交。

## 本地预览

网页使用 ES 模块和 Web Worker，不能直接双击 `index.html` 打开，需要一个本地服务器：

```powershell
python -m http.server 5180
```

然后访问 http://localhost:5180 。

## 目录

```
index.html            页面结构
css/style.css         样式（含深色模式）
js/app.js             状态、导入、页面切换
js/parse.worker.js    后台线程：流式解压 zip、解析 XML
js/lib/aggregate.js   把数百万条记录按天聚合
js/lib/analysis.js    滚动平均、相关性、异常检测等
js/lib/metrics.js     指标名称、单位与格式化
js/lib/demo.js        生成随机示例数据
js/views/*.js         八个页面（含 doctor.js 小医生、aidoctor.js AI 医生）
js/lib/summary.js     生成发给 AI 的统计摘要
js/lib/markdown.js    渲染 AI 回答的简易 Markdown
vendor/               ECharts 6.1.0、fflate 0.8.3、@anthropic-ai/sdk 1.12.0（本地副本，不依赖外部 CDN）
```

## 数据处理说明

- iPhone 和 Apple Watch 会重复记录步数等累计量，每天只取记录量最大的那个来源。
- 睡眠归到醒来那天；同一晚有多个来源时，优先选有分期数据的。
- 分析结果仅供参考，不构成医疗建议。
