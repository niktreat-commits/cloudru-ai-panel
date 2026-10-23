// Расчётное ядро калькулятора. Чистые функции без DOM — используются в браузере и в тестах (node --test).

export const OPTION_IDS = ['api', 'mli', 'vm', 'bm', 'cluster'];

export const OPTION_META = {
  api: { name: 'LLM API', full: 'Inference API (Evolution Foundation Models)', stage: 0 },
  mli: { name: 'ML Inference', full: 'Evolution ML Inference', stage: 1 },
  vm: { name: 'GPU VM', full: 'Виртуальные машины с GPU (Evolution Compute GPU)', stage: 1 },
  bm: { name: 'Bare Metal', full: 'Выделенные GPU-серверы Bare Metal с NVLink', stage: 2 },
  cluster: { name: 'Кластер + InfiniBand', full: 'GPU-кластер Bare Metal с InfiniBand', stage: 3 },
};

// Чек-лист готовности на основе гайда (стр. 4–13). Только потребности и факты о проекте, а не готовые решения;
// размер модели и темп роста сюда не входят — они задаются на шаге 1. Порядок: зрелость → экономика →
// качество сервиса → данные и ИБ → обучение → инфраструктура и команда.
// text — короткая формулировка в одну строку, hint — пояснение во всплывающей подсказке.
export const SIGNALS = [
  { id: 'inProd', text: 'ИИ-сервис уже в продакшене и доказал ценность', hint: 'Пока продукт не доказал ценность, строить свою инфраструктуру рано' },
  { id: 'costUnpredictable', text: 'Расходы на API растут быстрее выручки', hint: 'Счёт за токены сложно спланировать даже на месяц вперёд' },
  { id: 'rateLimits', text: 'Упираемся в rate limits или квоты провайдера', hint: 'Запросы отклоняются или ставятся в очередь в часы пик' },
  { id: 'latency', text: 'Пользователи жалуются на задержку в пики', hint: 'Скорость ответа падает при росте нагрузки' },
  { id: 'sla', text: 'Нужен SLA и стабильная производительность', hint: 'Сервис критичен для бизнеса, качество измеряется SLA' },
  { id: 'sensitive', text: 'Обрабатываем ПДн или конфиденциальные данные', hint: 'Персональные, финансовые данные, коммерческая тайна — требования 152-ФЗ и ИБ' },
  { id: 'isolation', text: 'Нужна физическая изоляция: КИИ, ФСТЭК, PCI DSS', hint: 'Регулятор или ИБ запрещают общий гипервизор и общую инфраструктуру' },
  { id: 'finetune', text: 'Нужно дообучать модель на своих данных', hint: 'Fine-tuning под стиль, формат ответов или предметную область' },
  { id: 'trainAndServe', text: 'Совмещаем обучение, эксперименты и прод', hint: 'Одни и те же GPU нужны и для продакшен-инференса, и для экспериментов' },
  { id: 'distributed', text: 'Обучение с нуля или на нескольких серверах', hint: 'Распределённое обучение — нужна связь InfiniBand между серверами' },
  { id: 'hardware', text: 'Нужен доступ к BIOS, драйверам и прошивкам', hint: 'Низкоуровневая настройка сервера, недоступная в виртуализации' },
  { id: 'team', text: 'Есть ML/DevOps-команда для своего inference stack', hint: 'Кто будет ставить драйверы, модельный сервер, мониторинг и резервирование' },
];

// Наружу калькулятор не показывает денег: только качественные оценки. Точная цена — в предложении архитектора.

/** Уровень стоимости варианта относительно самого выгодного. */
export function costLevel(total, best) {
  const r = total / best;
  if (r <= 1.1) return { id: 'optimal', label: 'Оптимально' };
  if (r <= 1.5) return { id: 'higher', label: 'Дороже' };
  if (r <= 3) return { id: 'much', label: 'Значительно дороже' };
  return { id: 'multiple', label: 'Кратно дороже' };
}

/** Насколько вариант выгоднее другого (other / mine). */
export function advantage(mine, other) {
  const r = other / mine;
  if (r >= 3) return 'Кратно выгоднее';
  if (r >= 1.5) return 'Значительно выгоднее';
  if (r >= 1.1) return 'Выгоднее';
  if (r >= 0.9) return 'Сопоставимо';
  return 'Дороже — плата за контроль';
}

