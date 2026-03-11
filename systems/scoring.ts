import { BeadSegment, DefectEvent } from '../store/gameStore';
import { LevelConfig } from '../data/levels';

export interface ScoreBreakdown {
  consistency: number;   // 0-100
  fusion: number;        // 0-100
  defectPenalty: number; // 0-100 (deducted)
  speedBonus: number;    // 0-100
  cleanRun: number;      // 0-100
  total: number;         // 0-100
  grade: string;
}

export function calculateScore(
  beads: BeadSegment[],
  defects: DefectEvent[],
  level: LevelConfig,
  completionTimeMs: number,
  expectedTimeMs: number
): ScoreBreakdown {
  // Bead consistency: width variance
  const widths = beads.map((b) => b.width);
  const avgWidth = widths.reduce((a, b) => a + b, 0) / (widths.length || 1);
  const variance = widths.reduce((a, b) => a + Math.pow(b - avgWidth, 2), 0) / (widths.length || 1);
  const consistencyScore = Math.max(0, 100 - variance * 2);

  // Fusion quality: penalize incomplete fusion defects
  const fusionDefects = defects.filter((d) => d.type === 'incomplete_fusion');
  const fusionScore = Math.max(0, 100 - fusionDefects.length * 20 - fusionDefects.reduce((a, d) => a + d.severity * 10, 0));

  // Defect penalty
  const defectScore = Math.max(0, 100 - defects.length * 15 - defects.reduce((a, d) => a + d.severity * 5, 0));

  // Speed bonus
  const speedRatio = expectedTimeMs / Math.max(completionTimeMs, expectedTimeMs * 0.5);
  const speedBonus = Math.min(100, speedRatio * 60);

  // Clean run bonus (no burn-through or stick)
  const hasBadDefect = defects.some((d) => d.type === 'burn_through' || d.type === 'stick');
  const cleanRun = hasBadDefect ? 0 : 100;

  const total = Math.round(
    consistencyScore * 0.25 +
    fusionScore * 0.25 +
    defectScore * 0.30 +
    speedBonus * 0.10 +
    cleanRun * 0.10
  );

  const grade =
    total >= 90 ? 'A+' :
    total >= 85 ? 'A' :
    total >= 80 ? 'B+' :
    total >= 75 ? 'B' :
    total >= 70 ? 'C+' :
    total >= 65 ? 'C' :
    total >= 60 ? 'D' : 'F';

  return { consistency: consistencyScore, fusion: fusionScore, defectPenalty: defectScore, speedBonus, cleanRun, total, grade };
}
