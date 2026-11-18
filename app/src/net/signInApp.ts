import { Platform } from 'react-native';
import { createSignIn } from './signIn';

/** The app's sign-in helper. Google needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID; iOS also takes EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID. */
export const signIn = createSignIn({
  os: Platform.OS,
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
});
