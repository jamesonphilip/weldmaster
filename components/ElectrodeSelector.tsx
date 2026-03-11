import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ELECTRODES } from '../data/electrodes';

interface ElectrodeSelectorProps {
  process: string;
  selected: string;
  onSelect: (id: string) => void;
}

export function ElectrodeSelector({ process, selected, onSelect }: ElectrodeSelectorProps) {
  const filtered = ELECTRODES.filter((e) => e.process === process);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ELECTRODE / WIRE</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {filtered.map((el) => (
          <TouchableOpacity
            key={el.id}
            style={[styles.card, selected === el.id && styles.selectedCard]}
            onPress={() => onSelect(el.id)}
          >
            <Text style={styles.cardTitle}>{el.name}</Text>
            <Text style={styles.cardDiam}>{el.diameter}</Text>
            <Text style={styles.cardDesc}>{el.description}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    color: '#888',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  card: {
    width: 130,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectedCard: {
    borderColor: '#FF8C00',
    backgroundColor: '#1f1608',
  },
  cardTitle: {
    color: '#FF8C00',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardDiam: {
    color: '#888',
    fontSize: 11,
    marginBottom: 4,
  },
  cardDesc: {
    color: '#666',
    fontSize: 10,
    lineHeight: 14,
  },
});
