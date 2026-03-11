import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { getBeadColor, getBeadWidth } from '../systems/beadRenderer';
import { heatToColor } from '../systems/heatSimulation';

interface WeldCanvasProps {
  width: number;
  height: number;
  jointY: number;
  jointStartX: number;
  jointEndX: number;
  levelEnvironment: string;
  jointType: string;
  process: string;
}

interface LevelTheme {
  bg: string;
  plateTop: string;
  plateBottom: string;
  plateHighlight: string;
  plateH: number;
  jointLineColor: string;
  atmosphere: string | null;
}

function getTheme(environment: string, process: string): LevelTheme {
  // TIG on pipe → stainless look regardless of env
  if (process === 'TIG') {
    return {
      bg: '#090910',
      plateTop: '#707880',
      plateBottom: '#586068',
      plateHighlight: '#909aaa',
      plateH: 46,
      jointLineColor: '#1a1a22',
      atmosphere: null,
    };
  }
  switch (environment) {
    case 'underwater':
      return {
        bg: '#000e1c',
        plateTop: '#253545',
        plateBottom: '#1c2838',
        plateHighlight: '#364858',
        plateH: 44,
        jointLineColor: '#0a1520',
        atmosphere: 'rgba(0,55,130,0.4)',
      };
    case 'indoor':
      return {
        bg: '#12121e',
        plateTop: '#8c8c8c',
        plateBottom: '#747474',
        plateHighlight: '#aaaaaa',
        plateH: 26,
        jointLineColor: '#484848',
        atmosphere: 'rgba(160,185,255,0.04)',
      };
    case 'indoor_drafty':
      return {
        bg: '#0c0c0c',
        plateTop: '#484848',
        plateBottom: '#383838',
        plateHighlight: '#585858',
        plateH: 70,
        jointLineColor: '#111',
        atmosphere: null,
      };
    default: // outdoor / scrap_yard
      return {
        bg: '#0a0908',
        plateTop: '#5c4c3a',
        plateBottom: '#3e3028',
        plateHighlight: '#706050',
        plateH: 52,
        jointLineColor: '#150e08',
        atmosphere: null,
      };
  }
}

// Tool appearance per welding process
function getToolColors(process: string) {
  switch (process) {
    case 'MIG':
    case 'FCAW':
      return { gripBody: '#1e3424', gripAccent: '#162a1c', rod: '#c8c890', rodOuter: '#989860' };
    case 'TIG':
      return { gripBody: '#1c1c32', gripAccent: '#141428', rod: '#aaaacc', rodOuter: '#888888' };
    case 'WET_SMAW':
      return { gripBody: '#0e2030', gripAccent: '#081828', rod: '#c87533', rodOuter: '#7a4515' };
    default: // SMAW
      return { gripBody: '#262626', gripAccent: '#181818', rod: '#c87533', rodOuter: '#7a4010' };
  }
}

