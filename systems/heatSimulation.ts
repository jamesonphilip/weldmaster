import { MetalProperties } from '../data/metals';

export interface HeatState {
  values: Float32Array; // heat 0-1 at each grid point along joint
  width: number;
}

export function initHeatState(jointLengthPx: number): HeatState {
  const width = Math.ceil(jointLengthPx);
  return { values: new Float32Array(width), width };
}

export function updateHeat(
  state: HeatState,
  torchX: number,
  isWelding: boolean,
  amperage: number,
  metal: MetalProperties,
  dt: number // seconds
): HeatState {
  const next = new Float32Array(state.values);
  const conductivity = metal.thermalConductivity / 100;
  const heatInput = isWelding ? (amperage / 200) * 0.8 : 0;
  const spread = Math.max(20, amperage / 4); // heat spread radius in px

  for (let i = 0; i < state.width; i++) {
    // Input heat from torch (gaussian distribution)
    const dist = Math.abs(i - torchX);
    const gaussian = Math.exp(-(dist * dist) / (2 * spread * spread));
    next[i] += heatInput * gaussian * dt * 3;

    // Conduction to neighbors
    if (i > 0 && i < state.width - 1) {
      const diff = (state.values[i - 1] + state.values[i + 1] - 2 * state.values[i]);
      next[i] += conductivity * diff * dt;
    }

    // Cooling (radiation + convection)
    const coolingRate = 0.3 + state.values[i] * 0.5;
    next[i] -= coolingRate * next[i] * dt;
    next[i] = Math.max(0, Math.min(1, next[i]));
  }

  return { values: next, width: state.width };
}

export function heatToColor(heat: number): { r: number; g: number; b: number; a: number } {
  // 0 = cool grey, 0.2 = dull red, 0.5 = orange, 0.8 = yellow-white, 1.0 = white
  if (heat < 0.2) {
    const t = heat / 0.2;
    return { r: Math.floor(90 + t * 80), g: Math.floor(90 - t * 40), b: Math.floor(90 - t * 40), a: 255 };
  } else if (heat < 0.5) {
    const t = (heat - 0.2) / 0.3;
    return { r: Math.floor(170 + t * 55), g: Math.floor(50 + t * 70), b: Math.floor(50 - t * 30), a: 255 };
  } else if (heat < 0.8) {
    const t = (heat - 0.5) / 0.3;
    return { r: 225, g: Math.floor(120 + t * 100), b: Math.floor(20 + t * 30), a: 255 };
  } else {
    const t = (heat - 0.8) / 0.2;
    return { r: 255, g: Math.floor(220 + t * 35), b: Math.floor(50 + t * 205), a: 255 };
  }
}

export function isBurnThrough(heat: number, metal: MetalProperties): boolean {
  return heat > (metal.burnThroughTemp / 2000);
}
