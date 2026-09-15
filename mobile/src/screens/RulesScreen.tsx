import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  Alert,
  StatusBar,
} from 'react-native';
import { PriorityRule } from '../types';
import { defaultMockRules } from '../services/mockData';
import { StorageService } from '../services/storage';
import { RuleCard } from '../components/RuleCard';
import { AddRuleModal } from '../components/AddRuleModal';
import { EmptyState } from '../components/EmptyState';

export function RulesScreen() {
  const [rules, setRules] = useState<PriorityRule[]>([]);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const loaded = await StorageService.getRules(defaultMockRules);
    setRules(loaded);
  };

  const handleToggleRule = async (id: string, enabled: boolean) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled } : r));
    setRules(updated);
    await StorageService.saveRules(updated);
  };

  const handleDeleteRule = (id: string, value: string) => {
    Alert.alert(
      'Delete Rule',
      `Are you sure you want to remove rule "${value}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = rules.filter((r) => r.id !== id);
            setRules(updated);
            await StorageService.saveRules(updated);
          },
        },
      ]
    );
  };

  const handleAddRule = async (newRuleData: Omit<PriorityRule, 'id'>) => {
    const newRule: PriorityRule = {
      ...newRuleData,
      id: `rule-${Date.now()}`,
    };

    const updated = [newRule, ...rules];
    setRules(updated);
    await StorageService.saveRules(updated);
  };

  const activeCount = rules.filter((r) => r.enabled).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Priority Rules</Text>
            <Text style={styles.subtitle}>
              Customize patterns to immediately flag high-priority emails
            </Text>
          </View>
          <Pressable
            style={styles.addButton}
            onPress={() => setIsAddModalVisible(true)}
            hitSlop={6}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Add Rule</Text>
          </Pressable>
        </View>

        {/* Info Tip Banner */}
        <View style={styles.tipBanner}>
          <Text style={styles.tipIcon}>💡</Text>
          <Text style={styles.tipText}>
            PriorityMail evaluates matching rules with weighted scores (e.g. +5 pts for
            deadlines). {activeCount} of {rules.length} rules active.
          </Text>
        </View>
      </View>

      {/* Rules List */}
      <FlatList
        contentContainerStyle={styles.listContent}
        data={rules}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RuleCard
            rule={item}
            onToggle={(enabled) => handleToggleRule(item.id, enabled)}
            onDelete={() => handleDeleteRule(item.id, item.value)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📋"
            title="No rules created"
            subtitle="Add custom keyword, domain, or sender rules to train your inbox."
            actionLabel="Create First Rule"
            onAction={() => setIsAddModalVisible(true)}
          />
        }
      />

      {/* Add Rule Sheet */}
      <AddRuleModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onAddRule={handleAddRule}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
    maxWidth: 220,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
    gap: 4,
  },
  addButtonIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  tipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  tipIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#1E40AF',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
});
