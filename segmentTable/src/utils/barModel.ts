import { VARIABLE_CONFIG, VariableConfig } from "../dictionaries";

export type Segment = {
  from: number;
  to: number;
};

export type BarModel = {
  segments: Segment[];
  position: number;
  value: number | string;
  min: number;
  max: number;
  score?: number | null;
  label?: string;
};

export function formatCategoryLabel(value: string): string {
    return value.replace(/&/g, "/");
}

function buildLabel(measure: string | number, score?: number | null): string {
    const formattedMeasure = typeof measure === "string" ? formatCategoryLabel(measure) : measure;

    if (typeof formattedMeasure === "number") {
        return formattedMeasure.toString();
    }

    if (score != null) {
        if (score === 0) {
            return `${formattedMeasure} (no impact)`;
        } else {
            const sign = score > 0 ? "+" : "";
            const suffix = Math.abs(score) > 1 ? "notches" : "notch";
            return `${formattedMeasure} (${sign}${score} ${suffix})`;
        }
    }

    return formattedMeasure.toString();
}

export function buildBarModel(label: string, value: number | string | null, scaleFromData?: number | null): BarModel | null {
  const config = VARIABLE_CONFIG[(label || "").toLowerCase().trim()];
  if (!config || value == null) return null;

  let numericVal: number | null = null;
  const isNumeric = typeof value === "number";

  if (isNumeric) {
    numericVal = value as number;
  } else if (typeof value === "string" && config.valueMap) {
    const mapVal = config.valueMap[value.toLowerCase().trim()];
    if (mapVal !== undefined) numericVal = mapVal;
  }

  if (numericVal === null) return null;

  let min = config.min;
  let max = config.max;
  const thresholds: number[] = [];

  if (config.discrete) {
    min -= 0.5;
    max += 0.5;
    for (let i = config.min; i < config.max; i++) {
        thresholds.push(i + 0.5);
    }
  } else {
    if (config.thresholds) {
        thresholds.push(...config.thresholds);
    } else if (config.valueMap) {
        const values = Object.values(config.valueMap);
        const uniqueVals = Array.from(new Set(values)).sort((a,b)=>a-b);
        thresholds.push(...uniqueVals);
    } else {
        const range = max - min;
        let numZones = Math.max(1, Math.round(range));
        if (range < 1 && range > 0) numZones = 10;
        else if (numZones > 50) numZones = 50;

        const step = range / numZones;
        for (let i = 1; i < numZones; i++) {
            thresholds.push(min + i * step);
        }
    }
  }

  if (min >= max) max = min + 1;

  const marks = [min, ...thresholds, max];
  const segments: Segment[] = [];
  for (let i = 0; i < marks.length - 1; i++) {
    segments.push({ from: marks[i], to: marks[i+1] });
  }

  return {
    segments,
    position: numericVal,
    value,
    min,
    max,
    score: scaleFromData,
    label: buildLabel(value, scaleFromData)
  };
}