import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SectionList,
  FlatList,
  TextInput,
  Alert,
  SafeAreaView,
  RefreshControl,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getContacts, sendContactRequest, approveContactRequest, rejectContactRequest, removeContact } from '../services/api';
import { theme } from '../styles/theme';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function ContactsScreen({ navigation, token }) {
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [outgoingPendingRequests, setOutgoingPendingRequests] = useState([]);
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
      setOutgoingPendingRequests(data.outgoingPendingRequests || []);      
    } catch (error) {
      showError('Failed to load contacts');
    }
  };

  const handleAddContact = async () => {
    if (!newContactEmail.trim()) {
      showError('Please enter an email address')
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newContactEmail.trim())) {
      showError('Please enter a valid email address');
      return;
    }

    // Check if contact already exists
    const normalizedEmail = newContactEmail.trim().toLowerCase();
    const existingContact = contacts.find(
      contact => contact.contact_email.toLowerCase() === normalizedEmail
    );

    if (existingContact) {
      showError('This contact already exists in your contact list');
      return;
    }

    // Check if there's already a pending request for this email
    const pendingRequest = pendingRequests.find(
      request => request.requester_email.toLowerCase() === normalizedEmail
    );

    if (pendingRequest) {
      showError('You already have a pending contact request for this email');
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

const handleRemoveContact = (contactItem) => {
  console.log('🗑️ handleRemoveContact called with:', contactItem);
  
  const performDelete = async () => {
    try {
      console.log('🗑️ About to call removeContact API');
      const result = await removeContact(contactItem.id, token);
      console.log('🗑️ removeContact API result:', result);
      
      showSuccess('Contact removed successfully');
      console.log('🗑️ About to call loadContacts');
      await loadContacts();
      console.log('🗑️ loadContacts completed');
    } catch (error) {
      console.error('🗑️ Error in remove process:', error);
      showError(error.message || 'Failed to remove contact');
    }
  };

  if (Platform.OS === 'web') {
    // Use browser confirm dialog for web
    const confirmed = window.confirm(
      `Are you sure you want to remove ${contactItem.contact_name} from your contacts?`
    );
    
    if (confirmed) {
      console.log('🗑️ User confirmed deletion (web)');
      performDelete();
    } else {
      console.log('🗑️ User cancelled deletion (web)');
    }
  } else {
    // Use React Native Alert for mobile
    Alert.alert(
      'Remove Contact',
      `Are you sure you want to remove ${contactItem.contact_name} from your contacts?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => console.log('🗑️ User cancelled deletion (mobile)')
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            console.log('🗑️ User confirmed deletion (mobile)');
            performDelete();
          }
        }
      ]
    );
  }
};

  const handleCancelPendingRequest = async (pendingRequest) => {
    const performCancel = async () => {
      try {
        await removeContact(pendingRequest.id, token);
        showSuccess('Contact request cancelled');
        loadContacts();
      } catch (error) {
        showError('Failed to cancel contact request');
      }
    };

    if (Platform.OS === 'web') {
      // Use browser confirm dialog for web
      const confirmed = window.confirm(
        `Are you sure you want to cancel the contact request to ${pendingRequest.recipient_name}?`
      );
      
      if (confirmed) {
        performCancel();
      }
    } else {
      // Use React Native Alert for mobile
      Alert.alert(
        'Cancel Request',
        `Are you sure you want to cancel the contact request to ${pendingRequest.recipient_name}?`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Delete Request',
            style: 'destructive',
            onPress: performCancel,
          },
        ]
      );
    }
  };




  const renderContact = ({ item }) => (
    <View style={styles.contactItem}>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{item.contact_name}</Text>
        <Text style={styles.contactEmail}>{item.contact_email}</Text>
      </View>
      <TouchableOpacity 
        style={styles.removeButton}
        onPress={() => {
          console.log('🔥 BUTTON PRESSED!', item.contact_name);
          try {
            handleRemoveContact(item);
          } catch (error) {
            console.error('🔥 Error calling handleRemoveContact:', error);
          }       
        }}
      >
        <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
      </TouchableOpacity>
    </View>
  );


  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    loadContacts().finally(() => setRefreshing(false));
  }, []);

  // Prepare sections data
  const sections = [];

 if (pendingRequests.length > 0) {
    sections.push({
      title: `Contact Requests (${pendingRequests.length})`,
      data: pendingRequests,
      type: 'pending'
    });
  }

  if (outgoingPendingRequests.length > 0) {
    sections.push({
      title: `Pending Invitations (${outgoingPendingRequests.length})`,
      data: outgoingPendingRequests,
      type: 'outgoing'
    });
  }

  if (contacts.length > 0) {
    sections.push({
      title: `My Contacts (${contacts.length})`,
      data: contacts,
      type: 'contacts'
    });
  }

  const renderItem = ({ item, section }) => {
    switch (section.type) {
      case 'pending':
        return (
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

      case 'outgoing':
        return (
          <View style={styles.outgoingPendingItem}>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.recipient_name}</Text>
              <Text style={styles.contactEmail}>{item.recipient_email}</Text>
              <Text style={styles.pendingStatus}>Pending response...</Text>
            </View>
            <View style={styles.statusContainer}>
              <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={styles.statusText}>Sent</Text>
            </View>
          </View>
        );

      case 'contacts':
        return (
          <View style={styles.contactItem}>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{item.contact_name}</Text>
              <Text style={styles.contactEmail}>{item.contact_email}</Text>
            </View>
            <TouchableOpacity 
              style={styles.removeButton}
              onPress={() => handleRemoveContact(item)}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  const ListHeaderComponent = () => (
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
            {loading ? 'Sending...' : 'Add'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const ListEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        No contacts yet. Add someone by entering their email above.
      </Text>
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

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        stickySectionHeadersEnabled={false}
      />
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
    fontSize: 20,
    fontFamily: theme.fonts.headingBold,
    color: theme.colors.text,
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -50 }],
  },

  addContactSection: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  sectionHeader: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },

  sectionTitle: {
    fontSize: 18,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
  },
  addContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  emailInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.medium,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    backgroundColor: theme.colors.surface,
  },
  addButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.medium,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    justifyContent: 'center',
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
    justifyContent: 'space-between',  
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 60,
  },

  pendingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    backgroundColor: theme.colors.background,
    gap: theme.spacing.lg,
  },
  outgoingPendingItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    minHeight: 60,
    backgroundColor: '#f8f9fa',
  }, 
  
  contactInfo: {
    flex: 1,
    marginRight: theme.spacing.md,
    minWidth: 0, 
  },
  contactName: {
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    flexWrap: 'wrap',
    numberOfLines: 2,
  },
  contactEmail: {
    fontSize: 14,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    marginTop: 2,
    flexWrap: 'wrap',
    numberOfLines: 2,
  },

  pendingStatus: {
    fontSize: 12,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  statusText: {
    fontSize: 12,
    fontFamily: theme.fonts.body,
    color: theme.colors.textSecondary,
  },
  removeButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.small,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.error,
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
    emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontFamily: theme.fonts.body,
    marginTop: theme.spacing.xl,
  },
});