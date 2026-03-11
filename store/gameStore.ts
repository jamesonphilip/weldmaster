import { create } from 'zustand';

export interface DefectEvent {
  type: 'porosity' | 'undercut' | 'cold_lap' | 'burn_through' | 'stick' | 'incomplete_fusion';
  position: number; // 0-1 along the joint
  timestamp: number;
  severity: number; // 0-1
}

export interface BeadSegment {
  x: number;
  y: number;
  width: number;
  heat: number; // 0-1
  quality: number; // 0-1: 1 = good arc + good speed, 0 = bad
  timestamp: number;
  hasDefect: boolean;
  defectType?: DefectEvent['type'];
}

export interface WeldState {
  isWelding: boolean;
  torchX: number;
  torchY: number;
  amperage: number;
  arcLength: number; // 0-1, 0.5 = ideal
  travelSpeed: number; // px/sec
  heatMap: number[]; // heat values along joint
  beadSegments: BeadSegment[];
  defects: DefectEvent[];
  currentLevel: string;
  completedLevels: Record<string, number>; // levelId -> score
  arcStruck: boolean;
  stickEvent: boolean;
  burnThroughEvent: boolean;
  jointProgress: number; // 0-1
}

export interface GameActions {
  setTorchPosition: (x: number, y: number) => void;
  setAmperage: (amp: number) => void;
  setArcLength: (len: number) => void;
  setTravelSpeed: (speed: number) => void;
  strikeArc: () => void;
  stopArc: () => void;
  addBeadSegment: (seg: BeadSegment) => void;
  addDefect: (defect: DefectEvent) => void;
  updateHeat: (heat: number[]) => void;
  setCurrentLevel: (id: string) => void;
  completeLevel: (id: string, score: number) => void;
  resetWeld: () => void;
  setStickEvent: (v: boolean) => void;
  setBurnThroughEvent: (v: boolean) => void;
  setJointProgress: (v: number) => void;
}

const initialWeldState: WeldState = {
  isWelding: false,
  torchX: 0,
  torchY: 0,
  amperage: 120,
  arcLength: 0.5,
  travelSpeed: 0,
  heatMap: [],
  beadSegments: [],
  defects: [],
  currentLevel: 'scrap_yard',
  completedLevels: {},
  arcStruck: false,
  stickEvent: false,
  burnThroughEvent: false,
  jointProgress: 0,
};

export const useGameStore = create<WeldState & GameActions>((set) => ({
  ...initialWeldState,
  setTorchPosition: (x, y) => set({ torchX: x, torchY: y }),
  setAmperage: (amperage) => set({ amperage }),
  setArcLength: (arcLength) => set({ arcLength }),
  setTravelSpeed: (travelSpeed) => set({ travelSpeed }),
  strikeArc: () => set({ isWelding: true, arcStruck: true }),
  stopArc: () => set({ isWelding: false }),
  addBeadSegment: (seg) =>
    set((s) => ({
      beadSegments: s.beadSegments.length >= 500
        ? [...s.beadSegments.slice(-499), seg]
        : [...s.beadSegments, seg],
    })),
  addDefect: (defect) => set((s) => ({ defects: [...s.defects, defect] })),
  updateHeat: (heatMap) => set({ heatMap }),
  setCurrentLevel: (currentLevel) => set({ currentLevel }),
  completeLevel: (id, score) =>
    set((s) => ({ completedLevels: { ...s.completedLevels, [id]: score } })),
  resetWeld: () =>
    set({
      isWelding: false,
      arcStruck: false,
      beadSegments: [],
      defects: [],
      heatMap: [],
      torchX: 0,
      torchY: 0,
      travelSpeed: 0,
      stickEvent: false,
      burnThroughEvent: false,
      jointProgress: 0,
    }),
  setStickEvent: (stickEvent) => set({ stickEvent }),
  setBurnThroughEvent: (burnThroughEvent) => set({ burnThroughEvent }),
  setJointProgress: (jointProgress) => set({ jointProgress }),
}));
