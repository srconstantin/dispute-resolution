import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView, ActivityIndicator, View, Text, Platform, AppRegistry } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { 
  Merriweather_400Regular,
  Merriweather_700Bold,
  Merriweather_900Black,
} from '@expo-google-fonts/merriweather';
import { 
  Lato_400Regular,
  Lato_700Bold,
} from '@expo-google-fonts/lato';
import SignupScreen from './src/screens/SignupScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import DisputesScreen from './src/screens/DisputesScreen';
import CreateDisputeScreen from './src/screens/CreateDisputeScreen';
import DisputeDetailScreen from './src/screens/DisputeDetailScreen';

const STORAGE_KEYS = {
  USER: '@user_data',
  TOKEN: '@auth_token'
};



 function App() {
  const [currentScreen, setCurrentScreen] = useState('signup'); // 'signup', 'login', 'home', 'contacts'
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [selectedDisputeId, setSelectedDisputeId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fontsLoaded] = useFonts({
    Merriweather_400Regular,
    Merriweather_700Bold,
    Merriweather_900Black,
    Lato_400Regular,
    Lato_700Bold,
  });

  // Don't render app until fonts are loaded
  if (!fontsLoaded) {
    return null; // Or show a loading screen
  }

  // Check for stored authentication on app startup
  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const [storedUser, storedToken] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.USER),
        AsyncStorage.getItem(STORAGE_KEYS.TOKEN)
      ]);

      if (storedUser && storedToken) {
        const userData = JSON.parse(storedUser);
        
        // Optionally verify token is still valid by making a test API call
        // For now, we'll trust it's valid until it fails
        setUser(userData);
        setToken(storedToken);
        setCurrentScreen('home');
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
      // If there's an error, clear any corrupted data
      await clearStoredAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const storeAuth = async (userData, userToken) => {
    try {
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData)),
        AsyncStorage.setItem(STORAGE_KEYS.TOKEN, userToken)
      ]);
    } catch (error) {
      console.error('Error storing auth:', error);
    }
  };

  const clearStoredAuth = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(STORAGE_KEYS.USER),
        AsyncStorage.removeItem(STORAGE_KEYS.TOKEN)
      ]);
    } catch (error) {
      console.error('Error clearing stored auth:', error);
    }
  };

  const handleSignupSuccess = async (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setSelectedDisputeId(null);
    setCurrentScreen('home');
    //persist authentication data
    await storeAuth(userData, userToken);
  };

  const handleLoginSuccess = async (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setCurrentScreen('home');
    //persist authentication data
    await storeAuth(userData, userToken);
  };

  const handleLogout = async () => {
    setUser(null);
    setToken(null);
    setSelectedDisputeId(null);
    setCurrentScreen('login');
    //clear authentication data
    await clearStoredAuth();
  };

  const switchToLogin = () => {
    setCurrentScreen('login');
  };

  const switchToSignup = () => {
    setCurrentScreen('signup');
  };

  const handleNavigateToContacts = () => {
    setCurrentScreen('contacts');
  };

  const handleNavigateToDisputes = () => {
    setCurrentScreen('disputes');
  };

  const handleBackToHome = () => {
    setCurrentScreen('home');
  };

  const handleCreateDispute = () => {
    setCurrentScreen('createDispute');
  };


  const handleViewDispute = (disputeId) => {
    setSelectedDisputeId(disputeId);
    setCurrentScreen('disputeDetail');
  };

  const handleBackToDisputes = () => {
    setCurrentScreen('disputes');
  };

  const handleDisputeCreated = () => {
    setCurrentScreen('disputes');
  };

  const handleDisputeUpdated = () => {
    // Could trigger a refresh of disputes list here if needed
    console.log('Dispute updated');
  };
 // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {currentScreen === 'signup' && (
        <SignupScreen 
          onSignupSuccess={handleSignupSuccess}
          onSwitchToLogin={switchToLogin}
        />
      )}
      {currentScreen === 'login' && (
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess}
          onSwitchToSignup={switchToSignup}
        />
      )}
      
      {currentScreen === 'home' && (
        <HomeScreen 
          user={user}
          token={token}
          onLogout={handleLogout}
          onNavigateToContacts={handleNavigateToContacts}
          onNavigateToDisputes={handleNavigateToDisputes}
        />
      )}
      {currentScreen === 'contacts' && (
        <ContactsScreen 
          token={token}
          onBack={handleBackToHome}
        />
      )}

      
      {currentScreen === 'disputes' && (
        <DisputesScreen 
          token={token}
          onBack={handleBackToHome}
          onCreateDispute={handleCreateDispute}
          onViewDispute={handleViewDispute}
        />
      )}

      {currentScreen === 'createDispute' && (
        <CreateDisputeScreen 
          token={token}
          onBack={handleBackToDisputes}
          onDisputeCreated={handleDisputeCreated}
        />
      )}

      {currentScreen === 'disputeDetail' && selectedDisputeId && (
        <DisputeDetailScreen 
          disputeId={selectedDisputeId}
          token={token}
          currentUserId={user?.id}
          onBack={handleBackToDisputes}
          onDisputeUpdated={handleDisputeUpdated}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F2ED',
  },
});

AppRegistry.registerComponent('main', () => App);

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  console.log('Mounting FairEnough app for web...');
  AppRegistry.runApplication('main', {
    rootTag: document.getElementById('root'),
  });
}

export default App;
