export const RESULT_LABELS = {
  SINGLE: '一壘安打',
  DOUBLE: '二壘安打',
  TRIPLE: '三壘安打',
  HOME_RUN: '全壘打',
  WALK: '保送',
  STRIKEOUT: '三振',
  DROPPED_THIRD_STRIKE: '不死三振',
  GROUNDOUT: '滾地出局',
  FLYOUT: '飛球出局',
  DOUBLE_PLAY: '雙殺',
  ERROR: '失誤',
  FIELDERS_CHOICE: '野手選擇',
  HIT_BY_PITCH: '觸身球',
  SACRIFICE: '犧牲打',
  WILD_PITCH: '暴投',
  BALK: '投手犯規',
  STOLEN_BASE: '盜壘',
  PICKOFF: '牽制出局',
};

export const STATUS_LABELS = {
  not_started: '未開始',
  live: '進行中',
  completed: '已結束',
  cancelled: '取消',
};

export const BASE_LABELS = {
  first: '一壘',
  second: '二壘',
  third: '三壘',
};

export const FIELDER_POSITION_LABELS = {
  P: '投',
  C: '捕',
  '1B': '一',
  '2B': '二',
  '3B': '三',
  SS: '遊',
  LF: '左',
  CF: '中',
  RF: '右',
};

export function getResultLabel(result) {
  return RESULT_LABELS[result] || result || '事件';
}

export function getStatusLabel(status) {
  return STATUS_LABELS[status] || status || '未開始';
}

export function getFielderPositionLabel(position) {
  return FIELDER_POSITION_LABELS[position] || position || '';
}

export function formatPlayChange(runs = 0, outs = 0) {
  const runText = Number(runs || 0) > 0 ? `得 ${Number(runs)} 分` : '無得分';
  const outText = Number(outs || 0) > 0 ? `新增 ${Number(outs)} 出局` : '無新增出局';
  return `${runText} / ${outText}`;
}

export function advanceHitBases(currentBases, batterId, baseCount) {
  const bases = { first: '', second: '', third: '' };
  let runs = 0;
  [
    { key: 'third', index: 3, runnerId: currentBases.third },
    { key: 'second', index: 2, runnerId: currentBases.second },
    { key: 'first', index: 1, runnerId: currentBases.first },
  ].forEach((base) => {
    if (!base.runnerId) return;
    const nextBase = base.index + baseCount;
    if (nextBase >= 4) runs += 1;
    else if (nextBase === 3) bases.third = base.runnerId;
    else if (nextBase === 2) bases.second = base.runnerId;
    else bases.first = base.runnerId;
  });

  if (batterId) {
    if (baseCount >= 4) runs += 1;
    else if (baseCount === 3) bases.third = batterId;
    else if (baseCount === 2) bases.second = batterId;
    else bases.first = batterId;
  }

  return { bases, runs };
}

export function advanceForcedWalk(currentBases, batterId) {
  const bases = { ...currentBases };
  let runs = 0;

  if (currentBases.first) {
    if (currentBases.second) {
      if (currentBases.third) runs += 1;
      bases.third = currentBases.second;
    }
    bases.second = currentBases.first;
  }
  if (batterId) bases.first = batterId;

  return { bases, runs };
}

export function advanceDoublePlay(currentBases) {
  const bases = { first: '', second: '', third: '' };
  let runs = 0;

  if (currentBases.first) {
    if (currentBases.third) runs += 1;
    if (currentBases.second) bases.third = currentBases.second;
    return { bases, runs };
  }

  if (currentBases.third) {
    if (currentBases.second) bases.second = currentBases.second;
    return { bases, runs };
  }

  return { bases, runs };
}

export function advanceRunnerBases(currentBases, baseCount = 1) {
  return advanceHitBases(currentBases, '', baseCount);
}

export function pickOffLeadRunner(currentBases) {
  const bases = { ...currentBases };
  const leadRunnerBase = ['third', 'second', 'first'].find((base) => bases[base]);
  if (leadRunnerBase) bases[leadRunnerBase] = '';
  return { bases, runs: 0, outs: leadRunnerBase ? 1 : 0 };
}

export function summarizeRunnerDestinations(destinations, context = {}, includeBatter = true) {
  const bases = { first: '', second: '', third: '' };
  let runs = 0;
  let outs = 0;

  for (const source of getRunnerSources(context, includeBatter)) {
    const fallback = source.key === 'batter' ? 'batter' : source.key;
    const destination = destinations[source.key] || fallback;
    if (destination === 'home') runs += 1;
    else if (destination === 'out') outs += 1;
    else if (destination && bases[destination] !== undefined) bases[destination] = source.runnerId;
  }

  if (includeBatter && destinations.batter === 'out' && Number(context.outsInHalf || 0) + outs >= 3) {
    runs = 0;
  }

  return { bases, runs, outs };
}

export function applyForcedAdvanceDestinations(destinations, bases) {
  if (bases.third && bases.second && bases.first) destinations.third = 'home';
  if (bases.second && bases.first) destinations.second = 'third';
  if (bases.first) destinations.first = 'second';
  destinations.batter = 'first';
}