export function WeldCanvas({
  width,
  height,
  jointY,
  jointStartX,
  jointEndX,
  levelEnvironment,
  jointType,
  process,
}: WeldCanvasProps) {
  const isWelding = useGameStore((s) => s.isWelding);
  const torchX = useGameStore((s) => s.torchX);
  const torchY = useGameStore((s) => s.torchY);
  const beadSegments = useGameStore((s) => s.beadSegments);
  const heatMap = useGameStore((s) => s.heatMap);
  const amperage = useGameStore((s) => s.amperage);
  const travelSpeed = useGameStore((s) => s.travelSpeed);
  const arcLength = useGameStore((s) => s.arcLength);
  const burnThroughEvent = useGameStore((s) => s.burnThroughEvent);

  const theme = getTheme(levelEnvironment, process);
  const tool = getToolColors(process);
  const jointW = jointEndX - jointStartX;
  const plateTopY = jointY - theme.plateH;
  const isT = jointType === 'T-joint';

  // Arc glow color: red = too far, orange = too close, yellow = ideal
  const arcColor = arcLength > 0.7 ? '#FF3300' : arcLength < 0.25 ? '#FF8800' : '#FFDD00';
  const poolRadius = 6 + amperage / 50;

  // --- Rod / tool geometry ---
  // The GRIP is at the user's finger. The electrode/wire extends DOWN toward the joint.
  const gripX = torchX;
  const gripY = torchY;

  // Rod tip hovers above the joint by an arc-length-dependent gap
  const arcGapPx = 5 + arcLength * 16;
  const rodTipY = jointY - arcGapPx;
  // Slight forward lean (~13% of vertical distance) like real welding stance
  const lean = (rodTipY - gripY) * 0.13;
  const rodTipX = gripX + lean;

  // Rotated rod body drawn as a center-positioned rotated View
  const rdx = rodTipX - gripX;
  const rdy = rodTipY - gripY;
  const rodLen = Math.sqrt(rdx * rdx + rdy * rdy);
  const rodAngleDeg = Math.atan2(rdy, rdx) * 180 / Math.PI;
  const rodCenterX = (gripX + rodTipX) / 2;
  const rodCenterY = (gripY + rodTipY) / 2;

  return (
    <View style={{ width, height, backgroundColor: theme.bg, overflow: 'hidden' }}>

      {/* Atmospheric overlay (indoor fluorescent, underwater depth) */}
      {theme.atmosphere && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.atmosphere }]} />
      )}

      {/* === METAL PLATES === */}
      {isT ? (
        <>
          {/* T-joint: base plate (horizontal, full width) */}
          <View style={{
            position: 'absolute',
            left: jointStartX, top: jointY,
            width: jointW, height: theme.plateH,
            backgroundColor: theme.plateBottom,
            borderTopWidth: 3, borderTopColor: theme.jointLineColor,
            borderBottomWidth: 1, borderBottomColor: theme.plateHighlight,
          }} />
          {/* T-joint: top surface of base plate highlight */}
          <View style={{
            position: 'absolute',
            left: jointStartX, top: jointY,
            width: jointW, height: 6,
            backgroundColor: theme.plateHighlight,
            opacity: 0.3,
          }} />
          {/* T-joint: vertical web plate */}
          <View style={{
            position: 'absolute',
            left: jointStartX, top: plateTopY - theme.plateH * 0.5,
            width: jointW, height: theme.plateH * 1.5,
            backgroundColor: theme.plateTop,
            borderBottomWidth: 3, borderBottomColor: theme.jointLineColor,
            borderTopWidth: 1, borderTopColor: theme.plateHighlight,
          }} />
          {/* Web plate surface highlight */}
          <View style={{
            position: 'absolute',
            left: jointStartX, top: plateTopY - theme.plateH * 0.5,
            width: jointW, height: 6,
            backgroundColor: theme.plateHighlight,
            opacity: 0.3,
          }} />
        </>
      ) : (
        <>
          {/* Standard butt joint: top plate */}
          <View style={{
            position: 'absolute',
            left: jointStartX, top: plateTopY,
            width: jointW, height: theme.plateH,
            backgroundColor: theme.plateTop,
            borderBottomWidth: 2, borderBottomColor: theme.jointLineColor,
            borderTopWidth: 1, borderTopColor: theme.plateHighlight,
          }} />
          {/* Top plate surface sheen */}
          <View style={{
            position: 'absolute',
            left: jointStartX, top: plateTopY,
            width: jointW, height: 5,
            backgroundColor: theme.plateHighlight,
            opacity: 0.25,
          }} />
          {/* Bottom plate */}
          <View style={{
            position: 'absolute',
            left: jointStartX, top: jointY,
            width: jointW, height: theme.plateH,
            backgroundColor: theme.plateBottom,
            borderTopWidth: 2, borderTopColor: theme.jointLineColor,
            borderBottomWidth: 1, borderBottomColor: theme.plateHighlight,
          }} />
        </>
      )}

      {/* Joint gap line */}
      <View style={{
        position: 'absolute',
        left: jointStartX, top: jointY - 1,
        width: jointW, height: 2,
        backgroundColor: theme.jointLineColor,
      }} />

      {/* Heat glow (sampled every 4px) */}
      {heatMap.length > 0 && heatMap.map((heat, i) => {
        if (i % 4 !== 0 || heat < 0.08) return null;
        const c = heatToColor(heat);
        return (
          <View key={i} style={{
            position: 'absolute',
            left: jointStartX + i,
            top: isT ? jointY - theme.plateH : plateTopY,
            width: 4,
            height: theme.plateH * 2,
            backgroundColor: `rgba(${c.r},${c.g},${c.b},${Math.min(0.7, heat * 0.9)})`,
          }} />
        );
      })}

      {/* Deposited weld bead */}
      {beadSegments.map((seg, i) => {
        const w = getBeadWidth(amperage, travelSpeed);
        return (
          <View key={i} style={{
            position: 'absolute',
            left: seg.x - 1,
            top: jointY - w / 2,
            width: 2,
            height: w,
            backgroundColor: getBeadColor(seg.heat),
          }} />
        );
      })}

      {/* Arc weld pool glow at joint */}
      {isWelding && torchX > 0 && (
        <View style={{
          position: 'absolute',
          left: rodTipX - poolRadius * 2,
          top: jointY - poolRadius * 2,
          width: poolRadius * 4,
          height: poolRadius * 4,
          borderRadius: poolRadius * 2,
          backgroundColor: arcColor,
          opacity: 0.65,
        }} />
      )}

      {/* === WELDING TOOL (grip at finger position, rod points to joint) === */}
      {torchX > 0 && (
        <>
          {/* Lead cable from grip going upward off-screen */}
          <View style={{
            position: 'absolute',
            left: gripX - 2,
            top: 0,
            width: 4,
            height: gripY - 10,
            backgroundColor: '#0e0e0e',
            borderRadius: 2,
          }} />

          {/* Outer flux / sheath on electrode */}
          <View style={{
            position: 'absolute',
            left: rodCenterX - rodLen / 2,
            top: rodCenterY - 5,
            width: rodLen,
            height: 10,
            backgroundColor: tool.rodOuter,
            borderRadius: 5,
            transform: [{ rotate: `${rodAngleDeg}deg` }],
          }} />

          {/* Inner metal core */}
          <View style={{
            position: 'absolute',
            left: rodCenterX - (rodLen * 0.86) / 2,
            top: rodCenterY - 3,
            width: rodLen * 0.86,
            height: 6,
            backgroundColor: tool.rod,
            borderRadius: 3,
            transform: [{ rotate: `${rodAngleDeg}deg` }],
          }} />

          {/* Grip body — large enough to fully cover finger */}
          <View style={{
            position: 'absolute',
            left: gripX - 24,
            top: gripY - 15,
            width: 48,
            height: 30,
            borderRadius: 7,
            backgroundColor: tool.gripBody,
            borderWidth: 1,
            borderColor: '#3a3a3a',
          }} />
          {/* Jaw clamp divider stripe */}
          <View style={{
            position: 'absolute',
            left: gripX - 24,
            top: gripY - 2,
            width: 48,
            height: 4,
            backgroundColor: tool.gripAccent,
          }} />
          {/* Grip top highlight */}
          <View style={{
            position: 'absolute',
            left: gripX - 20,
            top: gripY - 13,
            width: 40,
            height: 7,
            borderRadius: 4,
            backgroundColor: 'rgba(255,255,255,0.07)',
          }} />

          {/* Electrode tip glow */}
          <View style={{
            position: 'absolute',
            left: rodTipX - 7,
            top: rodTipY - 7,
            width: 14,
            height: 14,
            borderRadius: 7,
            backgroundColor: isWelding ? arcColor : 'rgba(255,210,120,0.25)',
            opacity: isWelding ? 0.9 : 0.35,
          }} />

          {/* Arc spark line (tip to work surface) */}
          {isWelding && (
            <View style={{
              position: 'absolute',
              left: rodTipX - 1,
              top: rodTipY,
              width: 2,
              height: Math.max(0, jointY - rodTipY),
              backgroundColor: arcColor,
              opacity: 0.85,
            }} />
          )}
        </>
      )}

      {/* Underwater bubbles when arc is active */}
      {levelEnvironment === 'underwater' && isWelding && torchX > 0 && (
        <>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={{
              position: 'absolute',
              left: rodTipX - 18 + i * 9 + (i * 5) % 11,
              top: jointY - 8 - i * 18 - (i % 2) * 9,
              width: 3 + (i % 2) * 2,
              height: 3 + (i % 2) * 2,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: 'rgba(80,160,255,0.55)',
              backgroundColor: 'transparent',
            }} />
          ))}
        </>
      )}

      {/* Burn flash overlay */}
      {burnThroughEvent && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,80,0,0.4)' }]} />
      )}
    </View>
  );
}
