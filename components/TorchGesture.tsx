import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { useGameStore } from '../store/gameStore';

interface TorchGestureProps {
  children: React.ReactNode;
  jointY: number;
  jointStartX: number;
  jointEndX: number;
  onWeldTick: (x: number, y: number, speed: number, arcLen: number) => void;
  enabled: boolean;
}

export function TorchGesture({
  children,
  jointY,
  jointStartX,
  jointEndX,
  onWeldTick,
  enabled,
}: TorchGestureProps) {
  const setTorchPosition = useGameStore((s) => s.setTorchPosition);
  const setArcLength = useGameStore((s) => s.setArcLength);
  const setTravelSpeed = useGameStore((s) => s.setTravelSpeed);
  const isWelding = useGameStore((s) => s.isWelding);

  const lastPos = useRef({ x: 0, y: 0, t: 0 });
  const hapticRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startHaptic = () => {
    if (hapticRef.current) return;
    hapticRef.current = setInterval(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 120);
  };

  const stopHaptic = () => {
    if (hapticRef.current) {
      clearInterval(hapticRef.current);
      hapticRef.current = null;
    }
  };

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onStart((e) => {
      if (!enabled || !isWelding) return;
      lastPos.current = { x: e.x, y: e.y, t: Date.now() };
      setTorchPosition(e.x, e.y);
      startHaptic();
    })
    .onUpdate((e) => {
      if (!enabled || !isWelding) return;
      const now = Date.now();
      const dt = (now - lastPos.current.t) / 1000;
      const dx = e.x - lastPos.current.x;
      const dy = e.y - lastPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = dt > 0 ? dist / dt : 0;

      // Arc length: finger BELOW joint controls arc gap
      // too close = 10px below, ideal = 60px below, too far = 110px below
      const arcLen = Math.max(0, Math.min(1, (e.y - jointY - 10) / 100));

      setTorchPosition(e.x, e.y);
      setArcLength(arcLen);
      setTravelSpeed(speed);

      onWeldTick(e.x, e.y, speed, arcLen);

      lastPos.current = { x: e.x, y: e.y, t: now };
    })
    .onEnd(() => {
      stopHaptic();
      setTravelSpeed(0);
    });

  return (
    <GestureDetector gesture={panGesture}>
      <View style={StyleSheet.absoluteFill}>
        {children}
      </View>
    </GestureDetector>
  );
}
