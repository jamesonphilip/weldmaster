import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useGameStore } from '../store/gameStore';

interface AmperageSliderProps {
  min: number;
  max: number;
}

export function AmperageSlider({ min, max }: AmperageSliderProps) {
  const amperage = useGameStore((s) => s.amperage);
  const setAmperage = useGameStore((s) => s.setAmperage);

  const increment = (amount: number) => {
    setAmperage(Math.max(min - 20, Math.min(max + 20, amperage + amount)));
  };

  const pct = ((amperage - min) / (max - min)) * 100;
  const inRange = amperage >= min && amperage <= max;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>AMPERAGE</Text>
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} onPress={() => increment(-10)}>
          <Text style={styles.btnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.trackContainer}>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(0, Math.min(100, pct))}%`,
                  backgroundColor: inRange ? '#FF8C00' : '#FF3300',
                },
              ]}
            />
            {/* Green zone markers */}
            <View style={[styles.marker, { left: '0%' }]} />
            <View style={[styles.marker, { left: '100%' }]} />
          </View>
        </View>
        <TouchableOpacity style={styles.btn} onPress={() => increment(10)}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: inRange ? '#FF8C00' : '#FF3300' }]}>
          {amperage}A
        </Text>
        <Text style={[styles.range, { color: inRange ? '#555' : '#FF3300' }]}>
          {inRange ? `sweet spot: ${min}–${max}A` : amperage < min ? 'TOO LOW — weak fusion' : 'TOO HIGH — burn-through risk'}
        </Text>
      </View>
      <Text style={styles.tip}>
        Start at {Math.round((min + max) / 2)}A · Low = cold weld · High = blow-through
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  label: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btn: {
    width: 36,
    height: 36,
    backgroundColor: '#2a2a2a',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  btnText: {
    color: '#FF8C00',
    fontSize: 20,
    fontWeight: '700',
  },
  trackContainer: {
    flex: 1,
  },
  track: {
    height: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: '100%',
    borderRadius: 6,
  },
  marker: {
    position: 'absolute',
    top: 0,
    width: 2,
    height: '100%',
    backgroundColor: '#555',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 6,
  },
  value: {
    fontSize: 20,
    fontWeight: '700',
  },
  range: {
    fontSize: 11,
  },
  tip: {
    color: '#444',
    fontSize: 10,
    marginTop: 6,
    fontStyle: 'italic',
  },
});
