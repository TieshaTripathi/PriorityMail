import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Priority } from '../types';

interface PriorityBadgeProps {
  priority: Priority;
  size?: 'small' | 'medium';
}

const BADGE_CONFIG = {
  urgent: {
    label: 'URGENT',
    bg: '#FEF2F2',
    color: '#DC2626',
    border: '#FECACA',
    dot: '#EF4444',
  },
  high: {
    label: 'ACTION REQUIRED',
    bg: '#FFFBEB',
    color: '#D97706',
    border: '#FDE68A',
    dot: '#F59E0B',
  },
  normal: {
    label: 'NORMAL',
    bg: '#EFF6FF',
    color: '#2563EB',
    border: '#BFDBFE',
    dot: '#3B82F6',
  },
  fyi: {
    label: 'FYI',
    bg: '#F3F4F6',
    color: '#4B5563',
    border: '#E5E7EB',
    dot: '#9CA3AF',
  },
};

export function PriorityBadge({ priority, size = 'medium' }: PriorityBadgeProps) {
  const config = BADGE_CONFIG[priority] || BADGE_CONFIG.normal;
  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: config.bg, borderColor: config.border },
        isSmall && styles.badgeSmall,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.dot }]} />
      <Text style={[styles.text, { color: config.color }, isSmall && styles.textSmall]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  textSmall: {
    fontSize: 10,
    fontWeight: '700',
  },
});
