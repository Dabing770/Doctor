// ECharts 封装：颜色全部来自 CSS 变量，深浅色自动切换。
const echarts = window.echarts
let instances = []

export function tokens() {
  const cs = getComputedStyle(document.documentElement)
  const g = (n) => cs.getPropertyValue(n).trim()
  return {
    surface: g('--surface-1'), surface2: g('--surface-2'), text: g('--text-primary'), text2: g('--text-secondary'),
    muted: g('--text-muted'), grid: g('--grid'), axis: g('--axis'), deemph: g('--deemph'),
    series: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => g(`--series-${i}`)),
    seq: ['100', '250', '400', '600', '700'].map((s) => g(`--seq-${s}`)),
    divNeg: g('--div-neg'), divMid: g('--div-mid'), divPos: g('--div-pos'),
    good: g('--good'), warning: g('--warning'), accentSoft: g('--accent-soft'),
  }
}

/** 所有图表共用的坐标轴、网格、提示框样式 */
export function base(t) {
  const axisCommon = {
    axisLine: { lineStyle: { color: t.axis } },
    axisTick: { show: false },
    axisLabel: { color: t.muted, fontSize: 11 },
    splitLine: { lineStyle: { color: t.grid, width: 1 } },
  }
  return {
    animationDuration: 300,
    textStyle: { fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: t.surface,
      borderColor: t.axis,
      borderWidth: 1,
      textStyle: { color: t.text, fontSize: 12 },
      extraCssText: 'border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,.12);',
      axisPointer: { type: 'line', lineStyle: { color: t.axis, width: 1 } },
    },
    xAxisCommon: { ...axisCommon, splitLine: { show: false } },
    yAxisCommon: { ...axisCommon, axisLine: { show: false } },
  }
}

/** 在某个元素里画图；返回实例 */
export function chart(el, option, onClick) {
  if (!el) return null
  const c = echarts.init(el, undefined, { renderer: 'canvas' })
  c.setOption(option)
  if (onClick) c.on('click', onClick)
  instances.push(c)
  return c
}

export function disposeCharts() {
  for (const c of instances) c.dispose()
  instances = []
}

addEventListener('resize', () => { for (const c of instances) c.resize() })

export const dotHtml = (color, square) =>
  `<span style="display:inline-block;width:8px;height:8px;border-radius:${square ? 2 : 4}px;background:${color};margin-right:6px"></span>`
