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
import { getContacts, sendContactRequest, approveContactRequest, rejectContactRequest } from '../services/api';

export default function ContactsScreen({ token, onBack }) {
  const [contacts, setContacts] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [newContactEmail, setNewContactEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const data = await getContacts(token);
      setContacts(data.contacts || []);
      setPendingRequests(data.pendingRequests || []);
    } catch (error) {
      Alert.alert('Error', 'Failed to load contacts');
    }
  };

  const handleAddContact = async () => {
    if (!newContactEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }
    setLoading(true);
    try {
      const result = await sendContactRequest(newContactEmail.trim(), token);
      Alert.alert('Success', result.message);
      setNewContactEmail('');
      loadContacts(); // Refresh the lists
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      await approveContactRequest(requestId, token);
      Alert.alert('Success', 'Contact request approved');
      loadContacts(); // Refresh the lists
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await rejectContactRequest(requestId, token);
      Alert.alert('Success', 'Contact request rejected');
      loadContacts(); // Refresh the lists
    } catch (error) {
      Alert.alert('Error', error.message);
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
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
    backgroundColor: '#F5F2ED',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E4DB',
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    fontSize: 16,
    color: '#5A9B9E',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addContactSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  addContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emailInput: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginRight: 10,
  },
  addButton: {
    backgroundColor: '#5A9B9E',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  pendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
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
  buttonContainer: {
    flexDirection: 'row',
  },
  approveButton: {
    backgroundColor: '#27AE60',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  rejectButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: '#666',
    fontSize: 16,
    marginTop: 20,
  },
});
