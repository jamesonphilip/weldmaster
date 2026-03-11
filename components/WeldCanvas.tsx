import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useGameStore } from '../store/gameStore';
import { getBeadColor, getBeadWidth } from '../systems/beadRenderer';
import { heatToColor } from '../systems/heatSimulation';
import type { BeadSegment } from '../store/gameStore';

interface WeldCanvasProps {
  width: number;
  height: number;
  jointY: number;
  jointStartX: number;
  jointEndX: number;
  levelEnvironment: string;
  jointType: string;
  process: string;
  /** If provided, renders static bead (report card / brushing preview) */
  staticBeads?: BeadSegment[];
  /** Show brushed/polished bead state */
  polished?: boolean;
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
    default:
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

function getToolColors(process: string) {
  switch (process) {
    case 'MIG':
    case 'FCAW':
      return { gripBody: '#1e3424', gripAccent: '#162a1c', rod: '#c8c890', rodOuter: '#989860' };
    case 'TIG':
      return { gripBody: '#1c1c32', gripAccent: '#141428', rod: '#aaaacc', rodOuter: '#888888' };
    case 'WET_SMAW':
      return { gripBody: '#0e2030', gripAccent: '#081828', rod: '#c87533', rodOuter: '#7a4515' };
    default:
      return { gripBody: '#262626', gripAccent: '#181818', rod: '#c87533', rodOuter: '#7a4010' };
  }
}

// Spark particle angles (degrees) around the arc tip
const SPARK_ANGLES_RAD = [0, 40, 80, 130, 170, 210, 260, 310].map((d) => (d * Math.PI) / 180);
const SPARK_DIST = 28;

function SparkParticles({ x, y, color }: { x: number; y: number; color: string }) {
  const anims = useRef(SPARK_ANGLES_RAD.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const loops = anims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 60),
          Animated.timing(anim, { toValue: 1, duration: 280 + (i % 3) * 60, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);

  return (
    <>
      {anims.map((anim, i) => {
        const dx = Math.cos(SPARK_ANGLES_RAD[i]) * SPARK_DIST;
        const dy = Math.sin(SPARK_ANGLES_RAD[i]) * SPARK_DIST;
        const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
        const opacity = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0.9, 0.7, 0] });
        const scale = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1.2, 0.8, 0.3] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: x - 3,
              top: y - 3,
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i % 2 === 0 ? color : '#FFFFFF',
              opacity,
              transform: [{ translateX }, { translateY }, { scale }],
            }}
          />
        );
      })}
    </>
  );
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
  staticBeads,
  polished = false,
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

  // Arc glow: green = ideal, red = too far, orange = too close
  const isGoodArc = arcLength >= 0.25 && arcLength <= 0.75;
  const arcColor = arcLength > 0.7 ? '#FF3300' : arcLength < 0.25 ? '#FF8800' : '#00FF88';
  const poolRadius = 6 + amperage / 50;

  // Weld quality signal (for pool size/brightness)
  const isGoodSpeed = travelSpeed > 2 && travelSpeed < 200;
  const qualityGlow = isGoodArc && isGoodSpeed ? 1.4 : 0.7;

  // --- Rod geometry: exits from TOP of handle at 30° lean ---
  const ROD_LEN = 80;
  const ANGLE_RAD = (30 * Math.PI) / 180;
  const gripX = torchX;
  const gripY = torchY;
  const HANDLE_HALF_H = 63; // half of 126px handle
  const rodBaseX = gripX;
  const rodBaseY = gripY - HANDLE_HALF_H; // top of handle
  const rodTipX = rodBaseX + ROD_LEN * Math.sin(ANGLE_RAD);
  const rodTipY = rodBaseY - ROD_LEN * Math.cos(ANGLE_RAD);

  const rdx = rodTipX - rodBaseX;
  const rdy = rodTipY - rodBaseY;
  const rodLen = Math.sqrt(rdx * rdx + rdy * rdy);
  const rodAngleDeg = Math.atan2(rdy, rdx) * 180 / Math.PI;
  const rodCenterX = (rodBaseX + rodTipX) / 2;
  const rodCenterY = (rodBaseY + rodTipY) / 2;

  // Arc spark drops from rod tip to joint surface
  const arcGapH = Math.max(0, jointY - rodTipY);

  // Use static beads for report/brushing view, live beads for gameplay
  const displayBeads = staticBeads ?? beadSegments;

  return (
    <View style={{ width, height, backgroundColor: theme.bg, overflow: 'hidden' }}>

      {/* Atmospheric overlay */}
      {theme.atmosphere && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: theme.atmosphere }]} />
      )}

      {/* === METAL PLATES === */}
      {isT ? (
        <>
          <View style={{
            position: 'absolute',
            left: jointStartX, top: jointY,
            width: jointW, height: theme.plateH,
            backgroundColor: theme.plateBottom,
            borderTopWidth: 3, borderTopColor: theme.jointLineColor,
            borderBottomWidth: 1, borderBottomColor: theme.plateHighlight,
          }} />
          <View style={{
            position: 'absolute',
            left: jointStartX, top: jointY,
            width: jointW, height: 6,
            backgroundColor: theme.plateHighlight, opacity: 0.3,
          }} />
          <View style={{
            position: 'absolute',
            left: jointStartX, top: plateTopY - theme.plateH * 0.5,
            width: jointW, height: theme.plateH * 1.5,
            backgroundColor: theme.plateTop,
            borderBottomWidth: 3, borderBottomColor: theme.jointLineColor,
            borderTopWidth: 1, borderTopColor: theme.plateHighlight,
          }} />
          <View style={{
            position: 'absolute',
            left: jointStartX, top: plateTopY - theme.plateH * 0.5,
            width: jointW, height: 6,
            backgroundColor: theme.plateHighlight, opacity: 0.3,
          }} />
        </>
      ) : (
        <>
          <View style={{
            position: 'absolute',
            left: jointStartX, top: plateTopY,
            width: jointW, height: theme.plateH,
            backgroundColor: theme.plateTop,
            borderBottomWidth: 2, borderBottomColor: theme.jointLineColor,
            borderTopWidth: 1, borderTopColor: theme.plateHighlight,
          }} />
          <View style={{
            position: 'absolute',
            left: jointStartX, top: plateTopY,
            width: jointW, height: 5,
            backgroundColor: theme.plateHighlight, opacity: 0.25,
          }} />
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
      {displayBeads.map((seg, i) => {
        const w = getBeadWidth(amperage, travelSpeed);
        // Polished beads get a shiny silver-grey look, otherwise heat-based color
        const color = polished
          ? `rgba(160,155,145,${0.7 + seg.heat * 0.3})`
          : getBeadColor(seg.heat);
        // Good arc/speed = wider brighter bead; bad = thin dark
        return (
          <View key={i} style={{
            position: 'absolute',
            left: seg.x - 1,
            top: jointY - w / 2,
            width: 2,
            height: w,
            backgroundColor: color,
          }} />
        );
      })}

      {/* Arc weld pool glow at joint — scales with quality */}
      {isWelding && torchX > 0 && (
        <View style={{
          position: 'absolute',
          left: torchX - poolRadius * 2 * qualityGlow,
          top: jointY - poolRadius * 2 * qualityGlow,
          width: poolRadius * 4 * qualityGlow,
          height: poolRadius * 4 * qualityGlow,
          borderRadius: poolRadius * 2 * qualityGlow,
          backgroundColor: arcColor,
          opacity: isGoodArc ? 0.75 : 0.45,
        }} />
      )}


      {/* === WELDING ROD === */}
      {torchX > 0 && (
        <>
          {/* Rod shaft — rotated 30° */}
          <View style={{
            position: 'absolute',
            left: rodCenterX - rodLen / 2,
            top: rodCenterY - 4,
            width: rodLen,
            height: 8,
            backgroundColor: tool.rod,
            borderRadius: 4,
            transform: [{ rotate: `${rodAngleDeg}deg` }],
          }} />

          {/* Taper tip cap */}
          <View style={{
            position: 'absolute',
            left: rodTipX - 4,
            top: rodTipY - 4,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: tool.rodOuter,
          }} />

          {/* Grip handle — 3x taller portrait bar */}
          <View style={{
            position: 'absolute',
            left: gripX - 14,
            top: gripY - 63,
            width: 28,
            height: 126,
            borderRadius: 12,
            backgroundColor: tool.gripBody,
            borderWidth: 1,
            borderColor: '#555',
          }} />
          {/* Knurl ridges (10 ridges across full grip) */}
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
            <View key={i} style={{
              position: 'absolute',
              left: gripX - 10,
              top: gripY - 57 + i * 12,
              width: 20,
              height: 2,
              borderRadius: 1,
              backgroundColor: 'rgba(255,255,255,0.10)',
            }} />
          ))}

          {/* Tip glow */}
          <View style={{
            position: 'absolute',
            left: rodTipX - 6,
            top: rodTipY - 6,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: isWelding ? arcColor : 'rgba(255,220,80,0.4)',
            opacity: isWelding ? 1.0 : 0.5,
          }} />


          {/* Arc spark column from tip to joint */}
          {isWelding && arcGapH > 0 && (
            <View style={{
              position: 'absolute',
              left: rodTipX - 1,
              top: rodTipY,
              width: 2,
              height: arcGapH,
              backgroundColor: arcColor,
              opacity: 0.85,
            }} />
          )}

          {/* Spark particles bursting from tip */}
          {isWelding && (
            <SparkParticles x={rodTipX} y={rodTipY} color={arcColor} />
          )}
        </>
      )}

      {/* Underwater bubbles */}
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
