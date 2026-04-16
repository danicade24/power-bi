import { RATINGS_MAP } from "./ratings";

export type VariableConfig = {
  min: number;
  max: number;

  valueMap?: Record<string, number>;
  thresholds?: number[];

  // indica escala discreta (1–10, 1–5, etc.)
  discrete?: boolean;
  
  // si es true, valores numéricos altos son "mejores" (Green). ej: Funding & Liquidity (-3 a 1)
  higherIsBetter?: boolean;
};

export const VARIABLE_CONFIG: Record<string, VariableConfig> = {

  "economic risk": {
    min: 1,
    max: 10,
    discrete: true
  },

  "industry risk": {
    min: 1,
    max: 10,
    discrete: true
  },


  "business position": {  
    min: 1,
    max: 6,
    discrete: true,
    valueMap: {
      "very strong": 1,
      "strong": 2,
      "adequate": 3,
      "moderate": 4,
      "constrained": 5,
      "weak": 6
    }
  },

  "risk position": {
    min: 1,
    max: 6,
    discrete: true,
    valueMap: {
      "very strong": 1,
      "strong": 2,
      "adequate": 3,
      "moderate": 4,
      "constrained": 5,
      "weak": 6
    }
  },

  "capital & earnings": {
    min: 1,
    max: 6,
    discrete: true,
    valueMap: {
      "very strong": 1,
      "strong": 2,
      "adequate": 3,
      "moderate": 4,
      "constrained": 5,
      "weak": 6
    }
  },

  "comparable rating analysis": {
    min: -1,
    max: 1,
    discrete: true,
    higherIsBetter: true
  },
  
  "funding & liquidity": {
    min: -3,
    max: 1,
    discrete: true,
    higherIsBetter: true,
    valueMap: {
        "strong & strong": 1,
        "strong & adequate":0,
        "strong & moderate": -1,
        "strong & weak": -2,
        "adequate & strong":0,
        "adequate & adequate":0,
        "adequate & moderate": -1,
       "adequate & weak": -2,
       "moderate & strong": 0,
       "moderate & adequate": -1,
       "moderate & moderate": -2,
       "moderate & weak": -3,
       "weak & strong": -1,
       "weak & adequate": -2,
       "weak & moderate": -3
    }
  },

  "numeric variable example": {
    min: 0,
    max: 100
  },

  "rating": {
    valueMap: RATINGS_MAP,
    min: Math.min(...Object.values(RATINGS_MAP)),
    max: Math.max(...Object.values(RATINGS_MAP)),
    discrete: true
  }
};