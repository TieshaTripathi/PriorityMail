import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { PriorityRuleType, PriorityRule } from '../types';

interface AddRuleModalProps {
  visible: boolean;
  onClose: () => void;
  onAddRule: (rule: Omit<PriorityRule, 'id'>) => void;
}

const RULE_TYPES: { type: PriorityRuleType; label: string; placeholder: string; example: string }[] = [
  { type: 'label', label: 'Gmail Label', placeholder: 'e.g. Work, College, Finance', example: 'Label = College' },
  { type: 'sender', label: 'Sender Email', placeholder: 'e.g. recruiter@google.com', example: 'Sender = manager@company.com' },
  { type: 'domain', label: 'Sender Domain', placeholder: 'e.g. sies.edu.in or stanford.edu', example: 'Domain = sies.edu.in' },
  { type: 'keyword', label: 'Keyword', placeholder: 'e.g. deadline, stipend, offer', example: 'Keyword = deadline' },
  { type: 'subject_keyword', label: 'Subject Keyword', placeholder: 'e.g. interview, urgent, final notice', example: 'Subject = interview' },
  { type: 'vip', label: 'VIP Contact Pattern', placeholder: 'e.g. professor, coordinator, mentor', example: 'VIP = Dean Office' },
];

export function AddRuleModal({ visible, onClose, onAddRule }: AddRuleModalProps) {
  const [selectedType, setSelectedType] = useState<PriorityRuleType>('keyword');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [weight, setWeight] = useState<number>(4);
  const [error, setError] = useState('');

  const activeMeta = RULE_TYPES.find((r) => r.type === selectedType) || RULE_TYPES[0];

  const handleSubmit = () => {
    if (!value.trim()) {
      setError('Please enter a rule target value');
      return;
    }

    onAddRule({
      type: selectedType,
      value: value.trim(),
      weight,
      enabled: true,
      description: description.trim() || `Flagged via ${activeMeta.label}`,
    });

    setValue('');
    setDescription('');
    setError('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Create Priority Rule</Text>
          <Text style={styles.subtitle}>
            Teach PriorityMail what deserves immediate attention.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.formScroll}>
            {/* Rule Type Selector */}
            <Text style={styles.label}>Rule Type</Text>
            <View style={styles.typeGrid}>
              {RULE_TYPES.map((t) => (
                <Pressable
                  key={t.type}
                  style={[
                    styles.typeChip,
                    selectedType === t.type && styles.typeChipSelected,
                  ]}
                  onPress={() => {
                    setSelectedType(t.type);
                    setError('');
                  }}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      selectedType === t.type && styles.typeChipTextSelected,
                    ]}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Target Value Input */}
            <Text style={styles.label}>Match Target</Text>
            <TextInput
              style={[styles.input, Boolean(error) && styles.inputError]}
              placeholder={activeMeta.placeholder}
              placeholderTextColor="#9CA3AF"
              value={value}
              onChangeText={(text) => {
                setValue(text);
                if (error) setError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            <Text style={styles.hint}>Example: {activeMeta.example}</Text>

            {/* Optional Description */}
            <Text style={styles.label}>Rule Label / Note (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. My academic advisor emails"
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
            />

            {/* Priority Weight Preset */}
            <Text style={styles.label}>Priority Impact</Text>
            <View style={styles.weightRow}>
              {[
                { label: 'High (+5)', val: 5 },
                { label: 'Standard (+3)', val: 3 },
                { label: 'Filter / Mute (-5)', val: -5 },
              ].map((w) => (
                <Pressable
                  key={w.val}
                  style={[
                    styles.weightBtn,
                    weight === w.val && styles.weightBtnSelected,
                  ]}
                  onPress={() => setWeight(w.val)}
                >
                  <Text
                    style={[
                      styles.weightBtnText,
                      weight === w.val && styles.weightBtnTextSelected,
                    ]}
                  >
                    {w.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.footer}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.saveBtn} onPress={handleSubmit}>
              <Text style={styles.saveBtnText}>Save Rule</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    marginBottom: 16,
  },
  formScroll: {
    maxHeight: 400,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 12,
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  typeChipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  typeChipTextSelected: {
    color: '#4F46E5',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: '#111827',
  },
  inputError: {
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    marginTop: 4,
  },
  hint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  weightRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  weightBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  weightBtnSelected: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  weightBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4B5563',
  },
  weightBtnTextSelected: {
    color: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#4B5563',
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 13,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
});
