import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Amiri_400Regular, Amiri_700Bold } from '@expo-google-fonts/amiri';
import { Tajawal_400Regular, Tajawal_500Medium, Tajawal_700Bold } from '@expo-google-fonts/tajawal';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { AppProvider } from '../src/store/AppProvider';
import { AuthProvider } from '../src/store/AuthProvider';
import { configureNotificationHandler } from '../src/lib/notifications';
import { fonts } from '../src/theme/tokens';

configureNotificationHandler();

function RootNavigator() {
  const { colors, theme } = useTheme();

  // فتح المقولة مباشرة عند الضغط على الإشعار.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const itemId = response.notification.request.content.data?.itemId;
      if (typeof itemId === 'string' && itemId.length > 0) {
        router.push({ pathname: '/quote/[id]', params: { id: itemId } });
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.sansBold, fontSize: 17 },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="quote/[id]" options={{ title: 'النص' }} />
        <Stack.Screen name="scholars" options={{ title: 'العلماء' }} />
        <Stack.Screen name="sources" options={{ title: 'المصادر' }} />
        <Stack.Screen name="about" options={{ title: 'عن التطبيق' }} />
        <Stack.Screen name="admin/index" options={{ title: 'لوحة الأدمن' }} />
      </Stack>
    </>
  );
}

function Splash() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Amiri_400Regular,
    Amiri_700Bold,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
  });

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          {!fontsLoaded ? (
            <Splash />
          ) : (
            <AuthProvider>
              <AppProvider>
                <RootNavigator />
              </AppProvider>
            </AuthProvider>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
