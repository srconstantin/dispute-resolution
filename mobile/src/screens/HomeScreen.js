import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getContacts, getDisputes } from '../services/api';
import { theme } from '../styles/theme';


export default function HomeScreen({ user, token, onLogout, onNavigateToContacts, onNavigateToDisputes }) {
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [invitedDisputesCount, setInvitedDisputesCount] = useState(0);
  const [stats, setStats] = useState({
    activeDisputes: 0,
    resolvedDisputes: 0,
    totalContacts: 0
  });
  
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        const contactData = await getContacts(token);
        setPendingRequestsCount(contactData.pendingRequests?.length || 0);
        setStats(prev => ({ ...prev, totalContacts: contactData.contacts?.length || 0 }));

        const disputeData = await getDisputes(token);
        const disputes = disputeData.disputes || [];
        const invitedDisputes = disputes.filter(d => d.user_participation_status === 'invited');
        const activeDisputes = disputes.filter(d => d.status === 'ongoing');
        const resolvedDisputes = disputes.filter(d => d.status === 'completed');
        
        setInvitedDisputesCount(invitedDisputes.length);
        setStats(prev => ({ 
          ...prev, 
          activeDisputes: activeDisputes.length,
          resolvedDisputes: resolvedDisputes.length
        }));
      } catch (error) {
        console.log('Error checking notifications:', error);
      }
    };

    checkNotifications();
  }, [token]);

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
         <Image 
          source={require('../../assets/bluespiral.png')} 
          style={styles.logoImage}
          />
          <Text style={styles.appName}>FairEnough</Text>
        </View>
        <TouchableOpacity style={styles.profileButton} onPress={onLogout}>
          <Text style={styles.profileText}>{getInitials(user?.name)}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome back, {user?.name?.split(' ')[0]}</Text>
          <Text style={styles.welcomeSubtitle}>Resolve disputes fairly and transparently</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="time-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.statNumber}>{stats.activeDisputes}</Text>
            <Text style={styles.statLabel}>Active Disputes</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="checkmark-circle-outline" size={20} color={theme.colors.success} />
            </View>
            <Text style={styles.statNumber}>{stats.resolvedDisputes}</Text>
            <Text style={styles.statLabel}>Resolved</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.statIcon}>
              <Ionicons name="people-outline" size={20} color={theme.colors.primary} />
            </View>
            <Text style={styles.statNumber}>{stats.totalContacts}</Text>
            <Text style={styles.statLabel}>Contacts</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionGrid}>
            <TouchableOpacity style={styles.actionCard} onPress={onNavigateToDisputes}>
              <View style={styles.actionIcon}>
                <Ionicons name="add-circle-outline" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>New Dispute</Text>
              <Text style={styles.actionSubtitle}>Start a new dispute resolution</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard} onPress={onNavigateToDisputes}>
              <View style={styles.actionIcon}>
                <Ionicons name="document-text-outline" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>View Disputes</Text>
              <Text style={styles.actionSubtitle}>See all your disputes</Text>
              {invitedDisputesCount > 0 && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{invitedDisputesCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard} onPress={onNavigateToContacts}>
              <View style={styles.actionIcon}>
                <Ionicons name="people-outline" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Contacts</Text>
              <Text style={styles.actionSubtitle}>Manage your contacts</Text>
              {pendingRequestsCount > 0 && (
                <View style={styles.actionBadge}>
                  <Text style={styles.actionBadgeText}>{pendingRequestsCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard} onPress={onLogout}>
              <View style={styles.actionIcon}>
                <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.actionTitle}>Log Out</Text>
              <Text style={styles.actionSubtitle}>Sign out of your account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 50,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.small,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appName: {
    fontSize: 28,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  logoImage: {
    width: 36,
    height: 36,
    marginRight: theme.spacing.md,
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: theme.fonts.headingMedium,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  welcomeSection: {
    paddingVertical: theme.spacing.xxl,
  },
  welcomeTitle: {
    fontSize: 32,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontFamily: theme.fonts.headingRegular,
    color: theme.colors.textSecondary,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xxxl,
    gap: theme.spacing.sm,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.xl,
    alignItems: 'center',
    flex: 1,
    ...theme.shadows.medium,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.cardBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statNumber: {
    fontSize: 28,
    fontFamily: theme.fonts.heading,
    color: theme.colors.text,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: theme.fonts.headingRegular,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: theme.spacing.xxxl,
  },
  sectionTitle: {
    fontSize: 22,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.xl,
    width: '48%',
    marginBottom: theme.spacing.md,
    ...theme.shadows.medium,
    position: 'relative',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  actionTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    marginBottom: 4,
  },
  actionSubtitle: {
    fontSize: 12,
    fontFamily: theme.fonts.headingRegular,
    color: theme.colors.textSecondary,
    lineHeight: 16,
  },
  actionBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: theme.colors.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: theme.fonts.headingMedium,
  },
});
