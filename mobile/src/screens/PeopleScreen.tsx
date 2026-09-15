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
import { VipPerson } from '../types';
import { defaultVipPeople } from '../services/mockData';
import { StorageService } from '../services/storage';
import { AddVipModal } from '../components/AddVipModal';
import { EmptyState } from '../components/EmptyState';

export function PeopleScreen() {
  const [vipPeople, setVipPeople] = useState<VipPerson[]>([]);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);

  useEffect(() => {
    loadVipPeople();
  }, []);

  const loadVipPeople = async () => {
    const loaded = await StorageService.getVipPeople(defaultVipPeople);
    setVipPeople(loaded);
  };

  const handleDeleteVip = (id: string, name: string) => {
    Alert.alert(
      'Remove VIP Person',
      `Remove ${name} from your VIP contacts? Their emails will no longer receive automatic VIP priority.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = vipPeople.filter((p) => p.id !== id);
            setVipPeople(updated);
            await StorageService.saveVipPeople(updated);
          },
        },
      ]
    );
  };

  const handleAddVip = async (newVipData: Omit<VipPerson, 'id'>) => {
    const newVip: VipPerson = {
      ...newVipData,
      id: `vip-${Date.now()}`,
    };

    const updated = [newVip, ...vipPeople];
    setVipPeople(updated);
    await StorageService.saveVipPeople(updated);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>VIP People</Text>
            <Text style={styles.subtitle}>
              Key contacts whose emails are guaranteed immediate priority
            </Text>
          </View>
          <Pressable
            style={styles.addButton}
            onPress={() => setIsAddModalVisible(true)}
            hitSlop={6}
          >
            <Text style={styles.addButtonIcon}>+</Text>
            <Text style={styles.addButtonText}>Add VIP</Text>
          </Pressable>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Text style={styles.infoIcon}>⭐</Text>
          <Text style={styles.infoText}>
            Emails from VIP contacts bypass normal filtering and are automatically scored
            with +6 priority points.
          </Text>
        </View>
      </View>

      {/* People List */}
      <FlatList
        contentContainerStyle={styles.listContent}
        data={vipPeople}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const initials = item.name
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          return (
            <View style={styles.vipCard}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.name}</Text>
                  <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category}</Text>
                  </View>
                </View>
                <Text style={styles.email}>{item.email}</Text>
                <Text style={styles.alwaysNotify}>✓ Always Notify • VIP Bypass</Text>
              </View>

              <Pressable
                onPress={() => handleDeleteVip(item.id, item.name)}
                style={styles.deleteBtn}
                hitSlop={8}
              >
                <Text style={styles.deleteIcon}>✕</Text>
              </Pressable>
            </View>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon="⭐"
            title="No VIP contacts yet"
            subtitle="Add your placement coordinator, professor, internship manager, or mentor."
            actionLabel="Add First VIP"
            onAction={() => setIsAddModalVisible(true)}
          />
        }
      />

      {/* Add VIP Modal */}
      <AddVipModal
        visible={isAddModalVisible}
        onClose={() => setIsAddModalVisible(false)}
        onAddVip={handleAddVip}
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
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: '#92400E',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  vipCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B45309',
  },
  cardContent: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  name: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  categoryBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },
  email: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
  },
  alwaysNotify: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  deleteBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginLeft: 8,
  },
  deleteIcon: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '800',
  },
});