// Качественные характеристики из сравнительной таблицы гайда (стр. 3).
export const PREDICTABILITY = {
  api: { label: 'Низкая', note: 'счёт растёт с каждым запросом' },
  vm: { label: 'Средняя', note: 'почасовая аренда' },
  bm: { label: 'Высокая', note: 'фиксированная аренда' },
  cluster: { label: 'Высокая', note: 'фиксированная аренда' },
};
export const OPS_LOAD = { api: 'Минимальная', vm: 'Средняя', bm: 'Нужна ML/DevOps-экспертиза', cluster: 'Нужна ML/DevOps-экспертиза' };

// Порог, с которого выделенные серверы предпочтительнее при сопоставимой стоимости (шкала гайда 6 из 10 → 7 из 12).
export const DEDICATED_THRESHOLD = 7;

// Вердикты гайда по числу ответов «да», шкала пересчитана с 10 на 12 пунктов.
export function readinessVerdict(score) {
  if (score <= 2) return { band: '0–2', title: 'Оставайтесь на API', text: 'Сосредоточьтесь на проверке гипотезы — инфраструктура пока не главный риск.' };
  if (score <= 6) return { band: '3–6', title: 'Пора сравнивать', text: 'Сравните API, GPU VM и Bare Metal на реальной тестовой нагрузке.' };
  if (score <= 9) return { band: '7–9', title: 'Bare Metal оправдан', text: 'Bare Metal может дать более предсказуемую экономику и производительность.' };
  return { band: '10–12', title: 'Нужен кластер', text: 'Рассмотрите выделенный GPU-сервер или кластерную конфигурацию с InfiniBand.' };
}

const ceilTo = (x, step) => Math.ceil(x / step - 1e-9) * step;

/** Месячный объём токенов при заданном множителе роста. */
export function monthlyTokens(scenario, units, factor = 1) {
  const requests = units * scenario.requestsPerUnit * scenario.daysPerMonth * factor;
  return {
    requests,
    tokIn: requests * scenario.inTokens,
    tokOut: requests * scenario.outTokens,
  };
}

/**
 * Сколько GPU нужно, чтобы обслужить нагрузку.
 * busyGpus — среднее число GPU, занятых работой; requiredGpus — сколько держать под пик.
 */
export function gpuDemand({ tokIn, tokOut }, tier, scenario, pricing, perfFactor = 1) {
  const seconds = pricing.hoursPerMonth * 3600;
  const gpuSeconds = (tokOut / tier.decodeTpsPerGpu + tokIn / tier.prefillTpsPerGpu) / perfFactor;
  const busyGpus = gpuSeconds / seconds;
  const peakGpus = (busyGpus * scenario.peakFactor) / pricing.targetUtilization;
  const requiredGpus = Math.max(tier.minGpus, ceilTo(peakGpus, tier.minGpus));
  return { busyGpus, peakGpus, requiredGpus };
}

