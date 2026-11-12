import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, processLock, type SupportedStorage } from '@supabase/supabase-js';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';

import { apiEnabled, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';

/**
 * Session storage for phones. A Supabase session is larger than SecureStore safely holds, so each
 * value is sealed with AES-GCM: the ciphertext goes to AsyncStorage and its key to SecureStore
 * (the Keychain on iOS, the Keystore on Android). A fresh key is made on every write.
 */
class LargeSecureStore implements SupportedStorage {
  private readonly encoder = new TextEncoder();
  private readonly decoder = new TextDecoder();

  async getItem(key: string): Promise<string | null> {
    const sealed = await AsyncStorage.getItem(key);
    if (!sealed) return null;
    const keyHex = await SecureStore.getItemAsync(secureKeyName(key));
    if (!keyHex) return null;
    try {
      const aesKey = await AESEncryptionKey.import(keyHex, 'hex');
      const bytes = await aesDecryptAsync(AESSealedData.fromCombined(sealed), aesKey, { output: 'bytes' });
      return this.decoder.decode(bytes);
    } catch (error) {
      // A key and ciphertext that no longer match (e.g. a write interrupted halfway) mean "signed out".
      console.warn('[auth] Could not read the saved session; signing in again is required.', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    const aesKey = await AESEncryptionKey.generate();
    const sealed = await aesEncryptAsync(this.encoder.encode(value), aesKey);
    await SecureStore.setItemAsync(secureKeyName(key), await aesKey.encoded('hex'));
    await AsyncStorage.setItem(key, await sealed.combined('base64'));
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(secureKeyName(key));
  }
}

/** SecureStore keys may only hold letters, digits, `.`, `-` and `_`. */
function secureKeyName(key: string): string {
  return `hf.${key.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

const isNative = Platform.OS !== 'web';

function createSupabase() {
  const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      // The web build keeps the default, localStorage.
      storage: isNative ? new LargeSecureStore() : undefined,
      autoRefreshToken: true,
      persistSession: true,
      // Sign-in is email and password, so no session ever arrives in a URL.
      detectSessionInUrl: false,
      lock: isNative ? processLock : undefined,
    },
  });

  if (isNative) {
    // Refresh tokens only while the app is in the foreground.
    AppState.addEventListener('change', (state) => {
      if (state === 'active') void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
  }
  return client;
}

/** The Supabase client, or `null` in mock mode (no backend configured). */
export const supabase = apiEnabled ? createSupabase() : null;