export function getAutomaticPlayAction(result, context = {}, eventType = 'PLATE_APPEARANCE') {
  const batterId = context.batterId || '';
  const bases = context.bases || { first: '', second: '', third: '' };
  if (eventType === 'RUNNER_ADVANCEMENT') {
    if (result === 'WILD_PITCH') return { label: '暴投跑壘', ...advanceRunnerBases(bases, 1) };
    if (result === 'BALK') return { label: '投手犯規進壘', ...advanceRunnerBases(bases, 1) };
    if (result === 'STOLEN_BASE') return { label: '盜壘', ...advanceRunnerBases(bases, 1) };
    if (result === 'PICKOFF') return { label: '牽制出局', ...pickOffLeadRunner(bases) };
    return null;
  }
  if (!batterId) return null;
  if (result === 'SINGLE') return { label: '一壘安打', ...advanceHitBases(bases, batterId, 1) };
  if (result === 'DOUBLE') return { label: '二壘安打', ...advanceHitBases(bases, batterId, 2) };
  if (result === 'TRIPLE') return { label: '三壘安打', ...advanceHitBases(bases, batterId, 3) };
  if (result === 'HOME_RUN') return { label: '全壘打', ...advanceHitBases(bases, batterId, 4) };
  if (result === 'WALK') return { label: '保送', ...advanceForcedWalk(bases, batterId) };
  if (result === 'HIT_BY_PITCH') return { label: '觸身球', ...advanceForcedWalk(bases, batterId) };
  if (result === 'DROPPED_THIRD_STRIKE') return { label: '不死三振上壘', ...advanceForcedWalk(bases, batterId), outs: 0 };
  if (result === 'STRIKEOUT') return { label: '三振', bases, runs: 0, outs: 1 };
  if (result === 'DOUBLE_PLAY') return { label: '雙殺', ...advanceDoublePlay(bases), outs: 2 };
  if (result === 'SACRIFICE') return { label: getResultLabel(result), ...advanceRunnerBases(bases, 1), outs: 1 };
  if (['GROUNDOUT', 'FLYOUT'].includes(result)) return { label: getResultLabel(result), bases, runs: 0, outs: 1 };
  if (['ERROR', 'FIELDERS_CHOICE'].includes(result)) return { label: getResultLabel(result), ...advanceForcedWalk(bases, batterId), outs: 0 };
  return null;
}

export function getRunnerSources(context = {}, includeBatter = true) {
  const bases = context.bases || {};
  const sources = [
    { key: 'third', label: '三壘跑者', runnerId: bases.third },
    { key: 'second', label: '二壘跑者', runnerId: bases.second },
    { key: 'first', label: '一壘跑者', runnerId: bases.first },
  ].filter((runner) => runner.runnerId);
  if (includeBatter && context.batterId) {
    sources.push({ key: 'batter', label: '打者', runnerId: context.batterId });
  }
  return sources;
}

export function getAdvancedDestination(sourceKey, baseCount) {
  const baseIndex = { first: 1, second: 2, third: 3, batter: 0 }[sourceKey];
  const nextBase = baseIndex + baseCount;
  if (nextBase >= 4) return 'home';
  if (nextBase === 3) return 'third';
  if (nextBase === 2) return 'second';
  return 'first';
}

export function getDefaultRunnerDestinations(result, context = {}, eventType = 'PLATE_APPEARANCE') {
  const bases = context.bases || {};
  const destinations = {};
  const includeBatter = eventType === 'PLATE_APPEARANCE';
  for (const source of getRunnerSources(context, includeBatter)) {
    destinations[source.key] = source.key === 'batter' ? 'out' : source.key;
  }

  if (eventType === 'RUNNER_ADVANCEMENT' && result === 'PICKOFF') {
    const leadRunnerKey = ['third', 'second', 'first'].find((sourceKey) => bases[sourceKey]);
    if (leadRunnerKey) destinations[leadRunnerKey] = 'out';
  } else if (eventType === 'RUNNER_ADVANCEMENT') {
    Object.keys(destinations).forEach((sourceKey) => { destinations[sourceKey] = getAdvancedDestination(sourceKey, 1); });
  } else if (result === 'SINGLE') {
    Object.keys(destinations).forEach((sourceKey) => { destinations[sourceKey] = getAdvancedDestination(sourceKey, 1); });
  } else if (result === 'DOUBLE') {
    Object.keys(destinations).forEach((sourceKey) => { destinations[sourceKey] = getAdvancedDestination(sourceKey, 2); });
  } else if (result === 'TRIPLE') {
    Object.keys(destinations).forEach((sourceKey) => { destinations[sourceKey] = getAdvancedDestination(sourceKey, 3); });
  } else if (result === 'HOME_RUN') {
    Object.keys(destinations).forEach((sourceKey) => { destinations[sourceKey] = 'home'; });
  } else if (result === 'WALK' || result === 'HIT_BY_PITCH') {
    applyForcedAdvanceDestinations(destinations, bases);
  } else if (['DROPPED_THIRD_STRIKE', 'ERROR', 'FIELDERS_CHOICE'].includes(result)) {
    applyForcedAdvanceDestinations(destinations, bases);
  } else if (result === 'STRIKEOUT') {
    destinations.batter = 'out';
  } else if (result === 'DOUBLE_PLAY') {
    if (bases.first) {
      if (bases.third) destinations.third = 'home';
      if (bases.second) destinations.second = 'third';
    }
    const runnerOutKey = bases.first ? 'first' : Object.keys(destinations).find((sourceKey) => sourceKey !== 'batter');
    if (runnerOutKey) destinations[runnerOutKey] = 'out';
    destinations.batter = 'out';
  } else if (result === 'SACRIFICE') {
    Object.keys(destinations)
      .filter((sourceKey) => sourceKey !== 'batter')
      .forEach((sourceKey) => { destinations[sourceKey] = getAdvancedDestination(sourceKey, 1); });
    destinations.batter = 'out';
  }

  return destinations;
}

export function hasOccupiedBase(context = {}) {
  const bases = context.bases || {};
  return Boolean(bases.first || bases.second || bases.third);
}

export function requiresOccupiedBaseForResult(result) {
  return ['DOUBLE_PLAY', 'FIELDERS_CHOICE', 'SACRIFICE'].includes(result);
}

export function requiresFielderPosition(result) {
  return ['GROUNDOUT', 'FLYOUT'].includes(result);
}
