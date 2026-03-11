import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Animated,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LEVELS } from '../../data/levels';
import { METALS } from '../../data/metals';
import { useGameStore } from '../../store/gameStore';
import { WeldCanvas } from '../../components/WeldCanvas';
import { BrushingCanvas } from '../../components/BrushingCanvas';
import { TorchGesture } from '../../components/TorchGesture';
import { AmperageSlider } from '../../components/AmperageSlider';
import { ElectrodeSelector } from '../../components/ElectrodeSelector';
import { ReportCard } from '../../components/ReportCard';
import { initHeatState, updateHeat } from '../../systems/heatSimulation';
import { detectDefects } from '../../systems/defectDetector';
import { calculateScore } from '../../systems/scoring';
import { getBeadWidth } from '../../systems/beadRenderer';
import type { HeatState } from '../../systems/heatSimulation';
import type { ScoreBreakdown } from '../../systems/scoring';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const CANVAS_H = SCREEN_H * 0.45;
const JOINT_Y = CANVAS_H / 2;
const JOINT_PADDING = 40;
const JOINT_START_X = JOINT_PADDING;
const JOINT_END_X = SCREEN_W - JOINT_PADDING;
const JOINT_LENGTH = JOINT_END_X - JOINT_START_X;
// Rod tip is offset from handle center by 30° lean over ROD_LEN=80px
const ROD_TIP_X_OFFSET = Math.round(80 * Math.sin((30 * Math.PI) / 180)); // ~40px

type GamePhase = 'setup' | 'welding' | 'brushing' | 'report';

