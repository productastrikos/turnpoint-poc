// Logistic regression trained in the browser (standardised features, L2, full-batch gradient descent).
// Small on purpose: the models in TURNPOINT have about ten features and a few thousand rows, so training takes
// milliseconds, the weights can be shown on screen, and every prediction can be explained feature by feature.

export interface LogRegModel {
  features: string[];
  mean: number[];
  std: number[];
  w: number[]; // weights on standardised features
  b: number;
}

export interface TrainOptions {
  l2?: number;
  lr?: number;
  epochs?: number;
  /** Per-row weight, e.g. planner decisions count more than synthetic history. */
  sampleWeight?: number[];
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export function train(features: string[], X: number[][], y: number[], opts: TrainOptions = {}): LogRegModel {
  const { l2 = 0.01, lr = 0.5, epochs = 700, sampleWeight } = opts;
  const n = X.length;
  const d = features.length;
  const mean = Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[j], 0) / n);
  const std = Array.from({ length: d }, (_, j) => Math.sqrt(X.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / n) || 1);
  const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / std[j]));
  const sw = sampleWeight ?? new Array(n).fill(1);
  const wSum = sw.reduce((s, v) => s + v, 0);
  const w = new Array(d).fill(0);
  let b = 0;
  for (let e = 0; e < epochs; e++) {
    const gw = new Array(d).fill(0);
    let gb = 0;
    for (let i = 0; i < n; i++) {
      let z = b;
      for (let j = 0; j < d; j++) z += w[j] * Z[i][j];
      const err = (sigmoid(z) - y[i]) * sw[i];
      for (let j = 0; j < d; j++) gw[j] += err * Z[i][j];
      gb += err;
    }
    for (let j = 0; j < d; j++) w[j] -= lr * (gw[j] / wSum + l2 * w[j]);
    b -= lr * (gb / wSum);
  }
  return { features, mean, std, w, b };
}

export function logit(m: LogRegModel, x: number[]): number {
  return x.reduce((s, v, j) => s + m.w[j] * ((v - m.mean[j]) / m.std[j]), m.b);
}

export function predict(m: LogRegModel, x: number[]): number {
  return sigmoid(logit(m, x));
}

export interface Contribution {
  feature: string;
  value: number;
  /** Push on the log-odds relative to an average case: positive raises the probability. */
  contrib: number;
}

/** Feature-by-feature explanation of one prediction (exact for a linear model). */
export function explain(m: LogRegModel, x: number[]): Contribution[] {
  return m.features
    .map((feature, j) => ({ feature, value: x[j], contrib: m.w[j] * ((x[j] - m.mean[j]) / m.std[j]) }))
    .sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib));
}

/** Weights in raw feature units (per +1 of the feature), for a readable model card. */
export function rawWeights(m: LogRegModel): { feature: string; weight: number }[] {
  return m.features.map((feature, j) => ({ feature, weight: m.w[j] / m.std[j] }));
}

export interface Metrics {
  n: number;
  positives: number;
  auc: number;
  accuracy: number;
  precision: number;
  recall: number;
  brier: number;
  threshold: number;
}

export function evaluate(m: LogRegModel, X: number[][], y: number[], threshold = 0.5): Metrics {
  const p = X.map((x) => predict(m, x));
  let tp = 0, fp = 0, tn = 0, fn = 0, brier = 0;
  p.forEach((pi, i) => {
    const hit = pi >= threshold;
    if (hit && y[i]) tp++;
    else if (hit) fp++;
    else if (y[i]) fn++;
    else tn++;
    brier += (pi - y[i]) ** 2;
  });
  return {
    n: y.length,
    positives: y.filter(Boolean).length,
    auc: auc(p, y),
    accuracy: (tp + tn) / y.length,
    precision: tp / Math.max(1, tp + fp),
    recall: tp / Math.max(1, tp + fn),
    brier: brier / y.length,
    threshold,
  };
}

/** Area under the ROC curve via ranks (Mann-Whitney U), ties averaged. */
function auc(p: number[], y: number[]): number {
  const idx = p.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const rank = new Array(p.length).fill(0);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) rank[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  const pos = y.filter(Boolean).length;
  const neg = y.length - pos;
  if (!pos || !neg) return 0.5;
  const sumPos = y.reduce((s, v, i) => s + (v ? rank[i] : 0), 0);
  return (sumPos - (pos * (pos + 1)) / 2) / (pos * neg);
}

/** Deterministic train / hold-out split (every k-th row held out). */
export function split<T>(rows: T[], holdEvery = 5): { trainRows: T[]; testRows: T[] } {
  return { trainRows: rows.filter((_, i) => i % holdEvery !== 0), testRows: rows.filter((_, i) => i % holdEvery === 0) };
}
