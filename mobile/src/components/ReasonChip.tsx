import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ReasonChipProps {
  label: string;
  variant?: 'reason' | 'category' | 'deadline';
}

export function ReasonChip({ label, variant = 'reason' }: ReasonChipProps) {
  let icon = '•';
  const lower = label.toLowerCase();

  if (variant === 'deadline' || lower.includes('deadline') || lower.includes('tomorrow') || lower.includes('closes')) {
    icon = '⏳';
  } else if (lower.includes('vip')) {
    icon = '⭐';
  } else if (lower.includes('interview')) {
    icon = '🎯';
  } else if (lower.includes('internship') || lower.includes('work')) {
    icon = '💼';
  } else if (lower.includes('college') || lower.includes('academic') || lower.includes('professor')) {
    icon = '🎓';
  } else if (lower.includes('action') || lower.includes('confirm') || lower.includes('rsvp') || lower.includes('review')) {
    icon = '⚡';
  }

  const isDeadline = variant === 'deadline';
  const isCategory = variant === 'category';

  return (
    <View
      style={[
        styles.chip,
        isDeadline && styles.deadlineChip,
        isCategory && styles.categoryChip,
      ]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <Text
        style={[
          styles.text,
          isDeadline && styles.deadlineText,
          isCategory && styles.categoryText,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 6,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  deadlineChip: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  categoryChip: {
    backgroundColor: '#EEF2FF',
    borderColor: '#E0E7FF',
  },
  icon: {
    fontSize: 11,
    marginRight: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  deadlineText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  categoryText: {
    color: '#4338CA',
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
