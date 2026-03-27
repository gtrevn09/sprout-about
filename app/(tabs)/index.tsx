//This is the landing page for the app, providing an introduction and navigation options to explore different 
// features.

import { ThemedText } from '@/components/themed-text'; // Importing a custom themed text component
import { ThemedView } from '@/components/themed-view'; // Importing a custom themed view component
import { Link } from 'expo-router'; //navigates to other screens in the app (expo-router is a routing library for React Native)
import React from 'react'; // Importing React to create components
import { StyleSheet } from 'react-native'; // Importing view, text, and StyleSheet to create styles for the components

// The styles for the home screen, defining layout and appearance of 
// the container and link.
//The 'styles' shapes the home screens layout and appearance
//
const styles = StyleSheet.create({ 
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  link: {
    color: 'blue',
    padding: 10,
  }
});

//HomeScreen adds the visual and interactive elements to the home page, including a welcome message and a link to open a modal.
export default function HomeScreen() {
  return (
    <ThemedView style={styles.container}> 
        <ThemedText type="title">Welcome to Sprout About!</ThemedText>
        <ThemedText type="subtitle">This is the home screen of the app.</ThemedText>
        <Link href="/modal" style={styles.link}>
            <ThemedText type="link">Let's get growing!</ThemedText>
        </Link>
    </ThemedView>

  );
}