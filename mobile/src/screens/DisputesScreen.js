import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  RefreshControl,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getDisputes } from '../services/api';
import { theme } from '../styles/theme';

export default function DisputesScreen({ navigation, token}) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      setDisputes(data.disputes || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load disputes');
      console.error('Error loading disputes:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDisputes();
    setRefreshing(false);
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
    
    return (
      <TouchableOpacity 
        style={[styles.disputeItem, statusStyle]}
        onPress={() => handleViewDispute(item.id)}
      >
        <View style={styles.disputeHeader}>
          <Text style={styles.disputeTitle} numberOfLines={2}>
            {item.title}
          </Text>
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