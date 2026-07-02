// 루트 앱 — 익명 로그인으로 userId 확보 후 네비게이션 구성
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { RootStackParamList } from './src/mobile/navigation.ts';
import { getSupabase } from './src/mobile/supabase.ts';
import { TimelineRoute } from './src/mobile/screens/TimelineRoute.tsx';
import { TripDetailRoute } from './src/mobile/screens/TripDetailRoute.tsx';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabase();
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          setUserId(data.session.user.id);
          return;
        }
        // MVP: 익명 로그인으로 RLS용 userId 확보 (추후 이메일/소셜 전환)
        const { data: anon, error: anonErr } =
          await supabase.auth.signInAnonymously();
        if (anonErr) throw anonErr;
        setUserId(anon.user?.id ?? null);
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{error}</Text>
        <Text style={styles.hint}>
          app.json의 expo.extra에 Supabase URL/Key를 설정했는지 확인하세요.
        </Text>
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator>
          <Stack.Screen name="Timeline" options={{ title: '여행 기록' }}>
            {(props) => <TimelineRoute {...props} userId={userId} />}
          </Stack.Screen>
          <Stack.Screen
            name="TripDetail"
            component={TripDetailRoute}
            options={{ title: '' }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  err: { color: '#c0392b', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  hint: { color: '#888', fontSize: 13, textAlign: 'center' },
});
