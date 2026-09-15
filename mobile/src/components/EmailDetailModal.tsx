import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { PriorityEmail } from '../types';
import { PriorityBadge } from './PriorityBadge';
import { ReasonChip } from './ReasonChip';
import { GmailService } from '../services/gmail';

interface EmailDetailModalProps {
  email: PriorityEmail | null;
  visible: boolean;
  onClose: () => void;
  onMarkDone: (emailId: string) => void;
  onSnoozePress: (email: PriorityEmail) => void;
}

export function EmailDetailModal({
  email,
  visible,
  onClose,
  onMarkDone,
  onSnoozePress,
}: EmailDetailModalProps) {
  if (!email) return null;

  const handleOpenInGmail = async () => {
    const success = await GmailService.openEmailInGmail({
      accountEmail: email.accountEmail,
      threadId: email.gmailThreadId,
      messageId: email.gmailMessageId,
    });
    if (!success) {
      Alert.alert(
        'Open Gmail',
        `Could not open Gmail app directly. Gmail Thread ID: ${email.gmailThreadId}`
      );
    }
  };

  const handleMarkDone = () => {
    onMarkDone(email.id);
    onClose();
  };

  const handleSnooze = () => {
    onSnoozePress(email);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        {/* Navigation Bar */}
        <View style={styles.navbar}>
          <Pressable onPress={onClose} style={styles.closeButton} hitSlop={10}>
            <Text style={styles.closeText}>✕ Close</Text>
          </Pressable>
          <View style={styles.navBadges}>
            <PriorityBadge priority={email.priority} size="small" />
          </View>
        </View>

        {/* Scrollable Content */}
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header Area */}
          <View style={styles.header}>
            <View style={styles.senderRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {email.senderName.slice(0, 1).toUpperCase()}
                </Text>
              </View>
              <View style={styles.senderMeta}>
                <Text style={styles.senderName}>{email.senderName}</Text>
                <Text style={styles.senderEmail}>{email.senderEmail}</Text>
              </View>
              <Text style={styles.receivedAt}>{email.receivedAt}</Text>
            </View>

            <Text style={styles.senderEmail}>Opening with: {email.accountEmail}</Text>
            <Text style={styles.senderEmail}>Demo email: this thread does not exist in Gmail.</Text>

            <Text style={styles.subject}>{email.subject}</Text>

            <View style={styles.metaChipsRow}>
              <ReasonChip label={email.category} variant="category" />
              {email.deadline && (
                <ReasonChip label={`Due: ${email.deadline}`} variant="deadline" />
              )}
            </View>
          </View>

          {/* Deadline Alert Banner (if applicable) */}
          {email.deadline && (
            <View style={styles.deadlineContainer}>
              <Text style={styles.deadlineIcon}>⏰</Text>
              <View style={styles.deadlineMeta}>
                <Text style={styles.deadlineTitle}>Action Deadline</Text>
                <Text style={styles.deadlineDesc}>{email.deadline}</Text>
              </View>
            </View>
          )}

          {/* Why PriorityMail Flagged This */}
          <View style={styles.flaggedBox}>
            <View style={styles.flaggedHeader}>
              <Text style={styles.flaggedSparkle}>✨</Text>
              <Text style={styles.flaggedTitle}>Why PriorityMail Flagged This</Text>
            </View>
            <View style={styles.reasonsGrid}>
              {email.reasons && email.reasons.length > 0 ? (
                email.reasons.map((r, i) => <ReasonChip key={i} label={r} />)
              ) : (
                <ReasonChip label={email.reason} />
              )}
            </View>
          </View>

          {/* Email Body */}
          <View style={styles.bodyContainer}>
            <Text style={styles.bodyText}>
              {email.body || email.snippet}
            </Text>
          </View>

          {/* Thread Metadata */}
          <View style={styles.threadMeta}>
            <Text style={styles.threadMetaText}>
              Gmail Thread ID: {email.gmailThreadId}
            </Text>
            <Text style={styles.threadMetaSub}>
              Protected by PriorityMail local rule engine
            </Text>
          </View>
        </ScrollView>

        {/* Action Bar Footer */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.actionBtn, styles.primaryBtn]}
            onPress={handleOpenInGmail}
          >
            <Text style={styles.primaryBtnIcon}>📨</Text>
            <Text style={styles.primaryBtnText}>Open in Gmail</Text>
          </Pressable>

          <View style={styles.secondaryActions}>
            <Pressable
              style={[styles.actionBtn, styles.secondaryBtn, email.isCompleted && styles.completedBtn]}
              onPress={handleMarkDone}
            >
              <Text style={styles.secondaryBtnText}>
                {email.isCompleted ? '✓ Completed' : 'Mark Done'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, styles.secondaryBtn]}
              onPress={handleSnooze}
            >
              <Text style={styles.secondaryBtnText}>⏰ Snooze</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  closeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4B5563',
  },
  navBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4338CA',
  },
  senderMeta: {
    flex: 1,
  },
  senderName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  senderEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 1,
  },
  receivedAt: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  subject: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
    lineHeight: 28,
    marginBottom: 12,
  },
  metaChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  deadlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 16,
  },
  deadlineIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  deadlineMeta: {
    flex: 1,
  },
  deadlineTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#991B1B',
    textTransform: 'uppercase',
  },
  deadlineDesc: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
    marginTop: 1,
  },
  flaggedBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
  },
  flaggedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  flaggedSparkle: {
    fontSize: 14,
    marginRight: 6,
  },
  flaggedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  bodyContainer: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 20,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
    color: '#374151',
  },
  threadMeta: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    alignItems: 'center',
  },
  threadMetaText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  threadMetaSub: {
    fontSize: 11,
    color: '#D1D5DB',
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  actionBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
  },
  primaryBtnIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },
  completedBtn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
});
