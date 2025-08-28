import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { loginUser } from '../services/api';
import { theme } from '../styles/theme';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';

export default function LoginScreen({ onLoginSuccess, onSwitchToSignup }) {
  const { toast, showSuccess, showError, hideToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    console.log('🟢 BUTTON WAS PRESSED!');
    if (!email || !password) {
      console.log('🟡 Missing fields');
      showError('Please fill in all fields');
      return;
    }

    console.log('🟢 About to start login process');

    setLoading(true);
    try {
      console.log('=== ATTEMPTING LOGIN ===');
      console.log('Email:', email);
      console.log('Password length:', password.length);
      const result = await loginUser({ email, password });
      console.log('Login successful:', result);
      
      onLoginSuccess(result.user, result.token);
      
      setEmail('');
      setPassword('');
    } catch (error) {
      console.log('Login error:', error);
      showError( error.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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
        <View style={styles.content}>
          <Text style={styles.title}>Welcome Back</Text>
        
          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
          />
        
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? 'Logging in...' : 'Log In'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.switchButton}
            onPress={onSwitchToSignup}
          >
            <Text style={styles.switchText}>
              Don't have an account? Sign up
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  title: {
    fontSize: 32,
    fontFamily: theme.fonts.heading,
    textAlign: 'center',
    marginBottom: 40,
    color: theme.colors.text,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.small,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    fontFamily: theme.fonts.body,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.small,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
    ...theme.shadows.small,
  },
  buttonDisabled: {
    backgroundColor: theme.colors.textLight,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: theme.fonts.headingMedium,
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontFamily: theme.fonts.headingRegular,
  },
});