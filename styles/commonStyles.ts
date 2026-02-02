
import { StyleSheet } from 'react-native';

// Mastodon-inspired color palette
export const colors = {
  // Light theme
  light: {
    background: '#FFFFFF',
    card: '#F8F9FA',
    text: '#000000',
    textSecondary: '#6C757D',
    primary: '#6364FF',
    secondary: '#858AFA',
    accent: '#9D4EDD',
    border: '#E9ECEF',
    highlight: '#F0F0FF',
    success: '#2EC27E',
    error: '#E01E5A',
    warning: '#FFA500',
  },
  // Dark theme
  dark: {
    background: '#191B22',
    card: '#282C37',
    text: '#FFFFFF',
    textSecondary: '#9BAEC8',
    primary: '#858AFA',
    secondary: '#6364FF',
    accent: '#C77DFF',
    border: '#393F4F',
    highlight: '#2E3440',
    success: '#79BD9A',
    error: '#FF6B9D',
    warning: '#FFB347',
  },
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
