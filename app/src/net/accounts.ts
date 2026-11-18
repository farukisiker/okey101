import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAccountsClient } from './accountsClient';

/** The app's accounts client. Off (accountsEnabled() === false) when EXPO_PUBLIC_ACCOUNTS_URL is unset. */
export const accounts = createAccountsClient({
  baseUrl: process.env.EXPO_PUBLIC_ACCOUNTS_URL,
  storage: AsyncStorage,
});

export const accountsEnabled = () => accounts.enabled();
