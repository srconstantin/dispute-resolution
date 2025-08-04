import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native';

export default function HomeScreen({ user, onLogout }) {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>YOUR HOMEPAGE</Text>
        <Text style={styles.welcome}>Welcome, {user.name}!</Text>
        <Text style={styles.email}>{user.email}</Text>
        
        <View style={styles.placeholderSection}>
          <Text style={styles.sectionTitle}>What you can do here:</Text>
          <Text style={styles.placeholderText}>• Manage contacts</Text>
          <Text style={styles.placeholderText}>• Create a dispute</Text>
          <Text style={styles.placeholderText}>• View your disputes</Text>
          <Text style={styles.placeholderText}>• Settings</Text>
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
    backgroundColor: '#f5f5f5',
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
    color: '#007AFF',
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
  logoutButton: {
    backgroundColor: '#FF3B30',
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
});