/** Проверка жёстких ограничений: что из вариантов вообще применимо. */
export function feasibility(input, pricing) {
  const tier = pricing.tiers[input.tier];
  const model = findModel(pricing, input.modelId, input.tier);
  const s = new Set(input.signals);
  const out = {};
  for (const id of OPTION_IDS) out[id] = { ok: true, reason: '', warnings: [] };

  if (input.ownModel) out.api = {ok:false, reason:'Для собственной модели нужен отдельный инференс', warnings:[]};
  if (tier.minGpus > 8) out.mli = {ok:false, reason:'В демо рассчитаны конфигурации ML Inference до 8 GPU', warnings:[]};
  if (s.has('isolation') || s.has('hardware') || s.has('distributed')) out.mli = {ok:false,reason:'Для этих требований нужен отдельный подбор инфраструктуры',warnings:[]};
  if (s.has('isolation')) {
    out.api = { ok: false, reason: 'Общая инфраструктура провайдера — нет физической изоляции', warnings: [] };
    out.vm = { ok: false, reason: 'Общий гипервизор — нет изоляции на уровне железа', warnings: [] };
  }
  if (s.has('hardware')) {
    if (out.api.ok) out.api = { ok: false, reason: 'Нет доступа к BIOS, драйверам и настройкам оборудования', warnings: [] };
    if (out.vm.ok) out.vm = { ok: false, reason: 'Гипервизор закрывает доступ к BIOS и прошивкам', warnings: [] };
  }
  // Гайд, стр. 10: распределённое обучение невозможно без высокоскоростной связи InfiniBand между серверами.
  if (s.has('distributed')) {
    const reason = 'Распределённому обучению нужен InfiniBand между серверами';
    for (const id of ['api', 'vm', 'bm']) if (out[id].ok) out[id] = { ok: false, reason, warnings: [] };
  }
  if (out.api.ok && s.has('sensitive') && model.hosting === 'partner') {
    out.api = { ok: false, reason: 'Партнёрская модель: данные обрабатываются вне контура РФ', warnings: [] };
  }
  if (tier.minGpus > pricing.gpuVm.maxGpusPerVm) {
    out.vm = { ok: false, reason: `Модели нужно ${tier.minGpus} GPU, а ВМ — максимум ${pricing.gpuVm.maxGpusPerVm} GPU без InfiniBand`, warnings: [] };
  }
  if (tier.minGpus > pricing.bareMetal.gpusPerServer) {
    out.bm = { ok: false, reason: `Модель не помещается в один сервер (${pricing.bareMetal.gpusPerServer} GPU) — нужна связь InfiniBand`, warnings: [] };
  }

  if (out.api.ok) {
    if (s.has('sensitive')) out.api.warnings.push('Обработку ПДн через API нужно согласовать с ИБ');
    if (s.has('finetune') || s.has('trainAndServe') || s.has('distributed')) {
      out.api.warnings.push('Обучение идёт отдельно от API — на арендованных GPU');
    }
    if (s.has('rateLimits')) out.api.warnings.push('Лимиты и квоты провайдера остаются');
    if (s.has('latency') || s.has('sla')) out.api.warnings.push('Задержка и доступность зависят от общей нагрузки на провайдера');
  }
  if (out.vm.ok && (s.has('latency') || s.has('sla'))) out.vm.warnings.push('Производительность в пики зависит от виртуализации');
  for (const id of ['bm', 'cluster']) {
    if (out[id].ok && !s.has('team')) {
      out[id].warnings.push('Своей ML/DevOps-команды нет — заложите поддержку провайдера или найм инженеров');
    }
  }
  return out;
}

export function findModel(pricing, modelId, tierId) {
  return (
    pricing.apiModels.find((m) => m.id === modelId && m.tier === tierId) ||
    pricing.apiModels.find((m) => m.id === pricing.tiers[tierId].defaultApiModel)
  );
}

