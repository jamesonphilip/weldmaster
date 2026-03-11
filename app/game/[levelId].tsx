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
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { LEVELS } from '../../data/levels';
import { METALS } from '../../data/metals';
import { useGameStore } from '../../store/gameStore';
import { WeldCanvas } from '../../components/WeldCanvas';
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

type GamePhase = 'setup' | 'welding' | 'completed' | 'report';

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
    const expectedMs = (JOINT_LENGTH / 5) * 1000; // ~5px/sec reference
    const sc = calculateScore(state.beadSegments, state.defects, level, elapsed, expectedMs);
    setScore(sc);
    completeLevel(level.id, sc.total);
    setPhase('report');
  }, [level, completeLevel]);

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

      // Relative torch X on joint
      const jointX = Math.max(0, Math.min(JOINT_LENGTH, tx - JOINT_START_X));
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

      // Deposit bead segment if welding
      if (welding && moved > 0.5) {
        const w = getBeadWidth(amp, speed);
        addBeadSegment({
          x: tx,
          y: JOINT_Y,
          width: w,
          heat: heatAtPos,
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

  const arcLengthIndicatorColor =
    arcLength < 0.25 ? '#FF3300' :
    arcLength > 0.75 ? '#FF8800' :
    '#00FF88';

  if (phase === 'report' && score) {
    return (
      <SafeAreaView style={styles.safe}>
        <ReportCard
          score={score}
          defects={defects}
          level={level}
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

          {/* Arc length indicator bar */}
          {phase === 'welding' && (
            <View style={styles.arcBar}>
              <View style={styles.arcBarTrack}>
                <View
                  style={[
                    styles.arcBarFill,
                    {
                      height: `${arcLength * 100}%`,
                      backgroundColor: arcLengthIndicatorColor,
                    },
                  ]}
                />
                {/* Ideal zone */}
                <View style={styles.arcIdealZone} />
              </View>
              <Text style={styles.arcBarLabel}>ARC</Text>
            </View>
          )}

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
                <Text style={styles.tutorialBody}>Drag slightly ABOVE the joint line for correct arc length. The bar on the right shows your arc — keep it in the green zone.</Text>
              </View>
            </View>

            <View style={styles.tutorialStep}>
              <Text style={styles.tutorialIcon}>4</Text>
              <View style={styles.tutorialTextCol}>
                <Text style={styles.tutorialHead}>Steady Travel Speed</Text>
                <Text style={styles.tutorialBody}>Move too fast = cold lap. Too slow = burn-through. Find a smooth, steady pace.</Text>
              </View>
            </View>

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
  arcBar: {
    position: 'absolute',
    right: 8,
    top: 10,
    bottom: 10,
    width: 20,
    alignItems: 'center',
  },
  arcBarTrack: {
    flex: 1,
    width: 8,
    backgroundColor: '#1a1a1a',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative',
  },
  arcBarFill: {
    width: '100%',
    borderRadius: 4,
  },
  arcIdealZone: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: '35%',
    height: '30%',
    backgroundColor: 'rgba(0,255,100,0.15)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,255,100,0.3)',
  },
  arcBarLabel: { color: '#333', fontSize: 7, marginTop: 4, letterSpacing: 1 },
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
