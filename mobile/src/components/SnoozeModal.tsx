import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface SnoozeModalProps {
  visible: boolean;
  emailSubject: string;
  onClose: () => void;
  onSnooze: (optionLabel: string, timestampIso: string) => void;
}

interface SnoozeOption {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  calculateTime: () => Date;
}

export function SnoozeModal({ visible, emailSubject, onClose, onSnooze }: SnoozeModalProps) {
  const [customSelected, setCustomSelected] = useState(false);

  const options: SnoozeOption[] = [
    {
      id: '1h',
      label: 'Later today (1 hour)',
      sublabel: 'Remind me in 60 minutes',
      icon: '⏱️',
      calculateTime: () => new Date(Date.now() + 60 * 60 * 1000),
    },
    {
      id: 'tonight',
      label: 'Tonight (8:00 PM)',
      sublabel: 'Review after dinner',
      icon: '🌙',
      calculateTime: () => {
        const d = new Date();
        d.setHours(20, 0, 0, 0);
        if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
        return d;
      },
    },
    {
      id: 'tomorrow',
      label: 'Tomorrow morning (9:00 AM)',
      sublabel: 'Start of tomorrow’s work block',
      icon: '☀️',
      calculateTime: () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d;
      },
    },
    {
      id: 'weekend',
      label: 'This weekend (Saturday 10 AM)',
      sublabel: 'Catch up on personal tasks',
      icon: '☕',
      calculateTime: () => {
        const d = new Date();
        const day = d.getDay();
        const diff = (6 - day + 7) % 7 || 7;
        d.setDate(d.getDate() + diff);
        d.setHours(10, 0, 0, 0);
        return d;
      },
    },
    {
      id: 'custom',
      label: 'Custom placeholder',
      sublabel: 'Set specific date & time notification',
      icon: '📅',
      calculateTime: () => new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    },
  ];

  const handleSelect = (option: SnoozeOption) => {
    const target = option.calculateTime();
    onSnooze(option.label, target.toISOString());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>Snooze Email</Text>
            <Text style={styles.emailPreview} numberOfLines={1}>
              {emailSubject}
            </Text>
          </View>

          <View style={styles.optionsList}>
            {options.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={styles.optionRow}
                onPress={() => handleSelect(opt)}
                activeOpacity={0.7}
              >
                <View style={styles.optionIconContainer}>
                  <Text style={styles.optionIcon}>{opt.icon}</Text>
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionLabel}>{opt.label}</Text>
                  <Text style={styles.optionSublabel}>{opt.sublabel}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Pressable style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  emailPreview: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  optionsList: {
    gap: 8,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  optionIcon: {
    fontSize: 16,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
  },
  optionSublabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  chevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4B5563',
  },
});
