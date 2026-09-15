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
import { PriorityEmail, PriorityRule, VipPerson, AppSettings } from '../types';
import { initialMockEmails, defaultMockRules, defaultVipPeople, defaultSettings } from '../services/mockData';
import { calculatePriority } from '../engine/priorityEngine';
import { StorageService } from '../services/storage';
import { EmailCard } from '../components/EmailCard';
import { StatCard } from '../components/StatCard';
import { EmptyState } from '../components/EmptyState';
import { EmailDetailModal } from '../components/EmailDetailModal';
import { SnoozeModal } from '../components/SnoozeModal';

export function InboxScreen() {
  const [emails, setEmails] = useState<PriorityEmail[]>([]);
  const [rules, setRules] = useState<PriorityRule[]>(defaultMockRules);
  const [vipPeople, setVipPeople] = useState<VipPerson[]>(defaultVipPeople);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [snoozedEmails, setSnoozedEmails] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState<'all' | 'attention' | 'urgent' | 'deadlines'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  // Modals state
  const [selectedEmail, setSelectedEmail] = useState<PriorityEmail | null>(null);
  const [snoozeTargetEmail, setSnoozeTargetEmail] = useState<PriorityEmail | null>(null);

  // Load persisted state
  const loadData = async () => {
    const loadedRules = await StorageService.getRules(defaultMockRules);
    const loadedVips = await StorageService.getVipPeople(defaultVipPeople);
    const loadedSettings = await StorageService.getSettings(defaultSettings);
    const loadedCompleted = await StorageService.getCompletedEmailIds();
    const loadedSnoozed = await StorageService.getSnoozedEmails();

    setRules(loadedRules);
    setVipPeople(loadedVips);
    setSettings(loadedSettings);
    setCompletedIds(loadedCompleted);
    setSnoozedEmails(loadedSnoozed);

    // Calculate priority with engine
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

  // Greeting based on time
  const greeting = useMemo(() => {
    const hours = new Date().getHours();
    let timeGreeting = 'Good morning';
    if (hours >= 12 && hours < 17) timeGreeting = 'Good afternoon';
    else if (hours >= 17) timeGreeting = 'Good evening';
    return `${timeGreeting}, ${settings.userName || 'Tiesha'}`;
  }, [settings.userName]);

  // Handle Mark Done
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

  // Handle Snooze
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

  // Priority emails only (urgent and high)
  const priorityEmails = useMemo(() => {
    const now = Date.now();
    return emails.filter((e) => {
      // If snoozed and snooze time is still in the future, hide from inbox
      if (e.snoozedUntil) {
        const snoozeTime = new Date(e.snoozedUntil).getTime();
        if (snoozeTime > now) return false;
      }
      return e.priority === 'urgent' || e.priority === 'high';
    });
  }, [emails]);

  // Counts for stat cards
  const counts = useMemo(() => {
    const needsAttention = priorityEmails.filter((e) => !e.isCompleted && e.actionRequired).length;
    const urgent = priorityEmails.filter((e) => !e.isCompleted && e.priority === 'urgent').length;
    const deadlines = priorityEmails.filter(
      (e) => !e.isCompleted && Boolean(e.deadline && e.deadline.trim() !== '')
    ).length;

    return { needsAttention, urgent, deadlines };
  }, [priorityEmails]);

  // Filtered priority emails
  const filteredEmails = useMemo(() => {
    return priorityEmails.filter((e) => {
      // Filter by active stat card
      if (activeFilter === 'attention' && (e.isCompleted || !e.actionRequired)) return false;
      if (activeFilter === 'urgent' && (e.isCompleted || e.priority !== 'urgent')) return false;
      if (activeFilter === 'deadlines' && (e.isCompleted || !e.deadline)) return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSender = e.senderName.toLowerCase().includes(q);
        const matchSubject = e.subject.toLowerCase().includes(q);
        const matchSnippet = e.snippet.toLowerCase().includes(q);
        const matchReason = e.reasons.some((r) => r.toLowerCase().includes(q));
        if (!matchSender && !matchSubject && !matchSnippet && !matchReason) return false;
      }

      return true;
    });
  }, [priorityEmails, activeFilter, searchQuery]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header Area */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.appName}>PriorityMail</Text>
            <Text style={styles.greeting}>{greeting}</Text>
          </View>
          <View style={styles.liveIndicator}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>AI Prioritized</Text>
          </View>
        </View>
        <Text style={styles.subtitle}>Your important emails, without the noise.</Text>

        {/* Summary Stat Cards */}
        <View style={styles.statsRow}>
          <StatCard
            title="Needs attention"
            count={counts.needsAttention}
            icon="⚡"
            color="#2563EB"
            isActive={activeFilter === 'attention'}
            onPress={() => setActiveFilter((prev) => (prev === 'attention' ? 'all' : 'attention'))}
          />
          <StatCard
            title="Urgent"
            count={counts.urgent}
            icon="🚨"
            color="#DC2626"
            isActive={activeFilter === 'urgent'}
            onPress={() => setActiveFilter((prev) => (prev === 'urgent' ? 'all' : 'urgent'))}
          />
          <StatCard
            title="Deadlines"
            count={counts.deadlines}
            icon="⏰"
            color="#D97706"
            isActive={activeFilter === 'deadlines'}
            onPress={() => setActiveFilter((prev) => (prev === 'deadlines' ? 'all' : 'deadlines'))}
          />
        </View>

        {/* Search & Active Filter Chip */}
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search priority emails, senders, reasons..."
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

        {activeFilter !== 'all' && (
          <View style={styles.activeFilterRow}>
            <Text style={styles.activeFilterText}>
              Filtering: <Text style={styles.activeFilterBold}>{activeFilter}</Text>
            </Text>
            <Pressable onPress={() => setActiveFilter('all')}>
              <Text style={styles.clearFilterText}>Reset filter</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Priority Email Stream */}
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
            icon="🎉"
            title="All caught up!"
            subtitle={
              searchQuery
                ? 'No priority emails match your search query.'
                : 'Zero high-priority emails pending your attention right now.'
            }
            actionLabel={activeFilter !== 'all' || searchQuery ? 'Clear filters' : undefined}
            onAction={() => {
              setActiveFilter('all');
              setSearchQuery('');
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  appName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    marginTop: 2,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginRight: 5,
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#065F46',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
    marginBottom: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -4,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  activeFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 2,
  },
  activeFilterText: {
    fontSize: 12,
    color: '#6B7280',
  },
  activeFilterBold: {
    fontWeight: '700',
    color: '#2563EB',
    textTransform: 'capitalize',
  },
  clearFilterText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
});
