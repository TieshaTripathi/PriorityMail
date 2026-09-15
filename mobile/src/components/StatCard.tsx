import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';

interface StatCardProps {
  title: string;
  count: number;
  icon: string;
  color: string;
  isActive: boolean;
  onPress: () => void;
}

export function StatCard({ title, count, icon, color, isActive, onPress }: StatCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        isActive && { borderColor: color, backgroundColor: '#FFFFFF' },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>
        <Text style={[styles.count, { color: isActive ? color : '#111827' }]}>{count}</Text>
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {isActive && <View style={[styles.activeIndicator, { backgroundColor: color }]} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: {
    fontSize: 14,
  },
  count: {
    fontSize: 20,
    fontWeight: '800',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
