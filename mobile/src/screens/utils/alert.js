import { Alert, Platform } from 'react-native';

export const showAlert = (title, message) => {
  if (Platform.OS === 'web') {
    // Web browser
    window.alert(`${title}: ${message}`);
  } else {
    // Mobile (iOS/Android)
    Alert.alert(title, message);
  }
};

export const showSuccess = (message) => {
  showAlert('Success', message);
};

export const showError = (message) => {
  showAlert('Error', message);
};

// For confirmation dialogs on mobile (web will just use window.confirm)
export const showConfirm = (title, message, onConfirm, onCancel) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}: ${message}`)) {
      onConfirm?.();
    } else {
      onCancel?.();
    }
  } else {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'OK', onPress: onConfirm }
      ]
    );
  }
};