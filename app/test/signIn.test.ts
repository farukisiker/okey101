import { describe, expect, it, vi } from 'vitest';
import { en } from '../src/i18n/locales/en';
import { tr } from '../src/i18n/tr';
import type { AuthResult } from '../src/net/accountsClient';
import { type SignInNative, createSignIn } from '../src/net/signIn';

const result = (o: Partial<AuthResult> = {}): AuthResult => ({ accountId: 'a', token: 't', switched: false, ...o });

function natives(over: Partial<{ appleOk: boolean; appleErr: unknown; googleRes: unknown; googleErr: unknown }> = {}) {
  const google = {
    configure: vi.fn(),
    signIn: vi.fn(async () => {
      if (over.googleErr) throw over.googleErr;
      return (over.googleRes ?? { type: 'success', data: { idToken: 'gid' } }) as { type: string; data: { idToken: string | null } | null };
    }),
    signOut: vi.fn(async () => null),
    revokeAccess: vi.fn(async () => null),
  };
  const apple = {
    isAvailableAsync: vi.fn(async () => over.appleOk ?? true),
    signInAsync: vi.fn(async (_o?: { nonce?: string }) => {
      if (over.appleErr) throw over.appleErr;
      return { identityToken: 'idt', authorizationCode: 'code', fullName: { givenName: 'Ayşe', familyName: 'Y' } };
    }),
  };
  return { google, apple, native: { apple, google } as SignInNative };
}

describe('sign-in availability', () => {
  it('iOS: Apple when the device allows it, Google when the web client id is set', async () => {
    const n = natives();
    expect(await createSignIn({ os: 'ios', googleWebClientId: 'web' }, n.native).available()).toEqual({ apple: true, google: true });
    expect(await createSignIn({ os: 'ios' }, n.native).available()).toEqual({ apple: true, google: false });
    const off = natives({ appleOk: false });
    expect((await createSignIn({ os: 'ios', googleWebClientId: 'w' }, off.native).available()).apple).toBe(false);
  });

  it('Android: never Apple; Google hidden without the web client id', async () => {
    const n = natives();
    expect(await createSignIn({ os: 'android', googleWebClientId: 'w' }, n.native).available()).toEqual({ apple: false, google: true });
    expect(await createSignIn({ os: 'android' }, n.native).available()).toEqual({ apple: false, google: false });
    expect(n.apple.isAvailableAsync).not.toHaveBeenCalled();
  });

  it('a missing native module hides the button instead of crashing', async () => {
    const s = createSignIn({ os: 'ios', googleWebClientId: 'w' }, { apple: null, google: null });
    expect(await s.available()).toEqual({ apple: false, google: false });
    expect(await s.google({ signInGoogle: vi.fn() })).toEqual({ kind: 'cancelled' });
  });
});

