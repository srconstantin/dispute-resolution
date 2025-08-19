export const theme = {
  colors: {
    primary: '#5A9B9E',      // Teal from logo
    primaryDark: '#4A8487',  // Darker teal
    background: '#F5F2ED',   // Muted cream background
    surface: '#FFFFFF',      // White cards/surfaces
    text: '#2C3E50',         // Dark blue-gray text
    textSecondary: '#7F8C8D', // Medium gray text
    textLight: '#95A5A6',    // Light gray text
    border: '#E8E4DB',       // Light border
    shadow: '#000000',       // Shadow color
    success: '#27AE60',      // Green for completed
    warning: '#F39C12',      // Orange for pending/invited
    error: '#E74C3C',        // Red for rejected
    cardBackground: '#F8F9FA' // Light card backgrounds
  },
  
  fonts: {
    // Playfair Display hierarchy
    displayLarge: 'PlayfairDisplay_900Black',
    heading: 'PlayfairDisplay_700Bold',
    headingMedium: 'PlayfairDisplay_600SemiBold',
    headingRegular: 'PlayfairDisplay_500Medium',
    body: 'PlayfairDisplay_400Regular',
    
    // Alternative: mix with system fonts for body text
    bodySystem: undefined, // Uses system font for readability
  },

  shadows: {
    small: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    large: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 8,
    }
  },
  
  borderRadius: {
    small: 8,
    medium: 12,
    large: 16,
    round: 999
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32
  }
};
