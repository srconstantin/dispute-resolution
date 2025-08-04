import React, { useState } from 'react';
import { StyleSheet, SafeAreaView, AppRegistry } from 'react-native';
import SignupScreen from './src/screens/SignupScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';

function App() {
  const [currentScreen, setCurrentScreen] = useState('signup'); // 'signup', 'login', 'home'
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
          onLogout={handleLogout}
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