describe('Apple flow', () => {
  it('fetches a nonce first, passes it to Apple and sends token, code, joined name and nonce to the client', async () => {
    const n = natives();
    const order: string[] = [];
    const client = {
      appleNonce: vi.fn(async () => {
        order.push('nonce');
        return 'N1';
      }),
      signInApple: vi.fn(async () => {
        order.push('server');
        return result({ switched: true });
      }),
    };
    n.apple.signInAsync.mockImplementationOnce(async (o?: { nonce?: string }) => {
      order.push('apple:' + o?.nonce);
      return { identityToken: 'idt', authorizationCode: 'code', fullName: { givenName: 'Ayşe', familyName: 'Y' } };
    });
    const out = await createSignIn({ os: 'ios' }, n.native).apple(client);
    expect(order).toEqual(['nonce', 'apple:N1', 'server']);
    expect(client.signInApple).toHaveBeenCalledWith({ identityToken: 'idt', authorizationCode: 'code', fullName: 'Ayşe Y', nonce: 'N1' });
    expect(out).toEqual({ kind: 'done', result: result({ switched: true }) });
  });

  it('an older server without the nonce endpoint (null) signs in without a nonce', async () => {
    const n = natives();
    const client = { appleNonce: vi.fn(async () => null), signInApple: vi.fn(async () => result()) };
    await createSignIn({ os: 'ios' }, n.native).apple(client);
    expect(n.apple.signInAsync).toHaveBeenCalledWith(undefined);
    expect(client.signInApple).toHaveBeenCalledWith(expect.objectContaining({ nonce: null }));
  });

  it('a failed nonce fetch stops before the Apple sheet opens', async () => {
    const n = natives();
    const client = { appleNonce: vi.fn(async (): Promise<string | null> => Promise.reject(new Error('network'))), signInApple: vi.fn() };
    await expect(createSignIn({ os: 'ios' }, n.native).apple(client)).rejects.toThrow('network');
    expect(n.apple.signInAsync).not.toHaveBeenCalled();
    expect(client.signInApple).not.toHaveBeenCalled();
  });

  it('a cancelled sheet is not an error and calls no server', async () => {
    const client = { appleNonce: vi.fn(async () => 'N'), signInApple: vi.fn() };
    const out = await createSignIn({ os: 'ios' }, natives({ appleErr: { code: 'ERR_REQUEST_CANCELED' } }).native).apple(client);
    expect(out).toEqual({ kind: 'cancelled' });
    expect(client.signInApple).not.toHaveBeenCalled();
  });

  it('other native errors are thrown', async () => {
    const s = createSignIn({ os: 'ios' }, natives({ appleErr: { code: 'ERR_REQUEST_FAILED' } }).native);
    await expect(s.apple({ appleNonce: vi.fn(async () => 'N'), signInApple: vi.fn() })).rejects.toBeDefined();
  });
});

describe('Google flow', () => {
  it('configures once with both client ids and sends the id token', async () => {
    const n = natives();
    const client = { signInGoogle: vi.fn(async () => result()) };
    const s = createSignIn({ os: 'ios', googleWebClientId: 'web', googleIosClientId: 'ios' }, n.native);
    await s.google(client);
    await s.google(client);
    expect(n.google.configure).toHaveBeenCalledTimes(1);
    expect(n.google.configure).toHaveBeenCalledWith({ webClientId: 'web', iosClientId: 'ios' });
    expect(client.signInGoogle).toHaveBeenCalledWith('gid');
  });

  it('cancellation (response or error code) is quiet', async () => {
    const cases = [{ googleRes: { type: 'cancelled', data: null } }, { googleErr: { code: '12501' } }, { googleErr: { code: 'SIGN_IN_CANCELLED' } }];
    for (const o of cases) {
      const client = { signInGoogle: vi.fn() };
      const out = await createSignIn({ os: 'android', googleWebClientId: 'w' }, natives(o).native).google(client);
      expect(out).toEqual({ kind: 'cancelled' });
      expect(client.signInGoogle).not.toHaveBeenCalled();
    }
  });

  it('a success without an id token is an error; no web client id means no call', async () => {
    const bad = natives({ googleRes: { type: 'success', data: { idToken: null } } });
    const s = createSignIn({ os: 'android', googleWebClientId: 'w' }, bad.native);
    await expect(s.google({ signInGoogle: vi.fn() })).rejects.toBeDefined();
    const n = natives();
    expect(await createSignIn({ os: 'android' }, n.native).google({ signInGoogle: vi.fn() })).toEqual({ kind: 'cancelled' });
    expect(n.google.signIn).not.toHaveBeenCalled();
  });

  it('forget revokes then signs out and swallows errors', async () => {
    const n = natives();
    n.google.revokeAccess.mockRejectedValueOnce(new Error('nope'));
    await createSignIn({ os: 'android', googleWebClientId: 'w' }, n.native).googleForget();
    expect(n.google.revokeAccess).toHaveBeenCalled();
    expect(n.google.signOut).toHaveBeenCalled();
  });
});

describe('sign-in texts', () => {
  it('exist in tr and en', () => {
    const keys = ['profKeepTitle', 'profKeepBody', 'profGoogle', 'profLinkedApple', 'profLinkedGoogle', 'profSwitched', 'profErrLinked', 'profErrToken', 'profErrSignInOff'] as const;
    for (const k of keys) {
      expect(tr[k]).toBeTruthy();
      expect(en[k]).toBeTruthy();
    }
  });
});
