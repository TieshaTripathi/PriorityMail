import React from 'react';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { PriorityEmail } from '../types';
import { PriorityBadge } from './PriorityBadge';
import { ReasonChip } from './ReasonChip';

interface EmailCardProps {
  email: PriorityEmail;
  onPress: () => void;
  onMarkDone: (emailId: string) => void;
  onSnooze: (email: PriorityEmail) => void;
}

export function EmailCard({ email, onPress, onMarkDone, onSnooze }: EmailCardProps) {
  const isCompleted = email.isCompleted;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        isCompleted && styles.cardCompleted,
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
    >
      {/* Top Meta Bar */}
      <View style={styles.topRow}>
        <View style={styles.badgeGroup}>
          <PriorityBadge priority={email.priority} />
          <ReasonChip label={email.category} variant="category" />
        </View>
        <Text style={styles.receivedAt}>{email.receivedAt}</Text>
      </View>

      {/* Sender & Subject */}
      <Text style={[styles.sender, isCompleted && styles.textCompleted]}>
        {email.senderName}
      </Text>
      <Text
        style={[styles.subject, isCompleted && styles.textCompleted]}
        numberOfLines={2}
      >
        {email.subject}
      </Text>

      {/* Snippet */}
      <Text
        style={[styles.snippet, isCompleted && styles.textCompleted]}
        numberOfLines={2}
      >
        {email.snippet}
      </Text>

      {/* Deadline Notice */}
      {email.deadline && !isCompleted && (
        <View style={styles.deadlineContainer}>
          <Text style={styles.deadlineIcon}>⏰</Text>
          <Text style={styles.deadlineText}>Deadline: {email.deadline}</Text>
        </View>
      )}

      {/* Why PriorityMail flagged this */}
      {!isCompleted && (
        <View style={styles.reasonSection}>
          <Text style={styles.reasonHeader}>Why PriorityMail flagged this:</Text>
          <View style={styles.reasonsContainer}>
            {email.reasons && email.reasons.length > 0 ? (
              email.reasons.slice(0, 3).map((r, idx) => (
                <ReasonChip key={idx} label={r} />
              ))
            ) : (
              <ReasonChip label={email.reason} />
            )}
          </View>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <Pressable
          style={[styles.actionBtn, styles.primaryBtn]}
          onPress={onPress}
          hitSlop={4}
        >
          <Text style={styles.primaryBtnText}>Open Email</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.secondaryBtn, isCompleted && styles.activeDoneBtn]}
          onPress={() => onMarkDone(email.id)}
          hitSlop={4}
        >
          <Text style={[styles.secondaryBtnText, isCompleted && styles.activeDoneBtnText]}>
            {isCompleted ? '✓ Done' : 'Mark Done'}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, styles.secondaryBtn]}
          onPress={() => onSnooze(email)}
          hitSlop={4}
        >
          <Text style={styles.secondaryBtnText}>Snooze</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardCompleted: {
    opacity: 0.65,
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  cardPressed: {
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  receivedAt: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  sender: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 2,
  },
  subject: {
    fontSize: 17,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 23,
    marginBottom: 6,
  },
  snippet: {
    fontSize: 13,
    lineHeight: 19,
    color: '#4B5563',
    marginBottom: 10,
  },
  textCompleted: {
    color: '#9CA3AF',
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 10,
    alignSelf: 'flex-start',
  },
  deadlineIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  deadlineText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B91C1C',
  },
  reasonSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  reasonHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reasonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    flex: 1.2,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  secondaryBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
  },
  secondaryBtnText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  activeDoneBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  activeDoneBtnText: {
    color: '#059669',
    fontWeight: '700',
  },
});
