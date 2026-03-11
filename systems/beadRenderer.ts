import { BeadSegment } from '../store/gameStore';

export function buildBeadPath(segments: BeadSegment[], jointY: number): string {
  if (segments.length < 2) return '';
  let d = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (i === 0) {
      d += `M ${seg.x} ${jointY}`;
    } else {
      d += ` L ${seg.x} ${jointY}`;
    }
  }
  return d;
}

export function getBeadWidth(amperage: number, travelSpeed: number): number {
  // Higher amperage = wider bead, faster travel = narrower
  const base = amperage / 20;
  const speedFactor = Math.max(0.5, 1 - travelSpeed / 500);
  return Math.max(4, Math.min(20, base * speedFactor));
}

export function getBeadColor(heat: number): string {
  if (heat > 0.8) return '#FF8C00';
  if (heat > 0.6) return '#CD8B3C';
  if (heat > 0.4) return '#A07840';
  if (heat > 0.2) return '#7A6040';
  return '#5A5048';
}
