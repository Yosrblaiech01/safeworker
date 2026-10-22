import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DarkTheme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts, SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';

import { supabase } from './src/lib/supabase';
import { COLORS } from './src/theme';
import { AlertProvider } from './src/alerts/AlertProvider';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import SensorDetailScreen from './src/screens/SensorDetailScreen';

const Stack = createNativeStackNavigator();
const navigationRef = createNavigationContainerRef();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: COLORS.bg, card: COLORS.bg, primary: COLORS.accent },
};

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = vérification en cours
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null)).catch(() => setSession(null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined || !fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  }

  const stack = (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: COLORS.bg } }}
    >
      {session ? (
        <>
          <Stack.Screen name="Home" component={HomeScreen} options={{ animation: 'fade' }} />
          <Stack.Screen name="Sensor" component={SensorDetailScreen} />
        </>
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        {session ? (
          <AlertProvider
            onOpenSensor={(key) => navigationRef.isReady() && navigationRef.navigate('Sensor', { key })}
          >
            {stack}
          </AlertProvider>
        ) : (
          stack
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
