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
import { getDisputes } from '../services/api';

export default function DisputesScreen({ token, onBack, onCreateDispute, onViewDispute }) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDisputes();
  }, []);

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
    if (status === 'completed') {
      return styles.completedDispute;
    }
    if (userParticipationStatus === 'invited') {
      return styles.invitedDispute;
    }
    return styles.ongoingDispute;
  };

  const getDisputeStatusText = (status, userParticipationStatus) => {
    if (status === 'rejected') return 'Rejected';
    if (status === 'completed') return 'Completed';
    if (userParticipationStatus === 'invited') return 'Invited';
    return 'Ongoing';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderDispute = ({ item }) => {
    const statusStyle = getDisputeStatusStyle(item.status, item.user_participation_status);
    const statusText = getDisputeStatusText(item.status, item.user_participation_status);
    
    return (
      <TouchableOpacity 
        style={[styles.disputeItem, statusStyle]}
        onPress={() => onViewDispute(item.id)}
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
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Your Disputes</Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={onCreateDispute}
        >
          <Text style={styles.createButtonText}>+ Create New Dispute</Text>
        </TouchableOpacity>

        {loading && disputes.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.loadingText}>Loading disputes...</Text>
          </View>
        ) : disputes.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>No disputes yet</Text>
            <Text style={styles.emptySubtext}>
              Create your first dispute to get started
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContainer: {
    paddingBottom: 20,
  },
  disputeItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  ongoingDispute: {
    borderColor: '#007AFF',
  },
  invitedDispute: {
    borderColor: '#FF9500',
    backgroundColor: '#FFF3E0',
  },
  completedDispute: {
    borderColor: '#34C759',
    backgroundColor: '#F0F9F0',
  },
  rejectedDispute: {
    borderColor: '#FF3B30',
    backgroundColor: '#FFF0F0',
    opacity: 0.7,
  },
  disputeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  disputeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  statusBadge: {
    backgroundColor: '#E5E5E7',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  disputeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  creatorText: {
    fontSize: 14,
    color: '#666',
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});