/** Стоимость одного месяца для каждого варианта при множителе нагрузки factor. */
export function monthCost(input, pricing, factor) {
  const scenario = pricing.scenarios[input.scenario];
  const tier = pricing.tiers[input.tier];
  const model = findModel(pricing, input.modelId, input.tier);
  const s = new Set(input.signals);
  // Распределённое обучение — кратно больше GPU-часов, чем дообучение.
  const ft = s.has('distributed')
    ? tier.finetuneGpuHoursMonth * 4
    : s.has('finetune') || s.has('trainAndServe') ? tier.finetuneGpuHoursMonth : 0;
  const H = pricing.hoursPerMonth;
  const eng = input.engineerMonthCost ?? pricing.ops.engineerMonthCost;
  const ops = (id) => pricing.ops.fte[id] * eng;
  const tokens = monthlyTokens(scenario, input.units, factor);
  const res = {};

  // 1. API: платим за токены; GPU под дообучение арендуем почасово.
  const apiTokens = (tokens.tokIn / 1e6) * model.inPrice + (tokens.tokOut / 1e6) * model.outPrice;
  const apiFt = ft * pricing.gpuVm.nvlinkGpuHour;
  res.api = { infra: apiTokens, training: apiFt, ops: ops('api'), gpus: 0, units: 0 };

  // 2. GPU VM: почасовая оплата. В проде мощности обычно держат под пик (GPU по запросу не гарантированы);
  // с автоскейлингом платим за среднюю загрузку с запасом на инерцию масштабирования.
  const vmDemand = gpuDemand(tokens, tier, scenario, pricing, pricing.gpuVm.perfFactor);
  const vmRate = tier.minGpus === 1 ? pricing.gpuVm.pcieGpuHour : pricing.gpuVm.nvlinkGpuHour;
  const autoscale = input.vmAutoscale ?? pricing.gpuVm.autoscaleDefault;
  const elastic = ceilTo((vmDemand.busyGpus / pricing.targetUtilization) * pricing.gpuVm.elasticOverhead, tier.minGpus);
  const vmAvgGpus = autoscale ? Math.min(vmDemand.requiredGpus, Math.max(tier.minGpus, elastic)) : vmDemand.requiredGpus;
  res.vm = {
    infra: vmAvgGpus * H * vmRate,
    training: ft * pricing.gpuVm.nvlinkGpuHour,
    ops: ops('vm'),
    gpus: vmDemand.requiredGpus,
    units: Math.ceil(vmDemand.requiredGpus / pricing.gpuVm.maxGpusPerVm),
  };

  // Managed inference: official H100 80 GB resource rates plus request charge.
  // The same source throughput assumptions are used; benchmark before sizing production.
  const mlDemand = gpuDemand(tokens, tier, scenario, pricing, 1);
  const mlRate = tier.minGpus === 1 ? pricing.mlInference.pcieGpuHour : pricing.mlInference.nvlinkGpuHour;
  const mlElastic = ceilTo((mlDemand.busyGpus / pricing.targetUtilization) * pricing.gpuVm.elasticOverhead, tier.minGpus);
  const mlAvg = autoscale ? Math.min(mlDemand.requiredGpus, Math.max(tier.minGpus, mlElastic)) : mlDemand.requiredGpus;
  res.mli = {infra:mlAvg*H*mlRate + tokens.requests/1e6*pricing.mlInference.requestsMillion,
    training:ft*pricing.gpuVm.nvlinkGpuHour,ops:ops('mli'),gpus:mlDemand.requiredGpus,units:1};

  // 3–4. Bare Metal: фиксированная помесячная аренда серверов под пик.
  // Обучение бесплатно, если помещается в простаивающие мощности (ночь, выходные).
  const bmDemand = gpuDemand(tokens, tier, scenario, pricing, pricing.bareMetal.perfFactor);
  const perServer = pricing.bareMetal.gpusPerServer;
  const gpuHourBm = pricing.bareMetal.serverMonth / (perServer * H);
  const bareMetal = (servers, ibShare) => {
    const capacityHours = servers * perServer * H * pricing.targetUtilization;
    const idle = Math.max(0, capacityHours - bmDemand.busyGpus * H);
    return {
      infra: servers * pricing.bareMetal.serverMonth * (1 + ibShare),
      training: Math.max(0, ft - idle) * gpuHourBm,
      ops: 0,
      gpus: servers * perServer,
      units: servers,
      idleGpuHours: idle,
    };
  };
  const bmServers = Math.ceil(bmDemand.requiredGpus / perServer);
  res.bm = { ...bareMetal(bmServers, 0), ops: ops('bm') };
  const clServers = Math.max(2, bmServers);
  res.cluster = { ...bareMetal(clServers, pricing.infiniband.shareOfServerMonth), ops: ops('cluster') };

  for (const id of OPTION_IDS) res[id].total = res[id].infra + res[id].training + res[id].ops;
  return { tokens, options: res };
}

