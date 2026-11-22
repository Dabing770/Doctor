const Q = 'HKQuantityTypeIdentifier';
const C = 'HKCategoryTypeIdentifier';
const m = (id, label, unit, group, agg, decimals, extra = {}) => ({ id, label, unit, group, agg, decimals, ...extra });
export const METRICS = [
    m(Q + 'StepCount', '步数', '步', '活动', 'sum', 0, { better: 'up' }),
    m(Q + 'DistanceWalkingRunning', '步行+跑步距离', 'km', '活动', 'sum', 2, { better: 'up' }),
    m(Q + 'ActiveEnergyBurned', '活动能量', '千卡', '活动', 'sum', 0, { better: 'up' }),
    m(Q + 'BasalEnergyBurned', '静息能量', '千卡', '活动', 'sum', 0),
    m(Q + 'AppleExerciseTime', '锻炼时间', '分钟', '活动', 'sum', 0, { better: 'up' }),
    m(Q + 'AppleStandTime', '站立时间', '分钟', '活动', 'sum', 0, { better: 'up' }),
    m(C + 'AppleStandHour', '站立小时', '小时', '活动', 'sum', 0, { better: 'up' }),
    m(Q + 'FlightsClimbed', '已爬楼层', '层', '活动', 'sum', 0, { better: 'up' }),
    m(Q + 'DistanceCycling', '骑行距离', 'km', '活动', 'sum', 2),
    m(Q + 'TimeInDaylight', '日光下时间', '分钟', '活动', 'sum', 0, { better: 'up' }),
    m('sleep.asleep', '睡眠时长', '小时', '睡眠', 'avg', 1, { scale: 1 / 60, better: 'up', watch: 'down' }),
    m('sleep.deep', '深度睡眠', '分钟', '睡眠', 'avg', 0, { better: 'up' }),
    m('sleep.rem', '快速动眼睡眠', '分钟', '睡眠', 'avg', 0),
    m('sleep.inBed', '卧床时间', '小时', '睡眠', 'avg', 1, { scale: 1 / 60 }),
    m(Q + 'RestingHeartRate', '静息心率', '次/分', '心脏', 'avg', 0, { better: 'down', watch: 'up' }),
    m(Q + 'HeartRateVariabilitySDNN', '心率变异性', '毫秒', '心脏', 'avg', 0, { better: 'up', watch: 'down' }),
    m(Q + 'HeartRate', '心率', '次/分', '心脏', 'avg', 0),
    m(Q + 'WalkingHeartRateAverage', '步行平均心率', '次/分', '心脏', 'avg', 0, { better: 'down' }),
    m(Q + 'VO2Max', '最大摄氧量', 'mL/kg·min', '心脏', 'avg', 1, { better: 'up' }),
    m(Q + 'HeartRateRecoveryOneMinute', '心率恢复', '次/分', '心脏', 'avg', 0, { better: 'up' }),
    m(Q + 'OxygenSaturation', '血氧饱和度', '%', '呼吸', 'avg', 1, { scale: 100, better: 'up', watch: 'down' }),
    m(Q + 'RespiratoryRate', '呼吸频率', '次/分', '呼吸', 'avg', 1, { watch: 'up' }),
    m(Q + 'AppleSleepingWristTemperature', '睡眠手腕温度', '°C', '身体', 'avg', 2, { watch: 'up' }),
    m(Q + 'BodyMass', '体重', 'kg', '身体', 'avg', 1),
    m(Q + 'BodyMassIndex', '身体质量指数', '', '身体', 'avg', 1),
    m(Q + 'BodyFatPercentage', '体脂率', '%', '身体', 'avg', 1, { scale: 100 }),
    m(Q + 'LeanBodyMass', '去脂体重', 'kg', '身体', 'avg', 1),
    m(Q + 'Height', '身高', 'cm', '身体', 'avg', 0, { scale: 100 }),
    m(Q + 'BodyTemperature', '体温', '°C', '身体', 'avg', 1),
    m(Q + 'BloodPressureSystolic', '收缩压', 'mmHg', '身体', 'avg', 0, { better: 'down' }),
    m(Q + 'BloodPressureDiastolic', '舒张压', 'mmHg', '身体', 'avg', 0, { better: 'down' }),
    m(Q + 'BloodGlucose', '血糖', 'mg/dL', '身体', 'avg', 0),
    m(Q + 'WalkingSpeed', '步行速度', 'km/h', '行走能力', 'avg', 2, { better: 'up' }),
    m(Q + 'WalkingStepLength', '步长', 'cm', '行走能力', 'avg', 0),
    m(Q + 'WalkingAsymmetryPercentage', '步行不对称性', '%', '行走能力', 'avg', 1, { scale: 100, better: 'down' }),
    m(Q + 'WalkingDoubleSupportPercentage', '双支撑时间', '%', '行走能力', 'avg', 1, { scale: 100, better: 'down' }),
    m(Q + 'StairAscentSpeed', '上楼速度', 'm/s', '行走能力', 'avg', 2),
    m(Q + 'SixMinuteWalkTestDistance', '六分钟步行距离', 'm', '行走能力', 'avg', 0),
    m(Q + 'EnvironmentalAudioExposure', '环境音量', 'dB', '听力', 'avg', 0, { better: 'down' }),
    m(Q + 'HeadphoneAudioExposure', '耳机音量', 'dB', '听力', 'avg', 0, { better: 'down' }),
    m(C + 'MindfulSession', '正念', '分钟', '心理', 'sum', 0, { better: 'up' }),
    m(Q + 'DietaryWater', '饮水', 'mL', '营养', 'sum', 0),
    m(Q + 'DietaryEnergyConsumed', '膳食能量', '千卡', '营养', 'sum', 0),
    m(Q + 'DietaryCaffeine', '咖啡因', 'mg', '营养', 'sum', 0),
];
const BY_ID = new Map(METRICS.map((d) => [d.id, d]));
const UNIT_ZH = { count: '次', 'count/min': '次/分', min: '分钟', kcal: '千卡', '%': '%' };
/** 未在列表中的类型：根据导出信息生成一个通用定义 */
export function metricDef(id, data) {
    const known = BY_ID.get(id);
    if (known)
        return known;
    const t = data?.types[id];
    const raw = id.replace(/^HK\w+?TypeIdentifier/, '');
    return {
        id,
        label: raw.replace(/([a-z])([A-Z])/g, '$1 $2'),
        unit: t ? (t.kind === 'category' ? (t.agg === 'duration' ? '分钟' : '次') : (UNIT_ZH[t.unit] ?? t.unit)) : '',
        group: '其他',
        agg: t && t.agg !== 'avg' ? 'sum' : 'avg',
        decimals: 1,
    };
}
const SLEEP_FIELD = {
    'sleep.asleep': 'asleep', 'sleep.deep': 'deep', 'sleep.rem': 'rem', 'sleep.inBed': 'inBed',
};
/** 取出某指标的每日序列（已换算单位） */
export function getSeries(data, id) {
    const def = metricDef(id, data);
    const k = def.scale ?? 1;
    const f = SLEEP_FIELD[id];
    if (f) {
        const nights = data.sleep.filter((n) => n[f] > 0 && (f !== 'deep' && f !== 'rem' ? true : n.hasStages));
        return { days: nights.map((n) => n.date), values: nights.map((n) => n[f] * k) };
    }
    const s = data.daily[id];
    if (!s)
        return { days: [], values: [] };
    if (k === 1)
        return s;
    return { days: s.days, values: s.values.map((v) => v * k), min: s.min.map((v) => v * k), max: s.max.map((v) => v * k) };
}
export function hasMetric(data, id) {
    return getSeries(data, id).days.length > 0;
}
/** 数据里存在的全部指标（已知的排在前面） */
export function availableMetrics(data) {
    const known = METRICS.filter((d) => hasMetric(data, d.id));
    const knownIds = new Set(known.map((d) => d.id));
    const extra = Object.keys(data.daily)
        .filter((id) => !knownIds.has(id) && data.daily[id].days.length > 0)
        .map((id) => metricDef(id, data))
        .sort((a, b) => a.label.localeCompare(b.label));
    return [...known, ...extra];
}
export function fmtNum(v, decimals = 0) {
    if (v === undefined || v === null || !Number.isFinite(v))
        return '—';
    return v.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
export function fmtCompact(v) {
    const a = Math.abs(v);
    if (a >= 1e8)
        return (v / 1e8).toFixed(1).replace(/\.0$/, '') + '亿';
    if (a >= 1e4)
        return (v / 1e4).toFixed(1).replace(/\.0$/, '') + '万';
    return fmtNum(v, a < 10 && a % 1 !== 0 ? 1 : 0);
}
/** 分钟（相对午夜，可为负）→ "23:15" */
export function fmtClock(min) {
    const m = ((Math.round(min) % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function fmtDuration(min) {
    if (!Number.isFinite(min))
        return '—';
    const h = Math.floor(min / 60);
    const mm = Math.round(min % 60);
    return h > 0 ? `${h} 小时 ${mm} 分` : `${mm} 分钟`;
}
export const WORKOUT_ZH = {
    Running: '跑步', Walking: '步行', Cycling: '骑行', Swimming: '游泳', Hiking: '徒步',
    Yoga: '瑜伽', FunctionalStrengthTraining: '功能性力量训练', TraditionalStrengthTraining: '传统力量训练',
    HighIntensityIntervalTraining: '高强度间歇训练', Elliptical: '椭圆机', Rowing: '划船机',
    StairClimbing: '爬楼梯', Stairs: '楼梯', Dance: '舞蹈', SocialDance: '社交舞', CoreTraining: '核心训练',
    Basketball: '篮球', Soccer: '足球', Badminton: '羽毛球', TableTennis: '乒乓球', Tennis: '网球',
    Volleyball: '排球', Pilates: '普拉提', MindAndBody: '身心训练', Cooldown: '放松整理',
    MixedCardio: '混合有氧', Other: '其他', CrossCountrySkiing: '越野滑雪', DownhillSkiing: '滑雪',
    Snowboarding: '单板滑雪', SkatingSports: '滑冰', Climbing: '攀岩', Boxing: '拳击', KickBoxing: '踢拳',
    MartialArts: '武术', JumpRope: '跳绳', Flexibility: '柔韧性训练', Golf: '高尔夫', Baseball: '棒球',
    TaiChi: '太极', Barre: '芭蕾塑形', Fishing: '钓鱼', Hockey: '曲棍球', Surfing: '冲浪',
    PaddleSports: '桨类运动', SwimBikeRun: '铁人三项', Transition: '转换', Wheelchair: '轮椅',
    WheelchairWalkPace: '轮椅（步行速度）', WheelchairRunPace: '轮椅（跑步速度）',
};
export const workoutLabel = (t) => WORKOUT_ZH[t] ?? t.replace(/([a-z])([A-Z])/g, '$1 $2');
