import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { router } from 'expo-router';
import { LEVELS } from '../data/levels';
import { useGameStore } from '../store/gameStore';

const PROCESS_COLORS: Record<string, string> = {
  SMAW: '#FF8C00',
  MIG: '#00AAFF',
  FCAW: '#FF4400',
  TIG: '#AAFFAA',
  WET_SMAW: '#8888FF',
};

const DIFF_LABELS = ['', '★', '★★', '★★★', '★★★★', '★★★★★'];

export default function MainMenu() {
  const completedLevels = useGameStore((s) => s.completedLevels);
  const setCurrentLevel = useGameStore((s) => s.setCurrentLevel);

  const isUnlocked = (index: number) => {
    if (index === 0) return true;
    const prev = LEVELS[index - 1];
    const prevScore = completedLevels[prev.id] ?? 0;
    return prevScore >= prev.passingScore;
  };

  const handleLevelPress = (levelId: string) => {
    setCurrentLevel(levelId);
    router.push({ pathname: '/game/[levelId]', params: { levelId } });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0d0d0d" />
      <View style={styles.header}>
        <Text style={styles.logo}>⚡ BEAD</Text>
        <Text style={styles.logoSub}>RUNNER</Text>
        <Text style={styles.tagline}>JOB BOARD</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Clipboard header */}
        <View style={styles.clipboard}>
          <View style={styles.clipboardClip} />
          <Text style={styles.clipboardTitle}>AVAILABLE JOBS</Text>
          <Text style={styles.clipboardSub}>Complete each job to unlock the next</Text>
        </View>

        {LEVELS.map((level, i) => {
          const unlocked = isUnlocked(i);
          const score = completedLevels[level.id];
          const passed = score !== undefined && score >= level.passingScore;
          const processColor = PROCESS_COLORS[level.process] ?? '#888';

          return (
            <TouchableOpacity
              key={level.id}
              style={[styles.card, !unlocked && styles.cardLocked, passed && styles.cardPassed]}
              onPress={() => unlocked && handleLevelPress(level.id)}
              activeOpacity={unlocked ? 0.7 : 1}
            >
              {/* Card number */}
              <View style={styles.cardNum}>
                <Text style={styles.cardNumText}>{String(i + 1).padStart(2, '0')}</Text>
              </View>

              <View style={styles.cardBody}>
                <View style={styles.cardTop}>
                  <Text style={[styles.cardName, !unlocked && styles.lockedText]}>
                    {level.name}
                  </Text>
                  {passed && <Text style={styles.passedBadge}>✓</Text>}
                  {!unlocked && <Text style={styles.lockIcon}>🔒</Text>}
                </View>

                <View style={styles.cardMeta}>
                  <View style={[styles.processBadge, { borderColor: processColor }]}>
                    <Text style={[styles.processText, { color: processColor }]}>{level.process}</Text>
                  </View>
                  <Text style={styles.metalText}>{level.metal.replace(/_/g, ' ').toUpperCase()}</Text>
                  <Text style={styles.diffText}>{DIFF_LABELS[level.difficulty]}</Text>
                </View>

                <Text style={[styles.cardDesc, !unlocked && styles.lockedText]}>
                  {level.description}
                </Text>

                {score !== undefined && (
                  <Text style={[styles.scoreText, { color: passed ? '#00FF88' : '#FF8800' }]}>
                    Best: {score}/100 {passed ? '✓' : `(need ${level.passingScore})`}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        <View style={styles.footer}>
          <Text style={styles.footerText}>MORE JOBS COMING SOON</Text>
        </View>

        {/* About */}
        <View style={styles.about}>
          <Text style={styles.aboutTitle}>ABOUT BEAD RUNNER</Text>
          <Text style={styles.aboutBody}>
            A welding simulation game that teaches real technique — arc length, travel speed, amperage, and defect recognition modeled after actual welding physics.
          </Text>
          <Text style={styles.aboutMeta}>
            Built by Jameson Philip · v1.0
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0d0d0d' },
  header: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  logo: { color: '#FF8C00', fontSize: 36, fontWeight: '900', letterSpacing: 4 },
  logoSub: { color: '#FF8C00', fontSize: 14, fontWeight: '700', letterSpacing: 8, marginTop: -4 },
  tagline: { color: '#333', fontSize: 10, letterSpacing: 4, marginTop: 8 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  clipboard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    alignItems: 'center',
  },
  clipboardClip: {
    width: 40,
    height: 12,
    backgroundColor: '#333',
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#444',
  },
  clipboardTitle: { color: '#FF8C00', fontSize: 16, fontWeight: '700', letterSpacing: 3 },
  clipboardSub: { color: '#555', fontSize: 11, marginTop: 4 },
  card: {
    backgroundColor: '#141414',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  cardLocked: { opacity: 0.5 },
  cardPassed: { borderColor: '#1a3a1a' },
  cardNum: {
    width: 44,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#2a2a2a',
  },
  cardNumText: { color: '#555', fontSize: 16, fontWeight: '700' },
  cardBody: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  cardName: { color: '#DDD', fontSize: 17, fontWeight: '700', flex: 1 },
  lockedText: { color: '#444' },
  passedBadge: { color: '#00FF88', fontSize: 16 },
  lockIcon: { fontSize: 14 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  processBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  processText: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  metalText: { color: '#888', fontSize: 10, flex: 1 },
  diffText: { color: '#FF8C00', fontSize: 10 },
  cardDesc: { color: '#bbb', fontSize: 13, lineHeight: 18 },
  scoreText: { fontSize: 11, fontWeight: '700', marginTop: 6 },
  footer: { alignItems: 'center', marginTop: 8 },
  footerText: { color: '#2a2a2a', fontSize: 10, letterSpacing: 3 },
  about: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
    alignItems: 'center',
    gap: 8,
  },
  aboutTitle: { color: '#2a2a2a', fontSize: 9, fontWeight: '700', letterSpacing: 3 },
  aboutBody: { color: '#333', fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 16 },
  aboutMeta: { color: '#2a2a2a', fontSize: 10, marginTop: 4 },
});
