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
import { getContacts, createDispute } from '../services/api';

export default function CreateDisputeScreen({ token, onBack, onDisputeCreated }) {
  const [title, setTitle] = useState('');
  const [contacts, setContacts] = useState([]);
  const [selectedContacts, setSelectedContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingContacts, setLoadingContacts] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await getContacts(token);
      setContacts(data.contacts || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load contacts');
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
      Alert.alert('Error', 'Please enter a dispute title');
      return;
    }

    if (selectedContacts.length === 0) {
      Alert.alert('Error', 'Please select at least one participant');
      return;
    }

    setLoading(true);
    try {
      const participant_emails = selectedContacts.map(c => c.contact_email);
      
      await createDispute({
        title: title.trim(),
        participant_emails
      }, token);

      Alert.alert(
        'Success', 
        'Dispute created successfully!',
        [{ text: 'OK', onPress: onDisputeCreated }]
      );
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to create dispute');
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
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Cancel</Text>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
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
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  titleInput: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
    marginTop: 8,
  },
  contactsList: {
    maxHeight: 200,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedContact: {
    backgroundColor: '#E3F2FD',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  contactEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ddd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  centerContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  emptyText: {
    fontSize: 16,
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