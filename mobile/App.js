import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, AppRegistry } from 'react-native';
import SignupScreen from './src/screens/SignupScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ContactsScreen from './src/screens/ContactsScreen';

function App() {
  const [currentScreen, setCurrentScreen] = useState('signup'); // 'signup', 'login', 'home', 'contacts'
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);



  const handleSignupSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
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

  const handleBackToHome = () => {
    setCurrentScreen('home');
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
        />
      )}
      {currentScreen === 'contacts' && (
        <ContactsScreen 
          token={token}
          onBack={handleBackToHome}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

AppRegistry.registerComponent('main', () => App);

export default App;