export default function GameScreen() {
  const { levelId } = useLocalSearchParams<{ levelId: string }>();
  const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[0];
  const metal = METALS[level.metal] ?? METALS.mild_steel_thick;

  const [phase, setPhase] = useState<GamePhase>('setup');
  const [selectedElectrode, setSelectedElectrode] = useState(level.electrode);
  const [score, setScore] = useState<ScoreBreakdown | null>(null);
  const [showTutorial, setShowTutorial] = useState(level.id === 'scrap_yard');
  const flashOpacity = useRef(new Animated.Value(0)).current;

  const heatStateRef = useRef<HeatState>(initHeatState(JOINT_LENGTH));
  const startTimeRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const burnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dwellTimeRef = useRef(0);
  const lastTickPosRef = useRef(0);
  const defectCooldownRef = useRef(0);
  const phaseRef = useRef<GamePhase>('setup');

  const {
    resetWeld,
    addBeadSegment,
    addDefect,
    updateHeat: setHeatMap,
    torchX,
    torchY,
    isWelding,
    arcLength,
    travelSpeed,
    amperage,
    beadSegments,
    defects,
    strikeArc,
    completeLevel,
    setJointProgress,
    setBurnThroughEvent,
    setStickEvent,
    jointProgress,
  } = useGameStore();

  // Keep phaseRef in sync with phase state
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // Reset on mount
  useEffect(() => {
    resetWeld();
    heatStateRef.current = initHeatState(JOINT_LENGTH);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (burnTimerRef.current) clearTimeout(burnTimerRef.current);
      if (stickTimerRef.current) clearTimeout(stickTimerRef.current);
    };
  }, [levelId]);

  const handleWeldComplete = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = null;
    const state = useGameStore.getState();
    const elapsed = Date.now() - startTimeRef.current;
    const expectedMs = (JOINT_LENGTH / 5) * 1000;
    const sc = calculateScore(state.beadSegments, state.defects, level, elapsed, expectedMs);
    setScore(sc);
    completeLevel(level.id, sc.total);
    setPhase('brushing'); // wire brush before report
  }, [level, completeLevel]);

  const handleBrushingComplete = useCallback(() => {
    setPhase('report');
  }, []);

  // Physics tick loop
  useEffect(() => {
    if (phase !== 'welding') {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }

    const DT = 0.05; // 50ms tick = 20fps physics
    tickRef.current = setInterval(() => {
      const store = useGameStore.getState();
      const tx = store.torchX;
      const ty = store.torchY;
      const amp = store.amperage;
      const welding = store.isWelding;
      const arc = store.arcLength;
      const speed = store.travelSpeed;

      // Rod tip X is offset from handle by 30° lean; use it for joint tracking
      const tipX = tx + ROD_TIP_X_OFFSET;
      const jointX = Math.max(0, Math.min(JOINT_LENGTH, tipX - JOINT_START_X));
      const progress = jointX / JOINT_LENGTH;

      // Update heat
      heatStateRef.current = updateHeat(
        heatStateRef.current,
        jointX,
        welding,
        amp,
        metal,
        DT
      );

      // Expose heat array (only update visual when welding to avoid per-tick allocation)
      if (welding) {
        const sampled: number[] = [];
        for (let i = 0; i < JOINT_LENGTH; i++) {
          sampled.push(heatStateRef.current.values[Math.floor(i)] ?? 0);
        }
        setHeatMap(sampled);
      }

      // Dwell time (how long torch stays near same spot)
      const moved = Math.abs(jointX - lastTickPosRef.current);
      if (moved < 3 && welding) {
        dwellTimeRef.current += DT;
      } else {
        dwellTimeRef.current = 0;
        lastTickPosRef.current = jointX;
      }

      const heatAtPos = heatStateRef.current.values[Math.floor(jointX)] ?? 0;

      // Defect detection (rate limited)
      defectCooldownRef.current -= DT;
      if (welding && defectCooldownRef.current <= 0) {
        const defect = detectDefects(
          {
            x: jointX,
            y: ty,
            jointY: JOINT_Y,
            amperage: amp,
            travelSpeed: speed,
            arcLength: arc,
            isWelding: welding,
            dwellTime: dwellTimeRef.current,
            heatAtPosition: heatAtPos,
          },
          level,
          JOINT_LENGTH,
          DT
        );
        if (defect) {
          addDefect(defect);
          defectCooldownRef.current = 0.8; // throttle to every 800ms

          if (defect.type === 'burn_through') {
            setBurnThroughEvent(true);
            Animated.sequence([
              Animated.timing(flashOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
              Animated.timing(flashOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
            ]).start();
            if (burnTimerRef.current) clearTimeout(burnTimerRef.current);
            burnTimerRef.current = setTimeout(() => setBurnThroughEvent(false), 500);
          }
          if (defect.type === 'stick') {
            setStickEvent(true);
            if (stickTimerRef.current) clearTimeout(stickTimerRef.current);
            stickTimerRef.current = setTimeout(() => setStickEvent(false), 800);
          }
        }
      }

      // Deposit bead segment if welding — at rod tip X (not handle X)
      if (welding && moved > 0.5) {
        const w = getBeadWidth(amp, speed);
        const goodArc = arc >= 0.25 && arc <= 0.75;
        const goodSpeed = speed > 2 && speed < 200;
        const quality = (goodArc ? 0.5 : 0) + (goodSpeed ? 0.5 : 0);
        addBeadSegment({
          x: tipX,
          y: JOINT_Y,
          width: w,
          heat: heatAtPos,
          quality,
          timestamp: Date.now(),
          hasDefect: false,
        });
      }

      // Progress
      setJointProgress(progress);

      // Auto-complete when reaching end
      if (progress >= 0.97 && phaseRef.current === 'welding') {
        handleWeldComplete();
      }
    }, 50);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [phase, metal, level, addBeadSegment, addDefect, setHeatMap, setJointProgress, setBurnThroughEvent, setStickEvent, handleWeldComplete, flashOpacity]);

  const handleStrikeArc = useCallback(() => {
    strikeArc();
    startTimeRef.current = Date.now();
    setPhase('welding');
  }, [strikeArc]);

  const handleRetry = useCallback(() => {
    resetWeld();
    heatStateRef.current = initHeatState(JOINT_LENGTH);
    dwellTimeRef.current = 0;
    defectCooldownRef.current = 0;
    setPhase('setup');
    setScore(null);
  }, [resetWeld]);

  const handleNext = useCallback(() => {
    const idx = LEVELS.findIndex((l) => l.id === level.id);
    const next = LEVELS[idx + 1];
    if (next) {
      router.replace({ pathname: '/game/[levelId]', params: { levelId: next.id } });
    } else {
      router.replace('/');
    }
  }, [level]);

  if (phase === 'brushing') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.hud}>
          <View style={styles.hudCenter}>
            <Text style={styles.levelTitle}>WIRE BRUSH</Text>
            <Text style={styles.processLabel}>Clean the slag before inspection</Text>
          </View>
        </View>
        <BrushingCanvas
          width={SCREEN_W}
          height={CANVAS_H}
          jointY={JOINT_Y}
          jointStartX={JOINT_START_X}
          jointEndX={JOINT_END_X}
          beadSegments={beadSegments}
          amperage={amperage}
          travelSpeed={travelSpeed}
          onComplete={handleBrushingComplete}
        />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#333', fontSize: 11 }}>Swipe back and forth to clean the weld</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'report' && score) {
    return (
      <SafeAreaView style={styles.safe}>
        <ReportCard
          score={score}
          defects={defects}
          level={level}
          beadSegments={beadSegments}
          jointStartX={JOINT_START_X}
          jointEndX={JOINT_END_X}
          amperage={amperage}
          travelSpeed={travelSpeed}
          onNext={handleNext}
          onRetry={handleRetry}
        />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />
      <SafeAreaView style={styles.safe}>
        {/* Top HUD */}
        <View style={styles.hud}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>←</Text>
          </TouchableOpacity>
          <View style={styles.hudCenter}>
            <Text style={styles.levelTitle}>{level.name}</Text>
            <Text style={styles.processLabel}>{level.process} · {level.electrode}</Text>
          </View>
          <View style={styles.hudRight}>
            <Text style={styles.ampHud}>{amperage}A</Text>
          </View>
        </View>

        {/* Weld Canvas + Gesture */}
        <View style={styles.canvasContainer}>
          <TorchGesture
            jointY={JOINT_Y}
            jointStartX={JOINT_START_X}
            jointEndX={JOINT_END_X}
            onWeldTick={() => {}}
            enabled={phase === 'welding'}
          >
            <WeldCanvas
              width={SCREEN_W}
              height={CANVAS_H}
              jointY={JOINT_Y}
              jointStartX={JOINT_START_X}
              jointEndX={JOINT_END_X}
              levelEnvironment={level.environment}
              jointType={level.jointType}
              process={level.process}
            />
          </TorchGesture>

          {/* Arc guide — 3 dots: far / ideal / close */}
          {phase === 'welding' && (
            <View style={styles.arcGuide}>
              <View style={[styles.arcDot, { backgroundColor: arcLength > 0.75 ? '#FF3300' : '#1e1e1e' }]} />
              <View style={[styles.arcDotLarge, { backgroundColor: arcLength >= 0.25 && arcLength <= 0.75 ? '#00FF88' : '#1e1e1e' }]} />
              <View style={[styles.arcDot, { backgroundColor: arcLength < 0.25 ? '#FF8800' : '#1e1e1e' }]} />
              <Text style={styles.arcGuideLabel}>ARC</Text>
            </View>
          )}

          {/* Real-time quality badge */}
          {phase === 'welding' && isWelding && (() => {
            const goodArc = arcLength >= 0.25 && arcLength <= 0.75;
            const goodSpeed = travelSpeed > 2 && travelSpeed < 200;
            const quality = goodArc && goodSpeed ? 'GOOD' : !goodArc ? 'ARC!' : 'SPEED!';
            const qColor = quality === 'GOOD' ? '#00FF88' : '#FF8800';
            return (
              <View style={[styles.qualityBadge, { borderColor: qColor }]}>
                <Text style={[styles.qualityText, { color: qColor }]}>{quality}</Text>
              </View>
            );
          })()}

          {/* Progress bar */}
          {phase === 'welding' && (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${jointProgress * 100}%` }]} />
            </View>
          )}

          {/* Burn flash overlay */}
          <Animated.View
            style={[styles.burnFlash, { opacity: flashOpacity }]}
          />
        </View>

        {/* Tutorial overlay */}
        {showTutorial && (
          <View style={styles.tutorialOverlay}>
            <Text style={styles.tutorialTitle}>HOW TO WELD</Text>
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
              <View style={styles.tutorialStep}>
                <Text style={styles.tutorialIcon}>1</Text>
                <View style={styles.tutorialTextCol}>
                  <Text style={styles.tutorialHead}>Set Amperage</Text>
                  <Text style={styles.tutorialBody}>Use the +/− buttons to dial in the correct amperage for the metal. Stay in the green range.</Text>
                </View>
              </View>

              <View style={styles.tutorialStep}>
                <Text style={styles.tutorialIcon}>2</Text>
                <View style={styles.tutorialTextCol}>
                  <Text style={styles.tutorialHead}>Strike the Arc</Text>
                  <Text style={styles.tutorialBody}>Tap STRIKE ARC, then drag the welding rod slowly left to right across the joint.</Text>
                </View>
              </View>

              <View style={styles.tutorialStep}>
                <Text style={styles.tutorialIcon}>3</Text>
                <View style={styles.tutorialTextCol}>
                  <Text style={styles.tutorialHead}>Control Arc Length</Text>
                  <Text style={styles.tutorialBody}>Hold the grip and drag — keep your finger above the joint. Watch the 3 dots on the right: middle green dot = ideal arc.</Text>
                </View>
              </View>

              <View style={styles.tutorialStep}>
                <Text style={styles.tutorialIcon}>4</Text>
                <View style={styles.tutorialTextCol}>
                  <Text style={styles.tutorialHead}>Steady Travel Speed</Text>
                  <Text style={styles.tutorialBody}>Move too fast = cold lap. Too slow = burn-through. Find a smooth, steady pace.</Text>
                </View>
              </View>

              <View style={[styles.tutorialStep, { marginBottom: 8 }]}>
                <Text style={styles.tutorialIcon}>✓</Text>
                <View style={styles.tutorialTextCol}>
                  <Text style={styles.tutorialHead}>What Good Looks Like</Text>
                  <Text style={styles.tutorialBody}>A clean, even orange-to-gold bead running straight across the joint. Uniform width, no gaps, no scorched edges.</Text>
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.tutorialBtn} onPress={() => setShowTutorial(false)}>
              <Text style={styles.tutorialBtnText}>GOT IT — LET'S WELD</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phase: Setup */}
        {phase === 'setup' && !showTutorial && (
          <View style={styles.setupPanel}>
            <AmperageSlider min={level.amperageRange[0]} max={level.amperageRange[1]} />
            <ElectrodeSelector
              process={level.process}
              selected={selectedElectrode}
              onSelect={setSelectedElectrode}
            />
            <View style={styles.setupMeta}>
              <Text style={styles.metaItem}>Joint: {level.jointType.toUpperCase()}</Text>
              <Text style={styles.metaItem}>Gas: {level.shieldingGas}</Text>
              <Text style={styles.metaItem}>Env: {level.environment.replace(/_/g, ' ').toUpperCase()}</Text>
            </View>
            <TouchableOpacity style={styles.strikeBtn} onPress={handleStrikeArc}>
              <Text style={styles.strikeBtnText}>⚡ STRIKE ARC</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Phase: Welding — minimal HUD */}
        {phase === 'welding' && (
          <View style={styles.weldingHud}>
            <View style={styles.defectIndicators}>
              {defects.slice(-3).map((d, i) => (
                <View key={i} style={styles.defectPill}>
                  <Text style={styles.defectPillText}>{d.type.replace(/_/g, ' ').toUpperCase()}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.stopBtn} onPress={handleWeldComplete}>
              <Text style={styles.stopBtnText}>FINISH WELD</Text>
            </TouchableOpacity>
            <Text style={styles.weldInstruct}>
              Drag finger along joint · Height = arc length
            </Text>
          </View>
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d0d0d' },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: { padding: 8 },
  backBtnText: { color: '#FF8C00', fontSize: 20 },
  hudCenter: { flex: 1, alignItems: 'center' },
  levelTitle: { color: '#DDD', fontSize: 14, fontWeight: '700' },
  processLabel: { color: '#555', fontSize: 10, marginTop: 2 },
  hudRight: { width: 50, alignItems: 'flex-end' },
  ampHud: { color: '#FF8C00', fontSize: 14, fontWeight: '700' },
  canvasContainer: {
    width: SCREEN_W,
    height: CANVAS_H,
    position: 'relative',
    backgroundColor: '#0d0d0d',
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  arcGuide: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: [{ translateY: -32 }],
    alignItems: 'center',
    gap: 5,
  },
  arcDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  arcDotLarge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  arcGuideLabel: { color: '#2a2a2a', fontSize: 6, letterSpacing: 1, marginTop: 2 },
  qualityBadge: {
    position: 'absolute',
    left: 10,
    top: '50%',
    transform: [{ translateY: -14 }],
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#0d0d0d',
  },
  qualityText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  progressBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#1a1a1a',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FF8C00',
  },
  burnFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF4400',
    pointerEvents: 'none',
  },
  setupPanel: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  setupMeta: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  metaItem: { color: '#555', fontSize: 10, letterSpacing: 1 },
  strikeBtn: {
    backgroundColor: '#FF8C00',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 'auto',
  },
  strikeBtnText: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 3 },
  weldingHud: {
    flex: 1,
    padding: 16,
    gap: 8,
    alignItems: 'center',
  },
  defectIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  defectPill: {
    backgroundColor: '#3a0000',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#FF3300',
  },
  defectPillText: { color: '#FF3300', fontSize: 9, fontWeight: '700' },
  stopBtn: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 'auto',
  },
  stopBtnText: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  weldInstruct: { color: '#2a2a2a', fontSize: 10, textAlign: 'center' },
  tutorialOverlay: { flex: 1, backgroundColor: '#0d0d0d', padding: 20, gap: 16 },
  tutorialTitle: { color: '#FF8C00', fontSize: 13, fontWeight: '900', letterSpacing: 3, textAlign: 'center', marginBottom: 4 },
  tutorialStep: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  tutorialIcon: { color: '#FF8C00', fontSize: 18, fontWeight: '900', width: 28, textAlign: 'center', marginTop: 1 },
  tutorialTextCol: { flex: 1 },
  tutorialHead: { color: '#DDD', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  tutorialBody: { color: '#888', fontSize: 12, lineHeight: 17 },
  tutorialBtn: { backgroundColor: '#FF8C00', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8 },
  tutorialBtnText: { color: '#000', fontSize: 13, fontWeight: '900', letterSpacing: 2 },
});
