import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  Switch,
  Pressable,
  StyleSheet,
  Alert,
  StatusBar,

} from 'react-native';
import { AppSettings, PrioritySensitivity } from '../types';
import { defaultSettings, mockConnectedAccounts } from '../services/mockData';
import { StorageService } from '../services/storage';


export function SettingsScreen() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);


  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const loaded = await StorageService.getSettings(defaultSettings);
    setSettings(loaded);
  };

  const updateSetting = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await StorageService.saveSettings(updated);
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset All Local Data',
      'This will restore all default rules, VIP contacts, and clear completed/snoozed email state.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: async () => {
            await StorageService.clearAll();
            setSettings(defaultSettings);
            Alert.alert('Data Reset', 'All settings and rules have been reset to factory defaults.');
          },
        },
      ]
    );
  };

  const sensitivities: { level: PrioritySensitivity; desc: string }[] = [
    { level: 'Low', desc: 'Strict: only critical deadlines & explicit VIPs' },
    { level: 'Balanced', desc: 'Recommended: catches action items & deadlines' },
    { level: 'High', desc: 'Permissive: flags all potential tasks & follow-ups' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>Configure accounts, AI engine, and notifications</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Connected Gmail Accounts</Text>
          <View style={styles.card}>
            {mockConnectedAccounts.map(account => (
              <View key={account.id}>
                <View style={styles.accountRow}>
                  <View style={styles.accountMeta}>
                    <Text style={styles.accountName}>{account.displayName}</Text>
                    <Text style={styles.accountEmail}>{account.email}</Text>
                    <Text style={styles.hint}>Demo connection{account.isPrimary ? ' · Primary' : ''}</Text>
                  </View>
                  <Pressable accessibilityRole="button" accessibilityLabel={'Remove ' + account.email}
                    hitSlop={10} onPress={() => Alert.alert('Demo account', 'Removing connected accounts will be available with Gmail OAuth. No real account is connected.')}>
                    <Text style={styles.disconnectBtnText}>Remove</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            <Pressable style={styles.connectBtn} accessibilityRole="button"
              onPress={() => Alert.alert('Gmail connection coming soon', 'These are example accounts. Secure Google OAuth will allow you to add your own Gmail accounts in a future release.')}>
              <Text style={styles.connectBtnText}>Add Gmail Account</Text>
            </Pressable>
            <Text style={styles.hint}>Gmail Connection: demo mode. No passwords, tokens, or real emails are stored for these accounts.</Text>
          </View>
        </View>

        {/* Section: Priority Sensitivity */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Priority Sensitivity</Text>
          <View style={styles.card}>
            <View style={styles.sensitivityRow}>
              {sensitivities.map((s) => {
                const isSelected = settings.prioritySensitivity === s.level;
                return (
                  <Pressable
                    key={s.level}
                    style={[styles.sensitivityTab, isSelected && styles.sensitivityTabActive]}
                    onPress={() => updateSetting('prioritySensitivity', s.level)}
                  >
                    <Text
                      style={[
                        styles.sensitivityTabText,
                        isSelected && styles.sensitivityTabTextActive,
                      ]}
                    >
                      {s.level}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.sensitivityDesc}>
              {sensitivities.find((s) => s.level === settings.prioritySensitivity)?.desc}
            </Text>
          </View>
        </View>

        {/* Section: Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Notifications & Alerts</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchMeta}>
                <Text style={styles.switchLabel}>Push notifications</Text>
                <Text style={styles.switchSub}>Deliver alerts directly to lock screen</Text>
              </View>
              <Switch
                value={settings.pushNotifications}
                onValueChange={(val) => updateSetting('pushNotifications', val)}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={settings.pushNotifications ? '#2563EB' : '#F4F3F4'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchMeta}>
                <Text style={styles.switchLabel}>Deadline alerts</Text>
                <Text style={styles.switchSub}>High priority reminders for expiring portals</Text>
              </View>
              <Switch
                value={settings.deadlineAlerts}
                onValueChange={(val) => updateSetting('deadlineAlerts', val)}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={settings.deadlineAlerts ? '#2563EB' : '#F4F3F4'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.switchRow}>
              <View style={styles.switchMeta}>
                <Text style={styles.switchLabel}>VIP alerts</Text>
                <Text style={styles.switchSub}>Immediate notification for VIP sender emails</Text>
              </View>
              <Switch
                value={settings.vipAlerts}
                onValueChange={(val) => updateSetting('vipAlerts', val)}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={settings.vipAlerts ? '#2563EB' : '#F4F3F4'}
              />
            </View>
          </View>
        </View>

        {/* Section: Quiet Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Quiet Hours</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchMeta}>
                <Text style={styles.switchLabel}>Enable Quiet Hours</Text>
                <Text style={styles.switchSub}>Silence non-urgent notifications at night</Text>
              </View>
              <Switch
                value={settings.quietHours}
                onValueChange={(val) => updateSetting('quietHours', val)}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={settings.quietHours ? '#2563EB' : '#F4F3F4'}
              />
            </View>
            {settings.quietHours && (
              <View style={styles.quietHoursTime}>
                <Text style={styles.quietHoursText}>
                  Scheduled: {settings.quietHoursStart} – {settings.quietHoursEnd}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Section: AI Priority Assistant & Privacy */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>AI Priority Assistant & Privacy</Text>
          <View style={styles.card}>
            <View style={styles.switchRow}>
              <View style={styles.switchMeta}>
                <Text style={styles.switchLabel}>AI Classification</Text>
                <Text style={styles.switchSub}>Extract deadlines and action items locally</Text>
              </View>
              <Switch
                value={settings.aiClassification}
                onValueChange={(val) => updateSetting('aiClassification', val)}
                trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                thumbColor={settings.aiClassification ? '#2563EB' : '#F4F3F4'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.privacyNote}>
              <Text style={styles.privacyIcon}>🔒</Text>
              <Text style={styles.privacyText}>
                Privacy Promise: Email metadata is scored on your device using local heuristics
                and rules. PriorityMail does not sell or share personal email data.
              </Text>
            </View>
          </View>
        </View>

        {/* Section: Reset & Diagnostics */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Data Management</Text>
          <View style={styles.card}>
            <Pressable style={styles.resetBtn} onPress={handleResetData}>
              <Text style={styles.resetBtnText}>Restore Default Rules & Mock Data</Text>
            </Pressable>
            <Text style={styles.versionText}>
              PriorityMail v1.0.0 • Expo SDK 57 • React Native 0.86
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  section: {
    marginBottom: 18,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#4B5563',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  gmailIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  gmailIcon: {
    fontSize: 18,
  },
  accountMeta: {
    flex: 1,
  },
  accountName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  accountEmail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusPillMock: {
    backgroundColor: '#EFF6FF',
  },
  statusPillConnected: {
    backgroundColor: '#ECFDF5',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusPillTextMock: {
    color: '#2563EB',
  },
  statusPillTextConnected: {
    color: '#059669',
  },
  connectBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  disconnectBtn: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  disconnectBtnText: {
    color: '#EF4444',
  },
  hint: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 10,
    lineHeight: 15,
  },
  sensitivityRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
  },
  sensitivityTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  sensitivityTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  sensitivityTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  sensitivityTabTextActive: {
    color: '#2563EB',
    fontWeight: '800',
  },
  sensitivityDesc: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    marginTop: 2,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchMeta: {
    flex: 1,
    marginRight: 12,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  switchSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginVertical: 12,
  },
  quietHoursTime: {
    marginTop: 10,
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  quietHoursText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  privacyNote: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  privacyIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#64748B',
  },
  resetBtn: {
    backgroundColor: '#FEF2F2',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  resetBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 12,
  },
});
