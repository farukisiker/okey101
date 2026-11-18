// Apple / Google sign-in on the device. Native modules are loaded lazily so tests (and a build that
// lacks a module) never crash; no React Native import here, so vitest runs it in Node (the app instance is signInApp.ts). A missing module simply means that button is hidden.
import type { AccountsClient, AuthResult } from './accountsClient';

export type SignInOutcome = { kind: 'done'; result: AuthResult } | { kind: 'cancelled' };

export interface SignInEnv {
  os: string;
  googleWebClientId?: string;
  googleIosClientId?: string;
}

export interface AppleCredential {
  identityToken: string | null;
  authorizationCode: string | null;
  fullName: { givenName?: string | null; familyName?: string | null } | null;
}

export interface SignInNative {
  apple: { isAvailableAsync(): Promise<boolean>; signInAsync(): Promise<AppleCredential> } | null;
  google: {
    configure(o: { webClientId?: string; iosClientId?: string }): void;
    signIn(): Promise<{ type: string; data: { idToken: string | null } | null }>;
    signOut(): Promise<unknown>;
    revokeAccess(): Promise<unknown>;
  } | null;
}

const hasCode = (e: unknown, ...codes: string[]) =>
  typeof e === 'object' && e !== null && 'code' in e && codes.includes(String((e as { code: unknown }).code));

function loadNative(os: string): SignInNative {
  let apple: SignInNative['apple'] = null;
  let google: SignInNative['google'] = null;
  if (os === 'ios') {
    try {
      const A = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
      apple = {
        isAvailableAsync: () => A.isAvailableAsync(),
        signInAsync: () => A.signInAsync({ requestedScopes: [A.AppleAuthenticationScope.FULL_NAME] }),
      };
    } catch {
      apple = null;
    }
  }
  try {
    google = (require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin')).GoogleSignin;
  } catch {
    google = null;
  }
  return { apple, google };
}

export function createSignIn(env: SignInEnv, nativeIn?: SignInNative) {
  let loaded: SignInNative | null = nativeIn ?? null;
  const native = (): SignInNative => (loaded ??= loadNative(env.os));
  let configured = false;
  const googleOn = () => !!env.googleWebClientId && !!native().google;

  function configureGoogle() {
    if (configured) return;
    native().google!.configure({ webClientId: env.googleWebClientId, iosClientId: env.googleIosClientId });
    configured = true;
  }

  return {
    /** Which buttons the profile screen may show. Apple only on iOS; Google needs the web client id. */
    async available(): Promise<{ apple: boolean; google: boolean }> {
      let apple = false;
      const a = native().apple;
      if (env.os === 'ios' && a) apple = await a.isAvailableAsync().catch(() => false);
      return { apple, google: googleOn() };
    },

    async apple(client: Pick<AccountsClient, 'signInApple'>): Promise<SignInOutcome> {
      const a = native().apple;
      if (env.os !== 'ios' || !a) return { kind: 'cancelled' };
      let cred: AppleCredential;
      try {
        cred = await a.signInAsync();
      } catch (e) {
        if (hasCode(e, 'ERR_REQUEST_CANCELED')) return { kind: 'cancelled' };
        throw e;
      }
      if (!cred.identityToken) throw new Error('no identity token');
      const fullName = [cred.fullName?.givenName, cred.fullName?.familyName].filter(Boolean).join(' ');
      const result = await client.signInApple({
        identityToken: cred.identityToken,
        authorizationCode: cred.authorizationCode,
        fullName: fullName || null,
      });
      return { kind: 'done', result };
    },

    async google(client: Pick<AccountsClient, 'signInGoogle'>): Promise<SignInOutcome> {
      if (!googleOn()) return { kind: 'cancelled' };
      configureGoogle();
      let res: Awaited<ReturnType<NonNullable<SignInNative['google']>['signIn']>>;
      try {
        res = await native().google!.signIn();
      } catch (e) {
        if (hasCode(e, 'SIGN_IN_CANCELLED', '12501', '-5')) return { kind: 'cancelled' };
        throw e;
      }
      if (res.type !== 'success') return { kind: 'cancelled' };
      const idToken = res.data?.idToken;
      if (!idToken) throw new Error('no id token');
      return { kind: 'done', result: await client.signInGoogle(idToken) };
    },

    /** On account deletion: forget Google's grant on this device. Errors are swallowed. */
    async googleForget(): Promise<void> {
      try {
        if (!googleOn()) return;
        configureGoogle();
        await native().google!.revokeAccess();
      } catch {
        // not signed in with Google, or the grant is already gone
      }
      try {
        if (googleOn()) await native().google!.signOut();
      } catch {
        // same
      }
    },
  };
}
