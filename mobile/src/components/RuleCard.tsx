import React from 'react';
import { View, Text, Switch, Pressable, StyleSheet } from 'react-native';
import { PriorityRule } from '../types';

interface RuleCardProps {
  rule: PriorityRule;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  label: { label: 'LABEL', color: '#4338CA', bg: '#EEF2FF' },
  sender: { label: 'SENDER', color: '#047857', bg: '#D1FAE5' },
  domain: { label: 'DOMAIN', color: '#B45309', bg: '#FEF3C7' },
  keyword: { label: 'KEYWORD', color: '#6D28D9', bg: '#EDE9FE' },
  subject_keyword: { label: 'SUBJECT', color: '#BE185D', bg: '#FCE7F3' },
  vip: { label: 'VIP RULE', color: '#C2410C', bg: '#FFEDD5' },
};

export function RuleCard({ rule, onToggle, onDelete }: RuleCardProps) {
  const typeMeta = TYPE_LABELS[rule.type] || { label: rule.type.toUpperCase(), color: '#4B5563', bg: '#F3F4F6' };

  return (
    <View style={[styles.card, !rule.enabled && styles.cardDisabled]}>
      <View style={styles.leftContent}>
        <View style={styles.headerRow}>
          <View style={[styles.typeBadge, { backgroundColor: typeMeta.bg }]}>
            <Text style={[styles.typeText, { color: typeMeta.color }]}>{typeMeta.label}</Text>
          </View>
          {rule.weight ? (
            <View style={styles.weightBadge}>
              <Text style={styles.weightText}>
                {rule.weight > 0 ? `+${rule.weight}` : rule.weight} pts
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.value, !rule.enabled && styles.valueDisabled]} numberOfLines={1}>
          {rule.value}
        </Text>

        {rule.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {rule.description}
          </Text>
        ) : null}
      </View>

      <View style={styles.rightActions}>
        <Switch
          value={rule.enabled}
          onValueChange={onToggle}
          trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
          thumbColor={rule.enabled ? '#2563EB' : '#F4F3F4'}
        />
        <Pressable onPress={onDelete} style={styles.deleteButton} hitSlop={8}>
          <Text style={styles.deleteIcon}>🗑️</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  cardDisabled: {
    opacity: 0.6,
    backgroundColor: '#F9FAFB',
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  typeBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    marginRight: 6,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  weightBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
  },
  weightText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  valueDisabled: {
    color: '#9CA3AF',
  },
  description: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  rightActions: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteButton: {
    padding: 4,
    marginTop: 2,
  },
  deleteIcon: {
    fontSize: 14,
    opacity: 0.7,
  },
});
