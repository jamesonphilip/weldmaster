export interface LevelConfig {
  id: string;
  name: string;
  metal: string;
  process: string;
  electrode: string;
  shieldingGas: string;
  jointType: string;
  amperageRange: [number, number];
  travelSpeedRange: [number, number];
  arcLengthRange: [number, number];
  environment: string;
  hazardModifiers: { burnThroughRisk: string; distortionRisk: string };
  passingScore: number;
  unlockMessage: string;
  description: string;
  difficulty: number;
}

export const LEVELS: LevelConfig[] = [
  {
    id: 'scrap_yard',
    name: 'Scrap Yard',
    metal: 'mild_steel_thick',
    process: 'SMAW',
    electrode: 'E6013',
    shieldingGas: 'none',
    jointType: 'butt',
    amperageRange: [90, 140],
    travelSpeedRange: [3, 7],
    arcLengthRange: [4, 8],
    environment: 'outdoor',
    hazardModifiers: { burnThroughRisk: 'low', distortionRisk: 'low' },
    passingScore: 60,
    unlockMessage: 'Solid stick work. You\'ve earned your helmet.',
    description: 'Learn basic travel speed and arc length on thick plate.',
    difficulty: 1,
  },
  {
    id: 'auto_body',
    name: 'Auto Body Shop',
    metal: 'mild_steel_thin',
    process: 'MIG',
    electrode: 'ER70S-6',
    shieldingGas: 'C25',
    jointType: 'butt',
    amperageRange: [80, 130],
    travelSpeedRange: [4, 8],
    arcLengthRange: [3, 6],
    environment: 'indoor',
    hazardModifiers: { burnThroughRisk: 'high', distortionRisk: 'high' },
    passingScore: 65,
    unlockMessage: 'Clean beads. The body shop foreman is impressed.',
    description: 'Avoid burn-through on thin gauge sheet metal.',
    difficulty: 2,
  },
  {
    id: 'fabrication',
    name: 'Fabrication Factory',
    metal: 'structural_steel',
    process: 'FCAW',
    electrode: 'E71T-1',
    shieldingGas: 'C100',
    jointType: 'T-joint',
    amperageRange: [150, 220],
    travelSpeedRange: [5, 10],
    arcLengthRange: [5, 9],
    environment: 'indoor_drafty',
    hazardModifiers: { burnThroughRisk: 'medium', distortionRisk: 'medium' },
    passingScore: 70,
    unlockMessage: 'Structural quality. The inspector signed off.',
    description: 'Maintain fusion on vertical T-joint in drafty conditions.',
    difficulty: 3,
  },
  {
    id: 'pipe_yard',
    name: 'Pipe Yard',
    metal: 'stainless_pipe',
    process: 'TIG',
    electrode: 'ER308L',
    shieldingGas: 'Argon',
    jointType: 'butt',
    amperageRange: [60, 100],
    travelSpeedRange: [2, 5],
    arcLengthRange: [2, 4],
    environment: 'outdoor',
    hazardModifiers: { burnThroughRisk: 'medium', distortionRisk: 'high' },
    passingScore: 75,
    unlockMessage: 'X-ray quality. Pipe certified.',
    description: 'Precise amperage, no oxidation on stainless.',
    difficulty: 4,
  },
  {
    id: 'underwater_rig',
    name: 'Underwater Rig',
    metal: 'stainless_steel',
    process: 'WET_SMAW',
    electrode: 'E316L-W',
    shieldingGas: 'none',
    jointType: 'butt',
    amperageRange: [120, 180],
    travelSpeedRange: [6, 12],
    arcLengthRange: [6, 10],
    environment: 'underwater',
    hazardModifiers: { burnThroughRisk: 'high', distortionRisk: 'high' },
    passingScore: 80,
    unlockMessage: 'You\'re the best underwater welder on the rig.',
    description: 'Extreme difficulty. Limited visibility. Special electrodes.',
    difficulty: 5,
  },
];
