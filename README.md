# Bead Runner

A mobile welding simulation game built with React Native + Expo. Learn real welding technique by dragging a virtual electrode across a joint — arc length, travel speed, amperage, and defect detection all modeled after actual welding physics.

## Gameplay

- Hold the grip below the joint and drag left to right
- The rod tip reaches up to the weld surface at a 30° angle
- **Arc length** is controlled by how far below the joint you hold your grip
- **Travel speed** is how fast you move across
- Goal: lay a solid green bead across the full joint — green means both arc and speed are correct
- After welding, wire brush the slag off before inspection
- Score is graded on coverage, consistency, fusion, defects, and clean run

## Levels

| # | Job | Process | Metal | Difficulty |
|---|-----|---------|-------|-----------|
| 1 | Scrap Yard | SMAW (Stick) | Mild Steel Thick | ★ |
| 2 | Auto Body Shop | MIG | Mild Steel Thin | ★★ |
| 3 | Fabrication Factory | FCAW | Structural Steel | ★★★ |
| 4 | Pipe Yard | TIG | Stainless Steel Pipe | ★★★★ |
| 5 | Underwater Rig | WET SMAW | Stainless Steel | ★★★★★ |

## Tech Stack

- **React Native 0.81.4** + **Expo SDK 54**
- **expo-router 5** (file-based routing)
- **Zustand v5** (state management)
- **react-native-gesture-handler** (pan gesture for torch control)
- **expo-haptics** (tactile arc feedback)
- Plain RN `View`-based rendering (no Skia — runs in Expo Go)
- Heat simulation via `Float32Array` gaussian spread
- Defect detection: porosity, undercut, cold lap, burn-through, stick, incomplete fusion

## Project Structure

```
app/
  index.tsx          — main menu / job board
  game/[levelId].tsx — game screen with physics tick loop
components/
  WeldCanvas.tsx     — visual renderer (plates, bead, rod, sparks)
  TorchGesture.tsx   — pan gesture handler
  BrushingCanvas.tsx — wire brush mini-game
  ReportCard.tsx     — post-run bead report
  AmperageSlider.tsx — amperage control
  ElectrodeSelector.tsx
systems/
  heatSimulation.ts  — gaussian heat spread + heatToColor
  defectDetector.ts  — defect detection per tick
  scoring.ts         — score calculation
  beadRenderer.ts    — bead width + color
data/
  levels.ts          — level configs
  metals.ts          — metal thermal properties
store/
  gameStore.ts       — Zustand store
```

## Running

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on iOS or Android.

## Made by

Jameson Philip — [@jamesonphilip](https://github.com/jamesonphilip)
