import React, { useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView, AppRegistry } from 'react-native';
import { 
  PlayfairDisplay_400Regular,
  PlayfairDisplay_500Medium,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_900Black,
} from '@expo-google-fonts/playfair-display';
import SignupScreen from './src/screens/SignupScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import DisputesScreen from './src/screens/DisputesScreen';
import CreateDisputeScreen from './src/screens/CreateDisputeScreen';
import DisputeDetailScreen from './src/screens/DisputeDetailScreen';


function App() {
  const [currentScreen, setCurrentScreen] = useState('signup'); // 'signup', 'login', 'home', 'contacts'
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [selectedDisputeId, setSelectedDisputeId] = useState(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync({
          PlayfairDisplay_400Regular,
          PlayfairDisplay_500Medium,
          PlayfairDisplay_600SemiBold,
          PlayfairDisplay_700Bold,
          PlayfairDisplay_900Black,
        });
        setFontsLoaded(true);
      } catch (error) {
        console.error('Error loading fonts:', error);
        setFontsLoaded(true); // Continue anyway with system fonts
      }
    }
    
    loadFonts();
  }, []);

  // Don't render app until fonts are loaded
  if (!fontsLoaded) {
    return null; // Or show a loading screen
  }


  const handleSignupSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setSelectedDisputeId(null);
    setCurrentScreen('home');
  };

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    setCurrentScreen('home');
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setSelectedDisputeId(null);
    setCurrentScreen('login');
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

export default App;
