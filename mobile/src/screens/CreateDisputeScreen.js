import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getContacts, createDispute } from '../services/api';
import { theme } from '../styles/theme';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function CreateDisputeScreen({navigation, token }) {
  const [title, setTitle] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const { toast, showSuccess, showError, hideToast } = useToast();

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await getContacts(token);
      setContacts(data.contacts || []);
    } catch (error) {
      showError('Failed to load contacts');
      console.error('Error loading contacts:', error);
    } finally {
      setLoadingContacts(false);
    }
  };

  const toggleContactSelection = (contact) => {
    setSelectedContacts(prev => {
      const isSelected = prev.find(c => c.contact_email === contact.contact_email);
      if (isSelected) {
        return prev.filter(c => c.contact_email !== contact.contact_email);
      } else {
        return [...prev, contact];
      }
    });
  };

  const handleCreateDispute = async () => {
    if (!title.trim()) {
      showError('Please enter a dispute title');
      return;
    }

    if (selectedContacts.length === 0) {
      showError('Please select at least one participant');
      return;
    }

    setLoading(true);
    try {
      const participant_emails = selectedContacts.map(c => c.contact_email);
      
      await createDispute({
        title: title.trim(),
        participant_emails
      }, token);

      showSuccess('Dispute created successfully!');

      // Navigate back to disputes screen
      navigation.goBack();


    } catch (error) {
      showError(error.message || 'Failed to create dispute');
    } finally {
      setLoading(false);
    }
  };

  const renderContact = ({ item }) => {
    const isSelected = selectedContacts.find(c => c.contact_email === item.contact_email);
    
    return (
      <TouchableOpacity 
        style={[styles.contactItem, isSelected && styles.selectedContact]}
        onPress={() => toggleContactSelection(item)}
      >
        <View style={styles.contactInfo}>
          <Text style={styles.contactName}>{item.contact_name}</Text>
          <Text style={styles.contactEmail}>{item.contact_email}</Text>
        </View>
        <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
          {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>

      <Toast 
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onHide={hideToast}
      />
      
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="chevron-back-outline" size={20} color={theme.colors.primary} style={{marginRight: 4}} />
            <Text style={styles.backButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Create Dispute</Text>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dispute Title</Text>
            <TextInput
              style={styles.titleInput}
              placeholder="Describe the dispute in a few words..."
              value={title}
              onChangeText={setTitle}
              multiline
              maxLength={200}
            />
            <Text style={styles.characterCount}>{title.length}/200</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Select Participants ({selectedContacts.length} selected)
            </Text>
            
            {loadingContacts ? (
              <View style={styles.centerContainer}>
                <Text style={styles.loadingText}>Loading contacts...</Text>
              </View>
            ) : contacts.length === 0 ? (
              <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>No contacts available</Text>
                <Text style={styles.emptySubtext}>
                  Add contacts first to create disputes
                </Text>
              </View>
            ) : (
              <FlatList
                data={contacts}
                renderItem={renderContact}
                keyExtractor={(item) => item.contact_email}
                style={styles.contactsList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.createButton,
              (!title.trim() || selectedContacts.length === 0 || loading) && styles.buttonDisabled
            ]}
            onPress={handleCreateDispute}
            disabled={!title.trim() || selectedContacts.length === 0 || loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'Creating...' : 'Create Dispute'}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.large,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    ...theme.shadows.medium,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  titleInput: {
    backgroundColor: theme.colors.cardBackground,
    borderRadius: theme.borderRadius.small,
    padding: theme.spacing.md,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 60,
    textAlignVertical: 'top',
    fontFamily: theme.fonts.body,
  },
  characterCount: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    marginTop: theme.spacing.sm,
    fontFamily: theme.fonts.body,
  },
  contactsList: {
    maxHeight: 200,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.small,
    marginBottom: theme.spacing.sm,
  },
  selectedContact: {
    backgroundColor: '#E3F2FD',
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
    color: theme.colors.textSecondary,
    marginTop: 2,
    fontFamily: theme.fonts.body,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  createButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.medium,
    padding: theme.spacing.lg,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: theme.spacing.xl,
    ...theme.shadows.medium,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textLight,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
  },
  emptyText: {
    fontSize: 16,
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
