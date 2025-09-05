import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  SafeAreaView,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getContacts, sendContactRequest, approveContactRequest, rejectContactRequest } from '../services/api';
import { theme } from '../styles/theme';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function ContactsScreen({ navigation, token }) {
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { toast, showSuccess, showError, hideToast } = useToast();


  useEffect(() => {
    loadContacts();
  }, []);

    // Focus listener to refresh data when returning to this screen
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadContacts();
    });

    return unsubscribe;
  }, [navigation]);

  const loadContacts = async () => {
    try {
      const data = await getContacts(token);
      setContacts(data.contacts || []);
      setPendingRequests(data.pendingRequests || []);
    } catch (error) {
      showError('Failed to load contacts');
    }
  };

  const handleAddContact = async () => {
    if (!newContactEmail.trim()) {
      showError('Please enter an email address')
      return;
    }

    setLoading(true);
    try {
      const result = await sendContactRequest(newContactEmail.trim(), token);
      showSuccess('Contact invitation sent successfully');
      setNewContactEmail('');
      loadContacts();
    } catch (error) {
      showError(error.message || 'Failed to send contact invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await approveContactRequest(requestId, token);
      showSuccess('Contact request approved');
      loadContacts();
    } catch (error) {
      showError(error.message || 'Failed to approve contact request');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await rejectContactRequest(requestId, token);
      showSuccess('Contact request rejected');
      loadContacts();
    } catch (error) {
      showError(error.message || 'Failed to reject contact request');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContacts();
    setRefreshing(false);
  };

  const renderContact = ({ item }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.contact_name}</Text>
        <Text style={styles.contactEmail}>{item.contact_email}</Text>
      </View>
    </View>
  );

  const renderPendingRequest = ({ item }) => (
    <View style={styles.pendingItem}>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.requester_name}</Text>
        <Text style={styles.contactEmail}>{item.requester_email}</Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={styles.approveButton}
          onPress={() => handleApproveRequest(item.id)}
        >
          <Text style={styles.buttonText}>Accept</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.rejectButton}
          onPress={() => handleRejectRequest(item.id)}
        >
          <Text style={styles.buttonText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Toast 
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />
      <View style={styles.header}>
        <TouchableOpacity 
        style={styles.backButton} 
        onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back-outline" size={20} color={theme.colors.primary} style={{marginRight: 4}} />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Contacts</Text>
      </View>

      <View style={styles.addContactSection}>
        <Text style={styles.sectionTitle}>Add New Contact</Text>
        <View style={styles.addContactRow}>
          <TextInput
            style={styles.emailInput}
            placeholder="Enter email address"
            value={newContactEmail}
            onChangeText={setNewContactEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TouchableOpacity 
            style={[styles.addButton, loading && styles.buttonDisabled]}
            onPress={handleAddContact}
            disabled={loading}
          >
            <Text style={styles.addButtonText}>
              {loading ? 'Adding...' : 'Add'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {pendingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Pending Requests ({pendingRequests.length})
          </Text>
          <FlatList
            data={pendingRequests}
            renderItem={renderPendingRequest}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          My Contacts ({contacts.length})
        </Text>
        <FlatList
          data={contacts}
          renderItem={renderContact}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No contacts yet</Text>
          }
        />
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
  addContactSection: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.xl,
    marginTop: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.xl,
    ...theme.shadows.medium,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.headingMedium,
    marginBottom: theme.spacing.lg,
    color: theme.colors.text,
  },
  addContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  emailInput: {
    flex: 1,
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.small,
    padding: theme.spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontFamily: theme.fonts.body,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.small,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    ...theme.shadows.small,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textLight,
  },
  section: {
    backgroundColor: theme.colors.surface,
    marginHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.xl,
    ...theme.shadows.medium,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.lg,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
  },
  contactEmail: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexShrink: 0,
  },
  approveButton: {
    backgroundColor: theme.colors.success,
    borderRadius: theme.borderRadius.small,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  rejectButton: {
    backgroundColor: theme.colors.error,
    borderRadius: theme.borderRadius.small,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: theme.fonts.headingMedium,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    marginTop: theme.spacing.xl,
  },
});