/** Полный расчёт на горизонте планирования. */
export function calculate(input, pricing) {
  const months = input.horizon;
  const eng = input.engineerMonthCost ?? pricing.ops.engineerMonthCost;
  const feas = feasibility(input, pricing);
  const series = Object.fromEntries(OPTION_IDS.map((id) => [id, []]));
  const totals = {};
  let tokensTotal = 0;
  let first = null;
  let last = null;

  for (const id of OPTION_IDS) {
    totals[id] = { setup: pricing.ops.setupEngineerMonths[id] * eng, infra: 0, training: 0, ops: 0, total: 0 };
  }
  for (let m = 0; m < months; m++) {
    const factor = Math.pow(1 + input.growth, m);
    const mc = monthCost(input, pricing, factor);
    if (m === 0) first = mc;
    last = mc;
    tokensTotal += mc.tokens.tokIn + mc.tokens.tokOut;
    for (const id of OPTION_IDS) {
      const o = mc.options[id];
      const t = totals[id];
      t.infra += o.infra;
      t.training += o.training;
      t.ops += o.ops;
      const prev = m === 0 ? t.setup : series[id][m - 1];
      series[id].push(prev + o.total);
    }
  }
  for (const id of OPTION_IDS) {
    const t = totals[id];
    t.total = t.setup + t.infra + t.training + t.ops;
    t.perMillionTokens = tokensTotal > 0 ? t.total / (tokensTotal / 1e6) : 0;
  }

  const score = new Set(input.signals).size;
  const rec = recommend(totals, feas, score, input);
  const breakeven = feas.api.ok ? breakevenMonth(series, rec.id) : null;

  return {
    input,
    feasibility: feas,
    totals,
    series,
    firstMonth: first,
    lastMonth: last,
    tokensTotal,
    score,
    verdict: readinessVerdict(score),
    recommendation: rec,
    breakeven,
  };
}

/** Самый дешёвый применимый вариант с поправками на сигналы готовности из гайда. */
export function recommend(totals, feas, score, input) {
  const ranked = OPTION_IDS.filter((id) => feas[id].ok).sort((a, b) => totals[a].total - totals[b].total);
  const cheapest = ranked[0];
  const reasons = [];
  let id = cheapest;
  const s = new Set(input.signals);
  const within = (cand, pct) => feas[cand]?.ok && totals[cand].total <= totals[cheapest].total * (1 + pct);

  if (score >= DEDICATED_THRESHOLD && (cheapest === 'api' || cheapest === 'vm')) {
    const dedicated = within('bm', 0.15) ? 'bm' : null;
    if (dedicated) {
      id = dedicated;
      reasons.push('При сопоставимой стоимости (±15%) выделенные серверы дают контроль, изоляцию и предсказуемую производительность');
    }
  } else if (score <= 2 && cheapest !== 'api' && within('api', 0.3)) {
    id = 'api';
    reasons.push('Сигналов к переходу мало — дешевле в эксплуатации остаться на API и проверить гипотезу');
  }

  if (id === 'vm' && within('mli', 0.01)) { id = 'mli'; reasons.push('При сопоставимых затратах можно использовать управляемый инференс'); }
  if (id === cheapest) reasons.unshift('Минимальная совокупная стоимость владения на выбранном горизонте');
  if (id === 'cluster' && s.has('distributed')) reasons.push('Распределённое обучение идёт по InfiniBand между серверами');
  else if (id === 'cluster' && !feas.bm.ok) reasons.push('Модель не помещается в один сервер — серверы объединяются через InfiniBand');
  if ((id === 'bm' || id === 'cluster') && (s.has('finetune') || s.has('trainAndServe'))) {
    reasons.push('Дообучение идёт на простаивающих мощностях выделенных серверов');
  }
  if ((id === 'bm' || id === 'cluster') && s.has('isolation')) reasons.push('Изоляция на уровне железа — без общего гипервизора');
  else if ((id === 'bm' || id === 'cluster') && s.has('sensitive')) reasons.push('Физическая изоляция упрощает соответствие 152-ФЗ и аудит ИБ');
  if (id === 'api') reasons.push('Не нужно закупать оборудование и держать команду эксплуатации');
  if (id === 'mli') reasons.push('Управляемый запуск выбранной модели на облачных GPU');
  if (id === 'vm') reasons.push('Почасовая оплата и автоскейлинг под неровную нагрузку');

  const alt = ranked.find((x) => x !== id) || null;
  return { id, cheapest, ranked, alternative: alt, reasons };
}

/** Первый месяц, с которого накопленные затраты варианта ниже, чем у API. */
export function breakevenMonth(series, id) {
  if (id === 'api') return null;
  const a = series.api;
  const b = series[id];
  for (let m = 0; m < a.length; m++) if (b[m] <= a[m]) return m + 1;
  return null;
}
