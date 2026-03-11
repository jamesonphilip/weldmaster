import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ScoreBreakdown } from '../systems/scoring';
import { DefectEvent, BeadSegment } from '../store/gameStore';
import { DEFECT_LABELS, DEFECT_TIPS } from '../systems/defectDetector';
import { LevelConfig } from '../data/levels';
import { getBeadColor, getBeadWidth } from '../systems/beadRenderer';

interface ReportCardProps {
  score: ScoreBreakdown;
  defects: DefectEvent[];
  level: LevelConfig;
  beadSegments: BeadSegment[];
  jointStartX: number;
  jointEndX: number;
  amperage: number;
  travelSpeed: number;
  onNext: () => void;
  onRetry: () => void;
}

export function ReportCard({ score, defects, level, beadSegments, jointStartX, jointEndX, amperage, travelSpeed, onNext, onRetry }: ReportCardProps) {
  const passed = score.total >= level.passingScore;

  const gradeColor =
    score.grade.startsWith('A') ? '#00FF88' :
    score.grade.startsWith('B') ? '#88FF00' :
    score.grade.startsWith('C') ? '#FFCC00' :
    score.grade.startsWith('D') ? '#FF8800' : '#FF3300';

  const uniqueDefects = Array.from(new Set(defects.map((d) => d.type)));

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.header}>BEAD REPORT</Text>
      <Text style={styles.levelName}>{level.name}</Text>

      {/* Final weld preview */}
      <WeldPreview
        beadSegments={beadSegments}
        jointStartX={jointStartX}
        jointEndX={jointEndX}
        amperage={amperage}
        travelSpeed={travelSpeed}
      />

      {/* Grade */}
      <View style={styles.gradeBox}>
        <Text style={[styles.grade, { color: gradeColor }]}>{score.grade}</Text>
        <Text style={styles.gradeScore}>{score.total}/100</Text>
        <Text style={[styles.passLabel, { color: passed ? '#00FF88' : '#FF3300' }]}>
          {passed ? '✓ PASSED' : '✗ FAILED'}
        </Text>
      </View>

      {passed && (
        <Text style={styles.unlockMsg}>{level.unlockMessage}</Text>
      )}

      {/* Score breakdown */}
      <View style={styles.breakdown}>
        <Text style={styles.sectionTitle}>SCORE BREAKDOWN</Text>
        <ScoreRow label="Joint Coverage" value={score.coverage} weight={35} />
        <ScoreRow label="Bead Consistency" value={score.consistency} weight={20} />
        <ScoreRow label="Fusion Quality" value={score.fusion} weight={20} />
        <ScoreRow label="Defect Score" value={score.defectPenalty} weight={15} />
        <ScoreRow label="Clean Run" value={score.cleanRun} weight={10} />
      </View>

      {/* Defects */}
      {uniqueDefects.length > 0 && (
        <View style={styles.defectsSection}>
          <Text style={styles.sectionTitle}>DEFECTS FOUND</Text>
          {uniqueDefects.map((dtype) => (
            <View key={dtype} style={styles.defectItem}>
              <Text style={styles.defectName}>{DEFECT_LABELS[dtype]}</Text>
              <Text style={styles.defectTip}>{DEFECT_TIPS[dtype]}</Text>
            </View>
          ))}
        </View>
      )}

      {uniqueDefects.length === 0 && (
        <View style={styles.cleanBox}>
          <Text style={styles.cleanText}>DEFECT-FREE WELD</Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryBtnText}>RETRY</Text>
        </TouchableOpacity>
        {passed && (
          <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
            <Text style={styles.nextBtnText}>NEXT JOB →</Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

function WeldPreview({
  beadSegments,
  jointStartX,
  jointEndX,
  amperage,
  travelSpeed,
}: {
  beadSegments: BeadSegment[];
  jointStartX: number;
  jointEndX: number;
  amperage: number;
  travelSpeed: number;
}) {
  const PREVIEW_W = 320;
  const PREVIEW_H = 64;
  const jointW = jointEndX - jointStartX;
  const scale = PREVIEW_W / jointW;
  const midY = PREVIEW_H / 2;

  return (
    <View style={previewStyles.container}>
      <Text style={previewStyles.label}>YOUR BEAD</Text>
      <View style={previewStyles.canvas}>
        {/* Plate top */}
        <View style={{ position: 'absolute', left: 0, top: 0, right: 0, height: midY - 2, backgroundColor: '#3a3028' }} />
        {/* Plate bottom */}
        <View style={{ position: 'absolute', left: 0, top: midY + 2, right: 0, bottom: 0, backgroundColor: '#2a2018' }} />
        {/* Joint line */}
        <View style={{ position: 'absolute', left: 0, right: 0, top: midY - 1, height: 2, backgroundColor: '#111' }} />
        {/* Bead segments — scaled */}
        {beadSegments.map((seg, i) => {
          const w = getBeadWidth(amperage, travelSpeed);
          const sx = (seg.x - jointStartX) * scale;
          const sw = Math.max(1, 2 * scale);
          const color = `rgba(180,150,100,${0.6 + seg.heat * 0.4})`;
          return (
            <View key={i} style={{
              position: 'absolute',
              left: sx,
              top: midY - w / 2,
              width: sw,
              height: w,
              backgroundColor: color,
            }} />
          );
        })}
      </View>
    </View>
  );
}

const previewStyles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { color: '#444', fontSize: 9, letterSpacing: 2, marginBottom: 6, textAlign: 'center' },
  canvas: {
    height: 64,
    backgroundColor: '#0a0908',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#222',
  },
});

function ScoreRow({ label, value, weight }: { label: string; value: number; weight: number }) {
  const color = value >= 80 ? '#00FF88' : value >= 60 ? '#FFCC00' : '#FF3300';
  return (
    <View style={scoreStyles.row}>
      <Text style={scoreStyles.label}>{label}</Text>
      <View style={scoreStyles.bar}>
        <View style={[scoreStyles.fill, { width: `${value}%`, backgroundColor: color }]} />
      </View>
      <Text style={[scoreStyles.value, { color }]}>{Math.round(value)}</Text>
      <Text style={scoreStyles.weight}>{weight}%</Text>
    </View>
  );
}

const scoreStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 4, gap: 8 },
  label: { color: '#888', fontSize: 11, width: 120 },
  bar: { flex: 1, height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  value: { fontSize: 14, fontWeight: '700', width: 30, textAlign: 'right' },
  weight: { color: '#444', fontSize: 10, width: 25 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0d' },
  content: { padding: 20, paddingBottom: 40 },
  header: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 3, textAlign: 'center', marginBottom: 4 },
  levelName: { color: '#FF8C00', fontSize: 22, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  gradeBox: {
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 16,
  },
  grade: { fontSize: 72, fontWeight: '900', lineHeight: 80 },
  gradeScore: { color: '#666', fontSize: 18, marginTop: 4 },
  passLabel: { fontSize: 14, fontWeight: '700', marginTop: 8, letterSpacing: 2 },
  unlockMsg: { color: '#888', fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
  breakdown: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333', marginBottom: 16 },
  sectionTitle: { color: '#555', fontSize: 10, fontWeight: '700', letterSpacing: 2, marginBottom: 12 },
  defectsSection: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#333', marginBottom: 16 },
  defectItem: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
  defectName: { color: '#FF3300', fontSize: 13, fontWeight: '700', marginBottom: 4 },
  defectTip: { color: '#666', fontSize: 12, lineHeight: 17 },
  cleanBox: { backgroundColor: '#0d2010', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#00FF88', marginBottom: 16, alignItems: 'center' },
  cleanText: { color: '#00FF88', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: 12 },
  retryBtn: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 8, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  retryBtnText: { color: '#888', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  nextBtn: { flex: 2, backgroundColor: '#FF8C00', borderRadius: 8, padding: 16, alignItems: 'center' },
  nextBtnText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
});
