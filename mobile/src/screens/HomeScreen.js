import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { getContacts, getDisputes } from '../services/api';

export default function HomeScreen({ user, token, onLogout, onNavigateToContacts, onNavigateToDisputes }) {

  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [invitedDisputesCount, setInvitedDisputesCount] = useState(0);
  
  useEffect(() => {
    const checkNotifications = async () => {
      try {
        const contactData = await getContacts(token);
        setPendingRequestsCount(data.pendingRequests?.length || 0);

        const disputeData = await getDisputes(token);
        const invitedDisputes = disputeData.disputes?.filter(d => d.user_participation_status === 'invited') || [];
        setInvitedDisputesCount(invitedDisputes.length);
      } catch (error) {
        console.log('Error checking notifications:', error);
      }
    };

    checkNotifications();
  }, [token]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>YOUR HOMEPAGE</Text>
        <Text style={styles.welcome}>Welcome, {user.name}!</Text>
        <Text style={styles.email}>{user.email}</Text>
        
       <View style={styles.buttonSection}>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={onNavigateToContacts}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.actionButtonText}>Contacts</Text>
              {pendingRequestsCount > 0 && (
                <View style={styles.redDot}>
                  <Text style={styles.redDotText}>{pendingRequestsCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

        <TouchableOpacity 
            style={styles.actionButton} 
            onPress={onNavigateToDisputes}
          >
            <View style={styles.buttonContent}>
              <Text style={styles.actionButtonText}>Disputes</Text>
              {invitedDisputesCount > 0 && (
                <View style={styles.redDot}>
                  <Text style={styles.redDotText}>{invitedDisputesCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>


        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED',
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  welcome: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 10,
    color: '#5A9B9E',
  },
  email: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  placeholderSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  placeholderText: {
    fontSize: 16,
    marginBottom: 8,
    color: '#666',
  },
  buttonSection: {
    flexDirection: 'column',
    gap: 15,
    marginBottom: 40,
  },
  logoutButton: {
    backgroundColor: '#E74C3C',
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: 30,
  },
  logoutText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#5A9B9E',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  redDot: {
    backgroundColor: '#E74C3C',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  redDotText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
});