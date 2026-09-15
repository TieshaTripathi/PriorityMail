import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

import { InboxScreen } from './src/screens/InboxScreen';
import { AllEmailsScreen } from './src/screens/AllEmailsScreen';
import { RulesScreen } from './src/screens/RulesScreen';
import { PeopleScreen } from './src/screens/PeopleScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

type TabBarIconProps = {
  focused: boolean;
  color: string;
  size: number;
};

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: '#2563EB',
            tabBarInactiveTintColor: '#9CA3AF',
            tabBarStyle: {
              backgroundColor: '#FFFFFF',
              borderTopColor: '#E5E7EB',
              borderTopWidth: 1,
              height: 60,
              paddingBottom: 8,
              paddingTop: 6,
            },
            tabBarLabelStyle: {
              fontSize: 10,
              fontWeight: '700',
            },
            tabBarIcon: ({ focused, color, size }: TabBarIconProps) => {
              let iconName: keyof typeof Ionicons.glyphMap = 'mail';

              if (route.name === 'Priority Inbox') {
                iconName = focused ? 'mail-unread' : 'mail-unread-outline';
              } else if (route.name === 'All Emails') {
                iconName = focused ? 'file-tray-full' : 'file-tray-full-outline';
              } else if (route.name === 'Rules') {
                iconName = focused ? 'options' : 'options-outline';
              } else if (route.name === 'VIP People') {
                iconName = focused ? 'star' : 'star-outline';
              } else if (route.name === 'Settings') {
                iconName = focused ? 'settings' : 'settings-outline';
              }

              return <Ionicons name={iconName} size={22} color={color} />;
            },
          })}
        >
          <Tab.Screen name="Priority Inbox" component={InboxScreen} />
          <Tab.Screen name="All Emails" component={AllEmailsScreen} />
          <Tab.Screen name="Rules" component={RulesScreen} />
          <Tab.Screen name="VIP People" component={PeopleScreen} />
          <Tab.Screen name="Settings" component={SettingsScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
