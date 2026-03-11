import { LevelConfig } from '../data/levels';
import { DefectEvent } from '../store/gameStore';

export interface TorchState {
  x: number;
  y: number;
  jointY: number;
  amperage: number;
  travelSpeed: number;
  arcLength: number; // 0-1 normalized
  isWelding: boolean;
  dwellTime: number; // seconds stationary
  heatAtPosition: number; // 0-1
}

export function detectDefects(
  torch: TorchState,
  level: LevelConfig,
  jointLength: number,
  dt: number
): DefectEvent | null {
  if (!torch.isWelding) return null;

  const position = Math.max(0, Math.min(1, torch.x / jointLength));
  const now = Date.now();

  // Arc length mapping: 0 = too close, 0.5 = ideal, 1 = too far
  const arcIdealMin = 0.35;
  const arcIdealMax = 0.65;

  // Electrode stick: arc too short
  if (torch.arcLength < 0.2) {
    return { type: 'stick', position, timestamp: now, severity: 0.8 };
  }

  // Porosity: arc too long
  if (torch.arcLength > 0.8) {
    return { type: 'porosity', position, timestamp: now, severity: (torch.arcLength - 0.8) / 0.2 };
  }

  // Undercut: amperage too high
  const [ampMin, ampMax] = level.amperageRange;
  if (torch.amperage > ampMax * 1.1) {
    return { type: 'undercut', position, timestamp: now, severity: Math.min(1, (torch.amperage - ampMax) / 30) };
  }

  // Incomplete fusion: amperage too low
  if (torch.amperage < ampMin * 0.85) {
    return { type: 'incomplete_fusion', position, timestamp: now, severity: Math.min(1, (ampMin - torch.amperage) / 30) };
  }

  // Cold lap: moving too fast
  const [speedMin, speedMax] = level.travelSpeedRange;
  if (torch.travelSpeed > speedMax * 15) { // px/sec scaled
    return { type: 'cold_lap', position, timestamp: now, severity: Math.min(1, (torch.travelSpeed - speedMax * 15) / 100) };
  }

  // Burn-through: dwelling too long
  if (torch.dwellTime > 1.5 && torch.heatAtPosition > 0.7) {
    return { type: 'burn_through', position, timestamp: now, severity: Math.min(1, torch.dwellTime / 3) };
  }

  return null;
}

export const DEFECT_LABELS: Record<DefectEvent['type'], string> = {
  porosity: 'Porosity',
  undercut: 'Undercut',
  cold_lap: 'Cold Lap',
  burn_through: 'Burn-Through',
  stick: 'Electrode Stick',
  incomplete_fusion: 'Incomplete Fusion',
};

export const DEFECT_TIPS: Record<DefectEvent['type'], string> = {
  porosity: 'Keep the arc closer to the work. Too long an arc causes gas pockets.',
  undercut: 'Reduce amperage. Too much heat digs into the base metal.',
  cold_lap: 'Slow down! The metal needs time to fuse properly.',
  burn_through: 'Keep moving. Dwelling in one spot melts through thin metal.',
  stick: 'Increase arc length slightly. The electrode is touching the pool.',
  incomplete_fusion: 'Increase amperage or slow travel speed for better penetration.',
};
