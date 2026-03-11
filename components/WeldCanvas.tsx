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
}

export function WeldCanvas({
  width,
  height,
  jointY,
  jointStartX,
  jointEndX,
  levelEnvironment,
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

  const bgColor =
    levelEnvironment === 'underwater' ? '#001428' :
    levelEnvironment === 'indoor_drafty' ? '#1a1a1a' :
    levelEnvironment === 'indoor' ? '#111111' : '#0d0d0d';

  const plateH = 50;
  const plateTop = jointY - plateH;
  const rodLen = 80;
  const rodAngle = -30; // degrees, slanted like a real welding rod
  const rodRad = (rodAngle * Math.PI) / 180;
  const rodTipX = torchX;
  const rodTipY = torchY;
  const rodEndX = rodTipX - Math.cos(rodRad) * rodLen;
  const rodEndY = rodTipY - Math.sin(rodRad) * rodLen;

  const arcColor = arcLength > 0.7 ? '#FF3300' : arcLength < 0.25 ? '#FF8800' : '#FFDD00';
  const poolRadius = 6 + amperage / 50;

  return (
    <View style={{ width, height, backgroundColor: bgColor }}>
      {/* Top metal plate */}
      <View style={{
        position: 'absolute',
        left: jointStartX, top: plateTop,
        width: jointEndX - jointStartX, height: plateH,
        backgroundColor: '#3a3a3a',
        borderBottomWidth: 2, borderBottomColor: '#222',
        borderTopWidth: 1, borderTopColor: '#555',
      }} />
      {/* Bottom metal plate */}
      <View style={{
        position: 'absolute',
        left: jointStartX, top: jointY,
        width: jointEndX - jointStartX, height: plateH,
        backgroundColor: '#353535',
        borderTopWidth: 2, borderTopColor: '#222',
        borderBottomWidth: 1, borderBottomColor: '#555',
      }} />
      {/* Joint gap line */}
      <View style={{
        position: 'absolute',
        left: jointStartX, top: jointY - 1,
        width: jointEndX - jointStartX, height: 2,
        backgroundColor: '#111',
      }} />

      {/* Heat glow on metal (sampled every 4px for perf) */}
      {heatMap.length > 0 && heatMap.map((heat, i) => {
        if (i % 4 !== 0 || heat < 0.08) return null;
        const c = heatToColor(heat);
        return (
          <View key={i} style={{
            position: 'absolute',
            left: jointStartX + i,
            top: plateTop,
            width: 4,
            height: plateH * 2,
            backgroundColor: `rgba(${c.r},${c.g},${c.b},${Math.min(0.7, heat * 0.9)})`,
          }} />
        );
      })}

      {/* Deposited bead */}
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

      {/* Arc glow at joint */}
      {isWelding && torchX > 0 && (
        <View style={{
          position: 'absolute',
          left: torchX - poolRadius * 2,
          top: jointY - poolRadius * 2,
          width: poolRadius * 4,
          height: poolRadius * 4,
          borderRadius: poolRadius * 2,
          backgroundColor: arcColor,
          opacity: 0.6,
        }} />
      )}

      {/* Welding rod — drawn as two lines (rod body + electrode tip) */}
      {torchX > 0 && (
        <>
          {/* Rod body */}
          <View style={{
            position: 'absolute',
            left: Math.min(rodTipX, rodEndX),
            top: Math.min(rodTipY, rodEndY),
            width: Math.abs(rodEndX - rodTipX) + 4,
            height: Math.abs(rodEndY - rodTipY) + 4,
            overflow: 'hidden',
          }}>
            {/* Thick rod shaft */}
            <View style={{
              position: 'absolute',
              left: rodTipX > rodEndX ? 0 : rodTipX - Math.min(rodTipX, rodEndX),
              top: rodTipY > rodEndY ? 0 : rodTipY - Math.min(rodTipY, rodEndY),
              width: Math.sqrt(Math.pow(rodEndX - rodTipX, 2) + Math.pow(rodEndY - rodTipY, 2)),
              height: 6,
              backgroundColor: '#C87533',
              borderRadius: 3,
              transform: [{ rotate: `${rodAngle}deg` }],
              transformOrigin: 'left center',
            }} />
          </View>
          {/* Electrode tip glow */}
          <View style={{
            position: 'absolute',
            left: rodTipX - 8,
            top: rodTipY - 8,
            width: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: isWelding ? arcColor : 'rgba(255,200,100,0.3)',
            opacity: isWelding ? 0.9 : 0.4,
          }} />
          {/* Rod grip handle */}
          <View style={{
            position: 'absolute',
            left: rodEndX - 14,
            top: rodEndY - 8,
            width: 28,
            height: 16,
            borderRadius: 4,
            backgroundColor: '#222',
            borderWidth: 1,
            borderColor: '#444',
          }} />
        </>
      )}

      {/* Arc spark line */}
      {isWelding && torchX > 0 && (
        <View style={{
          position: 'absolute',
          left: torchX - 1,
          top: torchY,
          width: 2,
          height: jointY - torchY,
          backgroundColor: arcColor,
          opacity: 0.8,
        }} />
      )}

      {/* Burn flash */}
      {burnThroughEvent && (
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,80,0,0.4)' }]} />
      )}
    </View>
  );
}
