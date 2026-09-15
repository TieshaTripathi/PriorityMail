import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  RefreshControl,
  StatusBar,
  Pressable,
} from 'react-native';
import { PriorityEmail, Category, PriorityRule, VipPerson, AppSettings } from '../types';
import { initialMockEmails, defaultMockRules, defaultVipPeople, defaultSettings } from '../services/mockData';
import { calculatePriority } from '../engine/priorityEngine';
import { StorageService } from '../services/storage';
import { EmailCard } from '../components/EmailCard';
import { EmptyState } from '../components/EmptyState';
import { EmailDetailModal } from '../components/EmailDetailModal';
import { SnoozeModal } from '../components/SnoozeModal';

const CATEGORIES: { label: string; value: 'all' | Category }[] = [
  { label: 'All', value: 'all' },
  { label: 'Work', value: 'work' },
  { label: 'College', value: 'college' },
  { label: 'Academic', value: 'academic' },
  { label: 'Personal', value: 'personal' },
];

export function AllEmailsScreen() {
  const [emails, setEmails] = useState<PriorityEmail[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<'all' | Category>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyActionRequired, setOnlyActionRequired] = useState(false);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [snoozedEmails, setSnoozedEmails] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [selectedEmail, setSelectedEmail] = useState<PriorityEmail | null>(null);
  const [snoozeTargetEmail, setSnoozeTargetEmail] = useState<PriorityEmail | null>(null);

  const loadData = async () => {
    const loadedRules = await StorageService.getRules(defaultMockRules);
    const loadedVips = await StorageService.getVipPeople(defaultVipPeople);
    const loadedSettings = await StorageService.getSettings(defaultSettings);
    const loadedCompleted = await StorageService.getCompletedEmailIds();
    const loadedSnoozed = await StorageService.getSnoozedEmails();

    setCompletedIds(loadedCompleted);
    setSnoozedEmails(loadedSnoozed);

    const evaluated = initialMockEmails.map((email) => {
      const result = calculatePriority(email, loadedRules, loadedVips, loadedSettings.prioritySensitivity);
      const isCompleted = loadedCompleted.includes(email.id);
      const snoozedUntil = loadedSnoozed[email.id] || null;

      return {
        ...email,
        priority: result.priority,
        actionRequired: result.actionRequired,
        reasons: result.reasons,
        reason: result.reason,
        score: result.score,
        isCompleted,
        snoozedUntil,
      };
    });

    setEmails(evaluated);
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleMarkDone = async (emailId: string) => {
    const nextCompleted = completedIds.includes(emailId)
      ? completedIds.filter((id) => id !== emailId)
      : [...completedIds, emailId];

    setCompletedIds(nextCompleted);
    await StorageService.saveCompletedEmailIds(nextCompleted);

    setEmails((prev) =>
      prev.map((e) => (e.id === emailId ? { ...e, isCompleted: !e.isCompleted } : e))
    );
  };

  const handleConfirmSnooze = async (optionLabel: string, timestampIso: string) => {
    if (!snoozeTargetEmail) return;

    const nextSnoozed = {
      ...snoozedEmails,
      [snoozeTargetEmail.id]: timestampIso,
    };

    setSnoozedEmails(nextSnoozed);
    await StorageService.saveSnoozedEmails(nextSnoozed);

    setEmails((prev) =>
      prev.map((e) =>
        e.id === snoozeTargetEmail.id ? { ...e, snoozedUntil: timestampIso } : e
      )
    );

    setSnoozeTargetEmail(null);
  };

  const filteredEmails = useMemo(() => {
    return emails.filter((email) => {
      if (selectedCategory !== 'all' && email.category !== selectedCategory) {
        return false;
      }
      if (onlyActionRequired && !email.actionRequired) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSender = email.senderName.toLowerCase().includes(q);
        const matchSubject = email.subject.toLowerCase().includes(q);
        const matchSnippet = email.snippet.toLowerCase().includes(q);
        if (!matchSender && !matchSubject && !matchSnippet) return false;
      }
      return true;
    });
  }, [emails, selectedCategory, onlyActionRequired, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>All Emails</Text>
            <Text style={styles.subtitle}>
              Full inbox with PriorityMail classifications
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filteredEmails.length} messages</Text>
          </View>
        </View>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search all emails..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearch}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Category Tabs */}
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <Pressable
                key={cat.value}
                style={[styles.categoryTab, isSelected && styles.categoryTabActive]}
                onPress={() => setSelectedCategory(cat.value)}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    isSelected && styles.categoryTabTextActive,
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Email List */}
      <FlatList
        contentContainerStyle={styles.listContent}
        data={filteredEmails}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <EmailCard
            email={item}
            onPress={() => setSelectedEmail(item)}
            onMarkDone={handleMarkDone}
            onSnooze={(email) => setSnoozeTargetEmail(email)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="📭"
            title="No emails found"
            subtitle="No messages match your selected category or search filters."
            actionLabel="Reset filters"
            onAction={() => {
              setSelectedCategory('all');
              setSearchQuery('');
              setOnlyActionRequired(false);
            }}
          />
        }
      />

      {/* Detail Modal */}
      <EmailDetailModal
        email={selectedEmail}
        visible={Boolean(selectedEmail)}
        onClose={() => setSelectedEmail(null)}
        onMarkDone={handleMarkDone}
        onSnoozePress={(email) => {
          setSelectedEmail(null);
          setSnoozeTargetEmail(email);
        }}
      />

      {/* Snooze Modal */}
      <SnoozeModal
        visible={Boolean(snoozeTargetEmail)}
        emailSubject={snoozeTargetEmail?.subject || ''}
        onClose={() => setSnoozeTargetEmail(null)}
        onSnooze={handleConfirmSnooze}
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
    alignItems: 'flex-start',
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
  },
  countBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },
  clearSearch: {
    fontSize: 14,
    color: '#9CA3AF',
    paddingHorizontal: 4,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 6,
  },
  categoryTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryTabActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  categoryTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
});
