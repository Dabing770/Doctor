export const dayNum = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
export const numDay = (n) => new Date(n * 86400000).toISOString().slice(0, 10);
export const weekdayOf = (d) => new Date(dayNum(d) * 86400000).getUTCDay();
export const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
/** 周一开始的显示顺序 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
/** 以数据最后一天为终点的区间；days = 0 表示全部 */
export function makeRange(lastDate, firstDate, days) {
    if (!days)
        return { start: firstDate, end: lastDate };
    return { start: numDay(dayNum(lastDate) - days + 1), end: lastDate };
}
export function previousRange(r) {
    const len = dayNum(r.end) - dayNum(r.start) + 1;
    return { start: numDay(dayNum(r.start) - len), end: numDay(dayNum(r.start) - 1) };
}
export function slice(s, r) {
    let i = 0;
    while (i < s.days.length && s.days[i] < r.start)
        i++;
    let j = i;
    while (j < s.days.length && s.days[j] <= r.end)
        j++;
    return {
        days: s.days.slice(i, j),
        values: s.values.slice(i, j),
        min: s.min?.slice(i, j),
        max: s.max?.slice(i, j),
    };
}
export const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
export function median(a) {
    if (!a.length)
        return NaN;
    const s = [...a].sort((x, y) => x - y);
    const k = s.length >> 1;
    return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2;
}
export function std(a) {
    if (a.length < 2)
        return NaN;
    const m = mean(a);
    return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
}
/** 按日历天的滚动平均 */
export function rolling(s, window = 7) {
    const nums = s.days.map(dayNum);
    const out = [];
    let lo = 0;
    let sum = 0;
    for (let i = 0; i < nums.length; i++) {
        sum += s.values[i];
        while (nums[lo] <= nums[i] - window)
            sum -= s.values[lo++];
        out.push(sum / (i - lo + 1));
    }
    return out;
}
/** 周/月重采样：取每日值的平均 */
export function resample(s, grain) {
    if (grain === 'day')
        return s;
    const keys = [];
    const sums = [];
    const cnt = [];
    for (let i = 0; i < s.days.length; i++) {
        const d = s.days[i];
        let k;
        if (grain === 'month')
            k = d.slice(0, 7) + '-01';
        else {
            const n = dayNum(d);
            k = numDay(n - ((weekdayOf(d) + 6) % 7));
        }
        if (keys[keys.length - 1] !== k) {
            keys.push(k);
            sums.push(0);
            cnt.push(0);
        }
        sums[sums.length - 1] += s.values[i];
        cnt[cnt.length - 1]++;
    }
    return { days: keys, values: sums.map((v, i) => v / cnt[i]) };
}
/** 线性趋势：返回每 30 天的变化量 */
export function trendPer30(s) {
    if (s.values.length < 10)
        return NaN;
    const x = s.days.map(dayNum);
    const mx = mean(x);
    const my = mean(s.values);
    let num = 0, den = 0;
    for (let i = 0; i < x.length; i++) {
        num += (x[i] - mx) * (s.values[i] - my);
        den += (x[i] - mx) ** 2;
    }
    return den ? (num / den) * 30 : NaN;
}
/** 按日期对齐两个序列 */
export function align(a, b, lag = 0) {
    const mb = new Map();
    b.days.forEach((d, i) => mb.set(dayNum(d), b.values[i]));
    const xs = [], ys = [], ds = [];
    a.days.forEach((d, i) => {
        const v = mb.get(dayNum(d) + lag);
        if (v !== undefined) {
            xs.push(a.values[i]);
            ys.push(v);
            ds.push(d);
        }
    });
    return [xs, ys, ds];
}
export function pearson(x, y) {
    const n = x.length;
    if (n < 3)
        return NaN;
    const mx = mean(x), my = mean(y);
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < n; i++) {
        sxy += (x[i] - mx) * (y[i] - my);
        sxx += (x[i] - mx) ** 2;
        syy += (y[i] - my) ** 2;
    }
    return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}
export function linfit(x, y) {
    const mx = mean(x), my = mean(y);
    let num = 0, den = 0;
    for (let i = 0; i < x.length; i++) {
        num += (x[i] - mx) * (y[i] - my);
        den += (x[i] - mx) ** 2;
    }
    const b = den ? num / den : 0;
    return { a: my - b * mx, b };
}
export function weekdayMeans(s) {
    const sum = new Array(7).fill(0);
    const cnt = new Array(7).fill(0);
    s.days.forEach((d, i) => { const w = weekdayOf(d); sum[w] += s.values[i]; cnt[w]++; });
    return sum.map((v, i) => (cnt[i] ? v / cnt[i] : NaN));
}
/** 与前 28 天基线相比偏离 ≥ 2 个标准差的日子 */
export function anomalies(s, dir, window = 28, threshold = 2) {
    const nums = s.days.map(dayNum);
    const out = [];
    let lo = 0;
    for (let i = 0; i < nums.length; i++) {
        while (nums[lo] < nums[i] - window)
            lo++;
        const base = s.values.slice(lo, i);
        if (base.length < 10)
            continue;
        const m = mean(base);
        const sd = std(base);
        if (!(sd > 0))
            continue;
        const z = (s.values[i] - m) / sd;
        if ((dir !== 'down' && z >= threshold) || (dir !== 'up' && z <= -threshold)) {
            out.push({ date: s.days[i], value: s.values[i], baseline: m, z });
        }
    }
    return out;
}
export const pct = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : NaN);
