// Supabase 클라이언트 초기화
// app.json > expo.extra 에서 URL/Key를 읽음 (실제 값은 배포 환경에서 주입).
import 'react-native-url-polyfill/auto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = extra.supabaseUrl;
  const key = extra.supabaseAnonKey;
  if (!url || !key) {
    throw new Error(
      'Supabase 설정 누락: app.json > expo.extra.supabaseUrl / supabaseAnonKey 를 채우세요.',
    );
  }
  client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return client;
}
