// 生成一份结构与真实导出一致的模拟 export.xml，用于演示和测试解析流程。
// 数据为随机合成，不代表任何真实个人。
const DAY = 86400000;
const HOUR = 3600000;
const TZ = ' +0200';
function rng(seed) {
    return () => {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const fmt = (ms) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ') + TZ;
const Q = 'HKQuantityTypeIdentifier';
const C = 'HKCategoryTypeIdentifier';
const WATCH = 'Apple Watch';
const PHONE = 'iPhone';
const SCALE = 'Health &amp; Fitness Scale';
export function generateDemoXml(days = 730, endDay = new Date()) {
    const r = rng(20261122);
    const gauss = () => {
        let u = 0, v = 0;
        while (u === 0)
            u = r();
        while (v === 0)
            v = r();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    const parts = [];
    let chunk = [];
    const out = (s) => {
        chunk.push(s);
        if (chunk.length > 2000) {
            parts.push(chunk.join(''));
            chunk = [];
        }
    };
    const rec = (type, src, unit, s, e, v) => out(`<Record type="${type}" sourceName="${src}" sourceVersion="17.0" unit="${unit}" creationDate="${fmt(e)}" startDate="${fmt(s)}" endDate="${fmt(e)}" value="${v}"/>\n`);
    const cat = (type, src, s, e, v) => out(`<Record type="${type}" sourceName="${src}" sourceVersion="17.0" creationDate="${fmt(e)}" startDate="${fmt(s)}" endDate="${fmt(e)}" value="${v}">\n <MetadataEntry key="HKTimeZone" value="Europe/Helsinki"/>\n</Record>\n`);
    const end = Date.UTC(endDay.getFullYear(), endDay.getMonth(), endDay.getDate()) - DAY;
    const start = end - (days - 1) * DAY;
    out(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE HealthData [
<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary|ClinicalRecord)*)>
<!ATTLIST Record type CDATA #REQUIRED unit CDATA #IMPLIED value CDATA #IMPLIED>
]>
<HealthData locale="zh_CN">
 <ExportDate value="${fmt(end + DAY + 9 * HOUR)}"/>
 <Me HKCharacteristicTypeIdentifierDateOfBirth="1996-05-01" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexNotSet" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet"/>
`);
    // 两段“生病”期：静息心率升高、HRV 下降、手腕温度升高
    const sick = [Math.floor(days * 0.35), Math.floor(days * 0.82)];
    const sickness = (i) => {
        for (const s of sick)
            if (i >= s && i < s + 5)
                return 1 - Math.abs(i - s - 2) / 3;
        return 0;
    };
    let weight = 74.5;
    const activity = [];
    for (let i = 0; i < days; i++) {
        const d0 = start + i * DAY;
        const wd = new Date(d0).getUTCDay();
        const weekend = wd === 0 || wd === 6;
        const progress = i / days; // 体能随时间缓慢改善
        const ill = sickness(i);
        const season = Math.sin((2 * Math.PI * (new Date(d0).getUTCMonth() - 3)) / 12); // 夏季更活跃
        // ---- 睡眠（归属到当天早上醒来）----
        const bedOffset = (weekend ? 0.75 : -0.6) + gauss() * 0.45 + (wd === 1 ? 0.3 : 0);
        const bed = d0 - 0.25 * HOUR + bedOffset * HOUR;
        const sleepMin = Math.max(300, Math.min(560, 435 + gauss() * 40 - ill * 30 + (weekend ? 25 : 0)));
        const inBedStart = bed - (8 + r() * 15) * 60000;
        let t = bed;
        let slept = 0;
        let cycle = 0;
        while (slept < sleepMin) {
            const early = cycle < 2;
            const segs = [
                ['AsleepCore', 18 + r() * 22],
                ['AsleepDeep', early ? 18 + r() * 25 : r() * 10],
                ['AsleepCore', 8 + r() * 15],
                ['AsleepREM', early ? 6 + r() * 10 : 20 + r() * 18],
            ];
            if (r() < 0.35)
                segs.push(['Awake', 1 + r() * 5]);
            for (const [k, m] of segs) {
                if (m < 1)
                    continue;
                const mm = k === 'Awake' ? m : Math.min(m, sleepMin - slept + 1);
                cat(C + 'SleepAnalysis', WATCH, t, t + mm * 60000, 'HKCategoryValueSleepAnalysis' + k);
                t += mm * 60000;
                if (k !== 'Awake')
                    slept += mm;
                if (slept >= sleepMin)
                    break;
            }
            cycle++;
        }
        const wake = t;
        cat(C + 'SleepAnalysis', PHONE, inBedStart, wake + (5 + r() * 20) * 60000, 'HKCategoryValueSleepAnalysisInBed');
        // 夜间指标
        const sleepDebt = (435 - sleepMin) / 60;
        const rhr = 61 - progress * 5 + ill * 7 + sleepDebt * 0.8 + gauss() * 1.6;
        const hrv = Math.max(15, (44 + progress * 9) * (1 - ill * 0.3) - sleepDebt * 2.5 + gauss() * 6);
        rec(Q + 'RestingHeartRate', WATCH, 'count/min', d0 + 7 * HOUR, d0 + 22 * HOUR, Math.round(rhr));
        for (let k = 0; k < 3; k++) {
            const s = d0 + (2 + k * 6 + r() * 3) * HOUR;
            rec(Q + 'HeartRateVariabilitySDNN', WATCH, 'ms', s, s + 60000, (hrv + gauss() * 8).toFixed(3));
        }
        for (let k = 0; k < 4; k++) {
            const s = bed + (1 + k * 1.5) * HOUR;
            rec(Q + 'RespiratoryRate', WATCH, 'count/min', s, s + 30000, (14.2 + ill * 2.2 + gauss() * 0.7).toFixed(1));
            rec(Q + 'OxygenSaturation', WATCH, '%', s, s, Math.min(1, 0.965 - ill * 0.012 + gauss() * 0.01).toFixed(2));
        }
        rec(Q + 'AppleSleepingWristTemperature', WATCH, 'degC', bed, wake, (35.3 + ill * 0.7 + gauss() * 0.15).toFixed(2));
        // ---- 运动 ----
        let workoutMin = 0;
        let workoutKcal = 0;
        let workoutSteps = 0;
        let workoutHour = -1;
        const plan = [
            r() < 0.3 ? 'Walking' : null, // 周日
            r() < 0.8 ? 'Running' : null,
            r() < 0.7 ? 'TraditionalStrengthTraining' : null,
            r() < 0.6 ? 'Running' : null,
            r() < 0.6 ? 'Yoga' : null,
            r() < 0.2 ? 'Cycling' : null,
            r() < 0.75 ? (r() < 0.6 ? 'Running' : 'Hiking') : null,
        ][wd];
        if (plan && ill < 0.3) {
            workoutHour = weekend ? 10 + Math.floor(r() * 3) : 18 + Math.floor(r() * 2);
            const ws = d0 + workoutHour * HOUR + Math.floor(r() * 30) * 60000;
            const cfg = {
                // 时长, kcal/分, 平均心率, 每分钟公里
                Running: [28 + r() * 25 + progress * 8, 10.5, 150 - progress * 6, 1 / (6.4 - progress * 0.7 + gauss() * 0.2)],
                Walking: [35 + r() * 40, 4.5, 102, 1 / 11.5],
                Hiking: [80 + r() * 90, 6.5, 118, 1 / 14],
                Cycling: [40 + r() * 50, 8, 132, 1 / 2.6],
                TraditionalStrengthTraining: [35 + r() * 20, 6, 118, 0],
                Yoga: [25 + r() * 20, 3.2, 92, 0],
            };
            const [dur, kpm, hr, kmpm] = cfg[plan];
            const we = ws + dur * 60000;
            workoutMin = dur;
            workoutKcal = dur * kpm;
            if (plan === 'Running' || plan === 'Walking' || plan === 'Hiking')
                workoutSteps = dur * (plan === 'Running' ? 165 : 110);
            out(`<Workout workoutActivityType="HKWorkoutActivityType${plan}" duration="${dur.toFixed(2)}" durationUnit="min" sourceName="${WATCH}" sourceVersion="10.0" creationDate="${fmt(we)}" startDate="${fmt(ws)}" endDate="${fmt(we)}">\n`);
            out(` <MetadataEntry key="HKIndoorWorkout" value="0"/>\n`);
            out(` <WorkoutStatistics type="${Q}ActiveEnergyBurned" startDate="${fmt(ws)}" endDate="${fmt(we)}" sum="${workoutKcal.toFixed(1)}" unit="kcal"/>\n`);
            if (kmpm > 0) {
                const dt = plan === 'Cycling' ? 'DistanceCycling' : 'DistanceWalkingRunning';
                out(` <WorkoutStatistics type="${Q}${dt}" startDate="${fmt(ws)}" endDate="${fmt(we)}" sum="${(dur * kmpm).toFixed(3)}" unit="km"/>\n`);
            }
            out(` <WorkoutStatistics type="${Q}HeartRate" startDate="${fmt(ws)}" endDate="${fmt(we)}" average="${(hr + gauss() * 4).toFixed(0)}" minimum="${(hr - 40).toFixed(0)}" maximum="${(hr + 18 + r() * 8).toFixed(0)}" unit="count/min"/>\n`);
            out(`</Workout>\n`);
            if (plan === 'Cycling')
                rec(Q + 'DistanceCycling', WATCH, 'km', ws, we, (dur * kmpm).toFixed(2));
        }
        // ---- 日间活动（按小时）----
        const wakeHour = Math.ceil((wake - d0) / HOUR);
        const baseSteps = Math.max(1500, (weekend ? 6200 : 7800) * (1 + season * 0.12) * (1 - ill * 0.6) + gauss() * 1600);
        let daySteps = 0;
        let dayKcal = workoutKcal;
        let stood = 0;
        for (let h = wakeHour; h < 23; h++) {
            const s = d0 + h * HOUR;
            const commute = !weekend && (h === 8 || h === 17) ? 2.2 : 1;
            const lunch = h === 12 ? 1.6 : 1;
            let steps = Math.max(0, (baseSteps / 15) * commute * lunch * (0.4 + r() * 1.2));
            if (h === workoutHour)
                steps += workoutSteps;
            steps = Math.round(steps);
            daySteps += steps;
            if (steps > 0) {
                rec(Q + 'StepCount', WATCH, 'count', s, s + HOUR - 1000, steps);
                // iPhone 也会记录（常在口袋外时少记），用于测试去重
                rec(Q + 'StepCount', PHONE, 'count', s + 60000, s + HOUR - 61000, Math.round(steps * (0.55 + r() * 0.3)));
            }
            if (h % 2 === 0) {
                rec(Q + 'DistanceWalkingRunning', WATCH, 'km', s, s + 2 * HOUR - 1000, ((steps * 2 * 0.74) / 1000).toFixed(3));
            }
            const kcal = steps * 0.04 + 6 + r() * 5 + (h === workoutHour ? workoutKcal : 0);
            dayKcal += h === workoutHour ? 0 : steps * 0.04 + 6;
            rec(Q + 'ActiveEnergyBurned', WATCH, 'kcal', s, s + HOUR - 1000, kcal.toFixed(1));
            const hrv2 = 72 - progress * 4 + ill * 8 + (steps / 1000) * 3 + gauss() * 5 + (h === workoutHour ? 55 : 0);
            rec(Q + 'HeartRate', WATCH, 'count/min', s + 20 * 60000, s + 20 * 60000, Math.round(hrv2));
            const st = steps > 150 || r() < 0.5;
            if (st)
                stood++;
            cat(C + 'AppleStandHour', WATCH, s, s + HOUR, 'HKCategoryValueAppleStandHour' + (st ? 'Stood' : 'Idle'));
            if (r() < 0.2)
                rec(Q + 'FlightsClimbed', PHONE, 'count', s, s + 10 * 60000, 1 + Math.floor(r() * 4));
        }
        // 夜间心率
        for (let k = 0; k < 6; k++) {
            const s = bed + k * HOUR + 30 * 60000;
            rec(Q + 'HeartRate', WATCH, 'count/min', s, s, Math.round(rhr - 3 + gauss() * 2));
        }
        const exercise = Math.round(workoutMin + 6 + r() * 14 * (1 - ill));
        rec(Q + 'AppleExerciseTime', WATCH, 'min', d0 + 12 * HOUR, d0 + 12 * HOUR + exercise * 60000, exercise);
        rec(Q + 'BasalEnergyBurned', WATCH, 'kcal', d0, d0 + DAY - 1000, (1640 + gauss() * 15).toFixed(1));
        rec(Q + 'WalkingHeartRateAverage', WATCH, 'count/min', d0 + 9 * HOUR, d0 + 21 * HOUR, Math.round(rhr + 38 + gauss() * 3));
        rec(Q + 'WalkingSpeed', PHONE, 'km/hr', d0 + 13 * HOUR, d0 + 13 * HOUR + 600000, (4.8 + progress * 0.2 + gauss() * 0.25).toFixed(2));
        rec(Q + 'TimeInDaylight', WATCH, 'min', d0 + 12 * HOUR, d0 + 13 * HOUR, Math.round(Math.max(5, 45 + season * 40 + (weekend ? 30 : 0) + gauss() * 20)));
        rec(Q + 'EnvironmentalAudioExposure', WATCH, 'dBASPL', d0 + 15 * HOUR, d0 + 16 * HOUR, (68 + gauss() * 4).toFixed(1));
        if (wd === 1 || wd === 4) {
            weight += -0.012 + gauss() * 0.12 - (weight - 72) * 0.01;
            rec(Q + 'BodyMass', SCALE, 'kg', d0 + 7.5 * HOUR, d0 + 7.5 * HOUR, weight.toFixed(1));
            rec(Q + 'BodyFatPercentage', SCALE, '%', d0 + 7.5 * HOUR, d0 + 7.5 * HOUR, (0.19 - progress * 0.02 + gauss() * 0.004).toFixed(3));
        }
        if (wd === 3)
            rec(Q + 'VO2Max', WATCH, 'mL/min·kg', d0 + 19 * HOUR, d0 + 19 * HOUR, (41 + progress * 4 + gauss() * 0.6).toFixed(2));
        if (r() < 0.25) {
            const s = d0 + 21.5 * HOUR;
            cat(C + 'MindfulSession', WATCH, s, s + (5 + Math.floor(r() * 3) * 5) * 60000, 'HKCategoryValueNotApplicable');
        }
        const date = new Date(d0).toISOString().slice(0, 10);
        activity.push(` <ActivitySummary dateComponents="${date}" activeEnergyBurned="${dayKcal.toFixed(1)}" activeEnergyBurnedGoal="${i > days / 2 ? 500 : 450}" activeEnergyBurnedUnit="kcal" appleMoveTime="0" appleMoveTimeGoal="0" appleExerciseTime="${exercise}" appleExerciseTimeGoal="30" appleStandHours="${stood}" appleStandHoursGoal="12"/>\n`);
        void daySteps;
    }
    for (const a of activity)
        out(a);
    out('</HealthData>\n');
    parts.push(chunk.join(''));
    return new Blob(parts, { type: 'text/xml' });
}
