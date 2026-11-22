const QP = 'HKQuantityTypeIdentifier';
const CP = 'HKCategoryTypeIdentifier';
const SLEEP = CP + 'SleepAnalysis';
const STEPS = QP + 'StepCount';
/** 一天内应求和的数量型指标（其余取平均） */
const CUMULATIVE = new Set([
    'StepCount', 'DistanceWalkingRunning', 'DistanceCycling', 'DistanceSwimming',
    'DistanceWheelchair', 'DistanceDownhillSnowSports', 'ActiveEnergyBurned',
    'BasalEnergyBurned', 'FlightsClimbed', 'AppleExerciseTime', 'AppleStandTime',
    'AppleMoveTime', 'SwimmingStrokeCount', 'PushCount', 'NikeFuel', 'TimeInDaylight',
    'NumberOfTimesFallen', 'InhalerUsage', 'UVExposure', 'NumberOfAlcoholicBeverages',
    'CyclingDistance',
].map((s) => QP + s));
/** 类别型里按分钟统计的 */
const DURATION_CATEGORIES = new Set([CP + 'MindfulSession', CP + 'HandwashingEvent', CP + 'ToothbrushingEvent']);
// ---------- 时间工具 ----------
/** 把 "2023-01-05 08:30:00 +0200" 的本地钟面时间当作 UTC 毫秒（便于做日历计算） */
export function wallMs(s) {
    return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16), +s.slice(17, 19));
}
/** 真实 UTC 毫秒（考虑时区偏移） */
export function absMs(s) {
    const sign = s.charCodeAt(20) === 45 ? -1 : 1;
    const off = (+s.slice(21, 23) * 60 + +s.slice(23, 25)) || 0;
    return wallMs(s) - sign * off * 60000;
}
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
function decodeEntities(s) {
    if (s.indexOf('&') < 0)
        return s;
    return s.replace(/&(amp|apos|quot|lt|gt|#\d+|#x[0-9a-f]+);/gi, (_, e) => {
        switch (e) {
            case 'amp': return '&';
            case 'apos': return "'";
            case 'quot': return '"';
            case 'lt': return '<';
            case 'gt': return '>';
        }
        return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    });
}
function attr(tag, name) {
    const key = ' ' + name + '="';
    const i = tag.indexOf(key);
    if (i < 0)
        return undefined;
    const s = i + key.length;
    const e = tag.indexOf('"', s);
    return e < 0 ? undefined : tag.slice(s, e);
}
export class Aggregator {
    buf = '';
    records = 0;
    sources = [];
    sourceIdx = new Map();
    types = new Map();
    sleep = new Map();
    workouts = [];
    open = null;
    activity = [];
    exportDate;
    birthDate;
    sex;
    /** sourceIdx -> 168 小时格累计步数 */
    stepGrid = new Map();
    stepDays = new Map();
    weekdayCache = new Map();
    /** 喂入一段解码后的文本（可在任意位置截断） */
    feed(text) {
        const buf = this.buf + text;
        let pos = 0;
        for (;;) {
            const lt = buf.indexOf('<', pos);
            if (lt < 0) {
                pos = buf.length;
                break;
            }
            const gt = buf.indexOf('>', lt + 1);
            if (gt < 0) {
                pos = lt;
                break;
            }
            this.tag(buf, lt, gt);
            pos = gt + 1;
        }
        this.buf = buf.slice(pos);
    }
    src(name) {
        const n = decodeEntities(name ?? '未知来源');
        let i = this.sourceIdx.get(n);
        if (i === undefined) {
            i = this.sources.length;
            this.sources.push(n);
            this.sourceIdx.set(n, i);
        }
        return i;
    }
    weekday(day) {
        let w = this.weekdayCache.get(day);
        if (w === undefined) {
            w = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10))).getUTCDay();
            this.weekdayCache.set(day, w);
        }
        return w;
    }
    tag(buf, lt, gt) {
        const c = buf.charCodeAt(lt + 1);
        // R
        if (c === 82) {
            if (buf.startsWith('Record ', lt + 1))
                this.record(buf.slice(lt, gt + 1));
            return;
        }
        // W
        if (c === 87) {
            if (buf.startsWith('WorkoutStatistics ', lt + 1))
                this.workoutStat(buf.slice(lt, gt + 1));
            else if (buf.startsWith('Workout ', lt + 1))
                this.workoutStart(buf.slice(lt, gt + 1));
            return;
        }
        // /
        if (c === 47) {
            if (buf.startsWith('/Workout>', lt + 1))
                this.workoutEnd();
            return;
        }
        // A
        if (c === 65) {
            if (buf.startsWith('ActivitySummary ', lt + 1))
                this.activitySummary(buf.slice(lt, gt + 1));
            return;
        }
        if (c === 77 && buf.startsWith('Me ', lt + 1)) {
            const t = buf.slice(lt, gt + 1);
            this.birthDate = attr(t, 'HKCharacteristicTypeIdentifierDateOfBirth') || undefined;
            this.sex = attr(t, 'HKCharacteristicTypeIdentifierBiologicalSex') || undefined;
            return;
        }
        if (c === 69 && buf.startsWith('ExportDate ', lt + 1)) {
            this.exportDate = attr(buf.slice(lt, gt + 1), 'value');
        }
    }
    record(t) {
        const type = attr(t, 'type');
        const start = attr(t, 'startDate');
        if (!type || !start)
            return;
        this.records++;
        const value = attr(t, 'value');
        const sIdx = this.src(attr(t, 'sourceName'));
        if (type === SLEEP) {
            const end = attr(t, 'endDate');
            if (end && value)
                this.sleepRecord(start, end, value, sIdx);
            this.touchType(type, 'category', '', start.slice(0, 10), sIdx);
            return;
        }
        const isCat = type.startsWith(CP);
        const day = start.slice(0, 10);
        const st = this.touchType(type, isCat ? 'category' : 'quantity', attr(t, 'unit') ?? '', day, sIdx);
        let v;
        let dur = 0;
        if (isCat) {
            if (type === CP + 'AppleStandHour' && value && !value.endsWith('Stood'))
                return;
            const end = attr(t, 'endDate');
            dur = end ? Math.max(0, (absMs(end) - absMs(start)) / 60000) : 0;
            v = dur;
        }
        else {
            v = value === undefined ? NaN : +value;
            if (!Number.isFinite(v))
                return;
        }
        let byDay = st.days.get(day);
        if (!byDay)
            st.days.set(day, (byDay = new Map()));
        const a = byDay.get(sIdx);
        if (a) {
            a[0] += v;
            if (v < a[1])
                a[1] = v;
            if (v > a[2])
                a[2] = v;
            a[3]++;
        }
        else
            byDay.set(sIdx, [v, v, v, 1]);
        if (type === STEPS) {
            let g = this.stepGrid.get(sIdx);
            if (!g) {
                this.stepGrid.set(sIdx, (g = new Float64Array(168)));
                this.stepDays.set(sIdx, new Set());
            }
            g[this.weekday(day) * 24 + +start.slice(11, 13)] += v;
            this.stepDays.get(sIdx).add(day);
        }
    }
    touchType(type, kind, unit, day, sIdx) {
        let st = this.types.get(type);
        if (!st) {
            st = { kind, unit, records: 0, first: day, last: day, sources: new Set(), days: new Map() };
            this.types.set(type, st);
        }
        st.records++;
        if (day < st.first)
            st.first = day;
        if (day > st.last)
            st.last = day;
        st.sources.add(sIdx);
        return st;
    }
    sleepRecord(start, end, value, sIdx) {
        const ws = wallMs(start);
        const we = ws + (absMs(end) - absMs(start));
        const night = dayOf(ws + 12 * 3600000);
        const base = Date.UTC(+night.slice(0, 4), +night.slice(5, 7) - 1, +night.slice(8, 10));
        const s = (ws - base) / 60000;
        const e = (we - base) / 60000;
        const mins = e - s;
        if (!(mins > 0) || mins > 24 * 60)
            return;
        let bySrc = this.sleep.get(night);
        if (!bySrc)
            this.sleep.set(night, (bySrc = new Map()));
        let a = bySrc.get(sIdx);
        if (!a) {
            a = { inBed: 0, deep: 0, core: 0, rem: 0, awake: 0, unspecified: 0, start: Infinity, end: -Infinity, inBedStart: Infinity, inBedEnd: -Infinity };
            bySrc.set(sIdx, a);
        }
        const kind = value.replace('HKCategoryValueSleepAnalysis', '');
        switch (kind) {
            case 'InBed':
                a.inBed += mins;
                a.inBedStart = Math.min(a.inBedStart, s);
                a.inBedEnd = Math.max(a.inBedEnd, e);
                return;
            case 'Awake':
                a.awake += mins;
                return;
            case 'AsleepCore':
                a.core += mins;
                break;
            case 'AsleepDeep':
                a.deep += mins;
                break;
            case 'AsleepREM':
                a.rem += mins;
                break;
            default: a.unspecified += mins;
        }
        a.start = Math.min(a.start, s);
        a.end = Math.max(a.end, e);
    }
    workoutStart(t) {
        this.records++;
        const start = attr(t, 'startDate') ?? '';
        const end = attr(t, 'endDate') ?? start;
        const durAttr = attr(t, 'duration');
        const durUnit = attr(t, 'durationUnit') ?? 'min';
        let duration = durAttr ? +durAttr : (absMs(end) - absMs(start)) / 60000;
        if (durUnit === 'hr')
            duration *= 60;
        else if (durUnit === 's')
            duration /= 60;
        const dist = attr(t, 'totalDistance');
        const energy = attr(t, 'totalEnergyBurned');
        const w = {
            type: (attr(t, 'workoutActivityType') ?? 'Other').replace('HKWorkoutActivityType', ''),
            date: start.slice(0, 10),
            start: start.slice(0, 16),
            end: end.slice(0, 16),
            duration,
            distance: dist ? +dist : undefined,
            distanceUnit: attr(t, 'totalDistanceUnit'),
            energy: energy ? +energy : undefined,
            source: this.sources[this.src(attr(t, 'sourceName'))],
            distSum: 0,
            energySum: 0,
        };
        if (t.endsWith('/>'))
            this.finishWorkout(w);
        else
            this.open = w;
    }
    workoutStat(t) {
        const w = this.open;
        if (!w)
            return;
        const type = attr(t, 'type') ?? '';
        if (type === QP + 'HeartRate') {
            const avg = attr(t, 'average');
            const max = attr(t, 'maximum');
            if (avg)
                w.avgHR = +avg;
            if (max)
                w.maxHR = +max;
        }
        else if (type === QP + 'ActiveEnergyBurned') {
            w.energySum += +(attr(t, 'sum') ?? 0) || 0;
        }
        else if (type.startsWith(QP + 'Distance')) {
            w.distSum += +(attr(t, 'sum') ?? 0) || 0;
            w.distanceUnit ??= attr(t, 'unit');
        }
    }
    workoutEnd() {
        if (this.open)
            this.finishWorkout(this.open);
        this.open = null;
    }
    finishWorkout(w) {
        const { distSum, energySum, ...rest } = w;
        if (!rest.distance && distSum > 0)
            rest.distance = distSum;
        if (!rest.energy && energySum > 0)
            rest.energy = energySum;
        if (!rest.distance) {
            delete rest.distance;
            delete rest.distanceUnit;
        }
        if (!rest.energy)
            delete rest.energy;
        this.workouts.push(rest);
    }
    activitySummary(t) {
        const date = attr(t, 'dateComponents');
        if (!date)
            return;
        const n = (k) => +(attr(t, k) ?? 0) || 0;
        this.activity.push({
            date,
            move: n('activeEnergyBurned') || n('appleMoveTime'),
            moveGoal: n('activeEnergyBurnedGoal') || n('appleMoveTimeGoal'),
            exercise: n('appleExerciseTime'),
            exerciseGoal: n('appleExerciseTimeGoal'),
            stand: n('appleStandHours'),
            standGoal: n('appleStandHoursGoal'),
        });
    }
    finish(fileName) {
        const types = {};
        const daily = {};
        let firstDate = '9999';
        let lastDate = '0000';
        for (const [id, st] of this.types) {
            let agg;
            if (st.kind === 'category')
                agg = DURATION_CATEGORIES.has(id) ? 'duration' : 'count';
            else
                agg = CUMULATIVE.has(id) || id.startsWith(QP + 'Dietary') ? 'sum' : 'avg';
            types[id] = {
                id, kind: st.kind, unit: st.unit, agg, records: st.records, first: st.first, last: st.last,
                sources: [...st.sources].map((i) => this.sources[i]),
            };
            if (st.first < firstDate)
                firstDate = st.first;
            if (st.last > lastDate)
                lastDate = st.last;
            if (id === SLEEP)
                continue;
            const days = [...st.days.keys()].sort();
            const s = { days, values: [], min: [], max: [], n: [] };
            for (const d of days) {
                const bySrc = st.days.get(d);
                let sum = 0, n = 0, mn = Infinity, mx = -Infinity;
                let best = null;
                for (const a of bySrc.values()) {
                    sum += a[0];
                    n += a[3];
                    if (a[1] < mn)
                        mn = a[1];
                    if (a[2] > mx)
                        mx = a[2];
                    // 多个设备（iPhone + Apple Watch）会重复记录累计量，取当天最大的单一来源
                    if (!best || (agg === 'count' ? a[3] > best[3] : a[0] > best[0]))
                        best = a;
                }
                let v;
                if (agg === 'avg')
                    v = sum / n;
                else if (agg === 'count')
                    v = best[3];
                else
                    v = best[0];
                s.values.push(v);
                s.min.push(agg === 'avg' ? mn : v);
                s.max.push(agg === 'avg' ? mx : v);
                s.n.push(n);
            }
            daily[id] = s;
        }
        // 睡眠：每晚优先选有分期数据、睡眠时长最长的来源
        const sleep = [];
        for (const night of [...this.sleep.keys()].sort()) {
            let pick = null;
            let maxInBed = 0;
            for (const [sIdx, a] of this.sleep.get(night)) {
                const asleep = a.deep + a.core + a.rem + a.unspecified;
                const hasStages = a.deep + a.core + a.rem > 0;
                const hasAsleep = asleep > 0;
                const n = {
                    date: night,
                    inBed: Math.round(a.inBed),
                    asleep: Math.round(asleep),
                    deep: Math.round(a.deep),
                    core: Math.round(a.core),
                    rem: Math.round(a.rem),
                    awake: Math.round(a.awake),
                    unspecified: Math.round(a.unspecified),
                    bedtime: Math.round(hasAsleep ? a.start : a.inBedStart),
                    wake: Math.round(hasAsleep ? a.end : a.inBedEnd),
                    source: this.sources[sIdx],
                    hasStages,
                };
                maxInBed = Math.max(maxInBed, n.inBed);
                if (!Number.isFinite(n.bedtime) || !Number.isFinite(n.wake))
                    continue;
                if (!pick ||
                    (n.hasStages && !pick.hasStages) ||
                    (n.hasStages === pick.hasStages && (n.asleep > pick.asleep || (n.asleep === pick.asleep && n.inBed > pick.inBed))))
                    pick = n;
            }
            // 卧床时间常由 iPhone 记录，而分期来自手表：合并取最大值
            if (pick && pick.inBed === 0)
                pick.inBed = maxInBed;
            if (pick && (pick.asleep >= 30 || pick.inBed >= 60))
                sleep.push(pick);
        }
        // 每小时步数（选总量最大的来源，避免重复计）
        let stepsByHour = null;
        let bestSrc = -1, bestTotal = 0;
        for (const [sIdx, g] of this.stepGrid) {
            const tot = g.reduce((x, y) => x + y, 0);
            if (tot > bestTotal) {
                bestTotal = tot;
                bestSrc = sIdx;
            }
        }
        if (bestSrc >= 0) {
            const g = this.stepGrid.get(bestSrc);
            const cnt = new Array(7).fill(0);
            for (const d of this.stepDays.get(bestSrc))
                cnt[this.weekday(d)]++;
            stepsByHour = Array.from({ length: 7 }, (_, w) => Array.from({ length: 24 }, (_, h) => (cnt[w] ? Math.round(g[w * 24 + h] / cnt[w]) : 0)));
        }
        this.workouts.sort((a, b) => a.start.localeCompare(b.start));
        this.activity.sort((a, b) => a.date.localeCompare(b.date));
        return {
            version: 1,
            meta: {
                fileName,
                parsedAt: new Date().toISOString(),
                exportDate: this.exportDate,
                recordCount: this.records,
                firstDate: firstDate === '9999' ? '' : firstDate,
                lastDate: lastDate === '0000' ? '' : lastDate,
                birthDate: this.birthDate,
                sex: this.sex,
                sources: this.sources,
            },
            types,
            daily,
            sleep,
            workouts: this.workouts,
            activity: this.activity,
            stepsByHour,
        };
    }
}
