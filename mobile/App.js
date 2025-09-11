import 'react-native-url-polyfill/auto';
import React, { useState, useEffect } from 'react';
import { StyleSheet, SafeAreaView, ActivityIndicator, View, Text, Platform, AppRegistry } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

const Stack = createNativeStackNavigator();

const STORAGE_KEYS = {
  USER: '@user_data',
  TOKEN: '@auth_token'
};

// Cross-platform storage utility
const Storage = {
  async getItem(key) {
    if (Platform.OS === 'web') {
      try {
        const value = localStorage.getItem(key);
        console.log(`Storage.getItem(${key}):`, value ? 'Found' : 'Not found');
        return value;
      } catch (e) {
        console.warn('localStorage not available:', e);
        return null;
      }
    } else {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return AsyncStorage.getItem(key);
    }
  },

  async setItem(key, value) {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(key, value);
        console.log(`Storage.setItem(${key}): Stored successfully`);
      } catch (e) {
        console.warn('localStorage not available:', e);
      }
    } else {
      AsyncStorage.setItem(key, value);
    }
  },

  async removeItem(key) {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(key);
        console.log(`Storage.removeItem(${key}): Removed successfully`);
      } catch (e) {
        console.warn('localStorage not available:', e);
      }
    } else {
      AsyncStorage.removeItem(key);
    }
  }
};

// Linking configuration for URL handling
const linking = {
  prefixes: ['http://localhost:19006', 'https://fairenough.netlify.app'],
  config: {
    screens: {
      Home: '/',
      Contacts: '/contacts',
      Disputes: '/disputes',
      CreateDispute: '/disputes/create',
      DisputeDetail: '/disputes/:disputeId',
      Login: '/login',
      Signup: '/signup',
    },
  },
};

 function App() {

  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);

  const [fontsLoaded] = useFonts({
    Merriweather_400Regular,
    Merriweather_700Bold,
    Merriweather_900Black,
    Lato_400Regular,
    Lato_700Bold,
  });


  // Check for stored authentication on app startup
  useEffect(() => {
    if (fontsLoaded){
      checkStoredAuth();
    }
  }, [fontsLoaded]);

 


  const checkStoredAuth = async () => {
    try {
      const [storedUser, storedToken] = await Promise.all([
        Storage.getItem(STORAGE_KEYS.USER),
        Storage.getItem(STORAGE_KEYS.TOKEN)
      ]);

      if (storedUser && storedToken) {
        const userData = JSON.parse(storedUser);
        
        // Optionally verify token is still valid by making a test API call
        // For now, we'll trust it's valid until it fails
        setUser(userData);
        setToken(storedToken);
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
      // If there's an error, clear any corrupted data
      await clearStoredAuth();
    } finally {
      setIsLoading(false);
      setIsReady(true);
    }
  };

  const storeAuth = async (userData, userToken) => {
    try {
      await Promise.all([
        Storage.setItem(STORAGE_KEYS.USER, JSON.stringify(userData)),
        Storage.setItem(STORAGE_KEYS.TOKEN, userToken)
      ]);
      console.log('Auth stored successfully');
      setUser(userData);
      setToken(userToken);
    } catch (error) {
      console.error('Error storing auth:', error);
    }
  };

  const clearStoredAuth = async () => {
    console.log('Clearing stored auth...');
    try {
      await Promise.all([
        Storage.removeItem(STORAGE_KEYS.USER),
        Storage.removeItem(STORAGE_KEYS.TOKEN)
      ]);
      console.log('Auth cleared successfully');
      setUser(null);
      setToken(null);
    } catch (error) {
      console.error('Error clearing stored auth:', error);
    }
  };


  if (!fontsLoaded || isLoading || !isReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          {!fontsLoaded ? 'Loading fonts...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          // Authenticated screens
          <>
            <Stack.Screen name="Home">
              {(props) => (
                <HomeScreen 
                  {...props}
                  user={user}
                  token={token}
                  onLogout={clearStoredAuth}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="Contacts">
              {(props) => (
                <ContactsScreen {...props} token={token} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Disputes">
              {(props) => (
                <DisputesScreen {...props} token={token} currentUserId={user?.id} />
              )}
            </Stack.Screen>
            <Stack.Screen name="CreateDispute">
              {(props) => (
                <CreateDisputeScreen {...props} token={token} />
              )}
            </Stack.Screen>
            <Stack.Screen name="DisputeDetail">
              {(props) => (
                <DisputeDetailScreen 
                  {...props} 
                  token={token}
                  currentUserId={user?.id}
                />
              )}
            </Stack.Screen>
          </>
        ) : (
          // Unauthenticated screens
          <>
            <Stack.Screen name="Login">
              {(props) => (
                <LoginScreen {...props} onLoginSuccess={storeAuth} />
              )}
            </Stack.Screen>
            <Stack.Screen name="Signup">
              {(props) => (
                <SignupScreen {...props} onSignupSuccess={storeAuth} />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}


const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F2ED',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
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
