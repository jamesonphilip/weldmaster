import React, { useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import { BeadSegment } from '../store/gameStore';
import { getBeadColor, getBeadWidth } from '../systems/beadRenderer';

interface BrushingCanvasProps {
  width: number;
  height: number;
  jointY: number;
  jointStartX: number;
  jointEndX: number;
  beadSegments: BeadSegment[];
  amperage: number;
  travelSpeed: number;
  onComplete: () => void;
}

const BRUSH_W = 60;
const BUCKET_PX = 12; // coverage resolution

export function BrushingCanvas({
  width,
  height,
  jointY,
  jointStartX,
  jointEndX,
  beadSegments,
  amperage,
  travelSpeed,
  onComplete,
}: BrushingCanvasProps) {
  const jointW = jointEndX - jointStartX;
  const bucketCount = Math.ceil(jointW / BUCKET_PX);
  const coveredRef = useRef<boolean[]>(new Array(bucketCount).fill(false));
  const [coverPct, setCoverPct] = useState(0);
  const [brushX, setBrushX] = useState(-200);
  const [done, setDone] = useState(false);
  const completeCalledRef = useRef(false);

  const markCovered = useCallback((x: number) => {
    const left = x - BRUSH_W / 2;
    const right = x + BRUSH_W / 2;
    let changed = false;
    for (let i = 0; i < bucketCount; i++) {
      const bx = jointStartX + i * BUCKET_PX;
      if (bx >= left && bx <= right && !coveredRef.current[i]) {
        coveredRef.current[i] = true;
        changed = true;
      }
    }
    if (changed) {
      const pct = coveredRef.current.filter(Boolean).length / bucketCount;
      setCoverPct(pct);
      if (pct >= 0.85 && !completeCalledRef.current) {
        completeCalledRef.current = true;
        setDone(true);
        setTimeout(onComplete, 800);
      }
    }
  }, [bucketCount, jointStartX, onComplete]);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onStart((e) => {
      setBrushX(e.x);
      markCovered(e.x);
    })
    .onUpdate((e) => {
      setBrushX(e.x);
      markCovered(e.x);
    })
    .onEnd(() => {
      setBrushX(-200);
    });

  const plateH = 40;
  const plateTopY = jointY - plateH;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={{ width, height, backgroundColor: '#0a0908', overflow: 'hidden' }}>

        {/* Top plate */}
        <View style={{
          position: 'absolute',
          left: jointStartX, top: plateTopY,
          width: jointW, height: plateH,
          backgroundColor: '#4a3a2a',
          borderBottomWidth: 2, borderBottomColor: '#111',
        }} />

        {/* Bottom plate */}
        <View style={{
          position: 'absolute',
          left: jointStartX, top: jointY,
          width: jointW, height: plateH,
          backgroundColor: '#3a2a1c',
          borderTopWidth: 2, borderTopColor: '#111',
        }} />

        {/* Weld bead — slag layer (dark crusty on top of bead) */}
        {beadSegments.map((seg, i) => {
          const w = getBeadWidth(amperage, travelSpeed);
          const bucket = Math.floor((seg.x - jointStartX) / BUCKET_PX);
          const isBrushed = coveredRef.current[Math.max(0, Math.min(bucket, bucketCount - 1))];
          return (
            <View key={i}>
              {/* Bead underneath */}
              <View style={{
                position: 'absolute',
                left: seg.x - 1,
                top: jointY - w / 2,
                width: 2,
                height: w,
                backgroundColor: isBrushed
                  ? `rgba(180,160,120,${0.7 + seg.heat * 0.3})`
                  : getBeadColor(seg.heat),
              }} />
              {/* Slag crust on top — dark brown flecks */}
              {!isBrushed && (
                <View style={{
                  position: 'absolute',
                  left: seg.x - 2,
                  top: jointY - w / 2 - 1,
                  width: 4,
                  height: w + 2,
                  backgroundColor: `rgba(40,20,5,${0.5 + (i % 3) * 0.15})`,
                }} />
              )}
            </View>
          );
        })}

        {/* Coverage progress bar */}
        <View style={{
          position: 'absolute',
          bottom: 4,
          left: jointStartX,
          width: jointW,
          height: 4,
          backgroundColor: '#1a1a1a',
          borderRadius: 2,
        }}>
          <View style={{
            width: `${coverPct * 100}%`,
            height: '100%',
            backgroundColor: done ? '#00FF88' : '#FF8C00',
            borderRadius: 2,
          }} />
        </View>

        {/* Brush tool — follows finger */}
        {brushX > 0 && (
          <View style={{
            position: 'absolute',
            left: brushX - BRUSH_W / 2,
            top: jointY - 20,
            width: BRUSH_W,
            height: 40,
          }}>
            {/* Handle */}
            <View style={{
              position: 'absolute',
              left: BRUSH_W / 2 - 6,
              top: -50,
              width: 12,
              height: 55,
              backgroundColor: '#8B4513',
              borderRadius: 4,
            }} />
            {/* Bristles */}
            {Array.from({ length: 12 }).map((_, i) => (
              <View key={i} style={{
                position: 'absolute',
                left: i * 5,
                top: 0,
                width: 3,
                height: 36,
                backgroundColor: i % 2 === 0 ? '#C8A878' : '#D4B088',
                borderRadius: 2,
              }} />
            ))}
          </View>
        )}

        {/* Done flash */}
        {done && (
          <View style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(0,255,136,0.15)' },
          ]} />
        )}

        {/* Instructions */}
        <Text style={{
          position: 'absolute',
          top: 8,
          alignSelf: 'center',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: '#888',
          fontSize: 11,
          letterSpacing: 1,
        }}>
          {done ? 'CLEAN WELD ✓' : 'WIRE BRUSH THE SLAG — SWIPE ALONG THE WELD'}
        </Text>
      </View>
    </GestureDetector>
  );
}
