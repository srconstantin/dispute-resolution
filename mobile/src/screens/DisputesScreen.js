import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDisputes } from '../services/api';
import { theme } from '../styles/theme';

// Cross-platform storage utility (reuse from App.js)
const Storage = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      try {
        return localStorage.getItem(key);
      } catch (e) {
        console.warn('localStorage not available:', e);
        return null;
      }
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key, value) {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn('localStorage not available:', e);
      }
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key) {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('localStorage not available:', e);
      }
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      AsyncStorage.removeItem(key);
    }
  }
};



export default function DisputesScreen({ navigation, token, currentUserId}) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastViewedTimes, setLastViewedTimes] = useState({});

  useEffect(() => {
    loadDisputes();
  }, []);


  // Focus listener to refresh data when returning to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadDisputes();
    });
  return unsubscribe;
}, [navigation]);

  const loadDisputes = async () => {
    try {
      setLoading(true);
      const data = await getDisputes(token);
      const disputesList = data.disputes || [];
      setDisputes(disputesList);
    
      // This happens automatically now ↓
      await loadLastViewedTimes(disputesList);
    } catch (error) {
      Alert.alert('Error', 'Failed to load disputes');
      console.error('Error loading disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLastViewedTimes = async () => {
    const times = {};
    for (const dispute of disputes) {
      const timestamp = await Storage.getItem(`dispute_last_viewed_${dispute.id}`);
      if (timestamp) {
        times[dispute.id] = new Date(timestamp);
      }
    }
    setLastViewedTimes(times);
  };

  // Clean up old localStorage entries for disputes that no longer exist
  const cleanupOldViewedTimes = async () => {
    if (Platform.OS === 'web') {
      try {
        const disputeIds = disputes.map(d => d.id);
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('dispute_last_viewed_')) {
            const disputeId = key.replace('dispute_last_viewed_', '');
            if (!disputeIds.includes(parseInt(disputeId))) {
              localStorage.removeItem(key);
            }
          }
        }
      } catch (e) {
        console.warn('Error cleaning up localStorage:', e);
      }
    }
  };

  useEffect(() => {
    if (disputes.length > 0) {
      cleanupOldViewedTimes();
      loadLastViewedTimes();
    }
  }, [disputes]);



  const onRefresh = async () => {
    setRefreshing(true);
    await loadDisputes();
    setRefreshing(false);
  };

  // Helper function to check if dispute has unread content
  const hasUnreadContent = (dispute) => {
    const lastViewed = lastViewedTimes[dispute.id];
    
    if (!lastViewed) {
      // If user has never viewed this dispute, check if there's any content
      return hasAnyContent(dispute);
    }

    // Check for new responses from other users
    if (dispute.responses_by_round) {
      for (const round in dispute.responses_by_round) {
        const responses = dispute.responses_by_round[round];
        for (const response of responses) {
          // Skip user's own responses
          if (response.user_id === currentUserId) continue;
          
          const responseDate = new Date(response.submitted_at);
          if (responseDate > lastViewed) {
            return true;
          }
        }
      }
    }

    // Check for new verdicts
    if (dispute.verdicts) {
      for (const verdict of dispute.verdicts) {
        const verdictDate = new Date(verdict.generated_at);
        if (verdictDate > lastViewed) {
          return true;
        }
      }
    }

    // Fall back to old format
    if (dispute.verdict && dispute.updated_at) {
      const verdictDate = new Date(dispute.updated_at);
      if (verdictDate > lastViewed) {
        return true;
      }
    }

    // Check old format responses
    if (dispute.participants) {
      for (const participant of dispute.participants) {
        if (participant.user_id === currentUserId) continue;
        if (participant.response_text && participant.response_submitted_at) {
          const responseDate = new Date(participant.response_submitted_at);
          if (responseDate > lastViewed) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if dispute has any content at all
  const hasAnyContent = (dispute) => {
    // Check for responses from other users
    if (dispute.responses_by_round) {
      for (const round in dispute.responses_by_round) {
        const responses = dispute.responses_by_round[round];
        const otherUserResponses = responses.filter(r => r.user_id !== currentUserId);
        if (otherUserResponses.length > 0) {
          return true;
        }
      }
    }

    // Check for verdicts
    if (dispute.verdicts && dispute.verdicts.length > 0) {
      return true;
    }

    // Fall back to old format
    if (dispute.verdict) {
      return true;
    }

    // Check for responses from other participants (old format)
    if (dispute.participants) {
      const otherParticipants = dispute.participants.filter(p => 
        p.user_id !== currentUserId && p.response_text
      );
      if (otherParticipants.length > 0) {
        return true;
      }
    }

    return false;
  };
  const getUnreadCount = (dispute) => {
    const lastViewed = lastViewedTimes[dispute.id];
    
    if (!lastViewed) {
      // Count all content if never viewed
      let count = 0;
      
      if (dispute.responses_by_round) {
        for (const round in dispute.responses_by_round) {
          const responses = dispute.responses_by_round[round];
          count += responses.filter(r => r.user_id !== currentUserId).length;
        }
      }
      
      if (dispute.verdicts) {
        count += dispute.verdicts.length;
      }
      
      // Fall back to old format
      if (dispute.participants) {
        count += dispute.participants.filter(p => 
          p.user_id !== currentUserId && p.response_text
        ).length;
      }
      
      if (dispute.verdict) {
        count += 1;
      }
      
      return count;
    }

    let unreadCount = 0;

    // Count new responses
    if (dispute.responses_by_round) {
      for (const round in dispute.responses_by_round) {
        const responses = dispute.responses_by_round[round];
        for (const response of responses) {
          if (response.user_id === currentUserId) continue;
          
          const responseDate = new Date(response.submitted_at);
          if (responseDate > lastViewed) {
            unreadCount++;
          }
        }
      }
    }

    // Count new verdicts
    if (dispute.verdicts) {
      for (const verdict of dispute.verdicts) {
        const verdictDate = new Date(verdict.generated_at);
        if (verdictDate > lastViewed) {
          unreadCount++;
        }
      }
    }

    // Count old format content
    if (dispute.verdict && dispute.updated_at) {
      const verdictDate = new Date(dispute.updated_at);
      if (verdictDate > lastViewed) {
        unreadCount++;
      }
    }

    if (dispute.participants) {
      for (const participant of dispute.participants) {
        if (participant.user_id === currentUserId) continue;
        if (participant.response_text && participant.response_submitted_at) {
          const responseDate = new Date(participant.response_submitted_at);
          if (responseDate > lastViewed) {
            unreadCount++;
          }
        }
      }
    }

    return unreadCount;
  };


  const getDisputeStatusStyle = (status, userParticipationStatus) => {
    if (status === 'rejected') {
      return styles.rejectedDispute;
    }
    if (status === 'concluded') {
      return styles.concludedDispute;
    }
    if (status === 'evaluated') {
      return styles.evaluatedDispute;
    }
    if (userParticipationStatus === 'invited') {
      return styles.invitedDispute;
    }
    return styles.ongoingDispute;
  };

  const getDisputeStatusText = (status, userParticipationStatus) => {
    if (status === 'rejected') return 'Rejected';
    if (status === 'concluded') return 'Concluded';
    if (status === 'evaluated') return 'Evaluated';
    if (status === 'cancelled') return 'Cancelled';
    if (userParticipationStatus === 'invited') return 'Invited';
    return 'Incomplete';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleViewDispute = (disputeId) => {
    navigation.navigate('DisputeDetail', { disputeId });
  };

  const handleCreateDispute = () => {
    navigation.navigate('CreateDispute');
  };  

  const renderDispute = ({ item }) => {
    const statusStyle = getDisputeStatusStyle(item.status, item.user_participation_status);
    const statusText = getDisputeStatusText(item.status, item.user_participation_status);
    const hasUnread = hasUnreadContent(item);
    const unreadCount = hasUnread ? getUnreadCount(item) : 0;

    return (
      <TouchableOpacity 
        style={[styles.disputeItem, statusStyle]}
        onPress={() => handleViewDispute(item.id)}
      >
        <View style={styles.disputeHeader}>
         <View style={styles.titleContainer}>
          <Text style={styles.disputeTitle} numberOfLines={2}>
            {item.title}
          </Text>

          {hasUnread && (
            <View style={styles.notificationBadge}>
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
          </View>

          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        </View>
        
        <View style={styles.disputeInfo}>
          <Text style={styles.creatorText}>
            Created by: {item.creator_name}
          </Text>
          <Text style={styles.dateText}>
            {formatDate(item.created_at)}
          </Text>
        </View>

        {hasUnread && (
          <View style={styles.unreadIndicator}>
            <View style={styles.unreadDot} />
            <Text style={styles.unreadText}>New activity</Text>
          </View>
        )}

      </TouchableOpacity>
    );
  };



  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back-outline" size={20} color={theme.colors.primary} style={{marginRight: 4}} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Disputes</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={handleCreateDispute}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" style={{marginRight: 8}} />
          <Text style={styles.createButtonText}>Create New Dispute</Text>
        </TouchableOpacity>

        {loading && disputes.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.loadingText}>Loading disputes...</Text>
          </View>
        ) : disputes.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No disputes yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first dispute to get started!
            </Text>
          </View>
        ) : (
          <FlatList
            data={disputes}
            renderItem={renderDispute}
            keyExtractor={(item) => item.id.toString()}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
          />
        )}
      </View>
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
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: 50,
    paddingBottom: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    ...theme.shadows.small,
  },
  backButton: {
    marginRight: theme.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 16,
    color: theme.colors.primary,
    fontFamily: theme.fonts.headingRegular,
  },
  title: {
    fontSize: 22,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    flexDirection: 'row',
    justifyContent: 'center',
    ...theme.shadows.medium,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
  },
  listContainer: {
    paddingBottom: theme.spacing.xl,
  },
  disputeItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.border,
    ...theme.shadows.small,
  },

 disputeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginRight: 12,
  },
  disputeTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    flex: 1,
  },
  statusBadge: {
    backgroundColor: theme.colors.primaryBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.primary,
  },
  disputeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creatorText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  dateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },

  notificationBadge: {
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: theme.fonts.headingMedium,
  },
  unreadIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#DC2626',
    marginRight: 6,
  },
  unreadText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
    fontFamily: theme.fonts.headingMedium,
  },

  incompleteDispute: {
    borderLeftColor: theme.colors.primary,
  },
  invitedDispute: {
    borderLeftColor: theme.colors.warning,
    backgroundColor: '#FFF9E6',
  },
  evaluatedDispute: {
    borderLeftColor: theme.colors.warning,
    backgroundColor: '#FFF9E6',
  },
  concludedDispute: {
    borderLeftColor: theme.colors.success,
    backgroundColor: '#F0F9F0',
  },
  rejectedDispute: {
    borderLeftColor: theme.colors.error,
    backgroundColor: '#FFF0F0',
    opacity: 0.7,
  },  
  disputeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  disputeTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    flex: 1,
    marginRight: theme.spacing.md,
  },
  statusBadge: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.small,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
  },
  disputeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creatorText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  dateText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  emptyText: {
    fontSize: 18,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    fontFamily: theme.fonts.body,
  },
});