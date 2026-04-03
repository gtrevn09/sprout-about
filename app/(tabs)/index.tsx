//This is the landing page for the app, providing an introduction and navigation options to explore different 
// features.

import { ThemedText } from '@/components/themed-text'; // Importing a custom themed text component
import { ThemedView } from '@/components/themed-view'; // Importing a custom themed view component
import { Link } from 'expo-router'; //navigates to other screens in the app (expo-router is a routing library for React Native)
import React from 'react'; // Importing React to create components
import { Button, ImageBackground, StyleSheet, View } from 'react-native'; // Importing view, text, and StyleSheet to create styles for the components

// The styles for the home screen, defining layout and appearance of 
// the container and link.
//The 'styles' shapes the home screens layout and appearance
//
const styles = StyleSheet.create({ 
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  link: {
    color: 'limegreen',
    padding: 10,
    textDecorationLine: 'underline',
  }
});

//HomeScreen adds the visual and interactive elements to the home page, including a welcome message and a link to open a modal.
export default function HomeScreen() {
  return (
    <ImageBackground
      source={require('@/assets/images/sprout-about.png')} // Background image for the home screen
      style={styles.background}
      resizeMode="cover"
    >
  
    
    <ThemedView style={styles.container}> 
        <ThemedText type="title">Welcome to Sprout About!</ThemedText>
        <ThemedText type="subtitle">Watch your dreams take root!</ThemedText>
        <View style={{ padding: 20, borderWidth: 1, borderColor: 'black' }}>
          <Button title="Log in" onPress={() => {}} /> {/* Placeholder for future functionality */}
        </View>
        
        <Button title="Sign up" onPress={() => {}} /> {/* Placeholder for future functionality */}
        <Link href="/modal" style={styles.link}>
            <ThemedText type="link" style={styles.link}>  {/*in line style override it works but fix this!*/}
              Let's get growing! 
            </ThemedText>
        </Link>
    </ThemedView>
    </ImageBackground>
  );
}