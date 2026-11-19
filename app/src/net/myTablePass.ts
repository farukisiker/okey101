import { accounts, accountsEnabled } from './accounts';

/** E2b: the signed table pass sent with room:create / join / quickPlay / handshake; null if unavailable (then I sit as a guest). */
export async function myTablePass(): Promise<string | null> {
  if (!accountsEnabled()) return null;
  return Promise.race([accounts.tablePass(), new Promise<null>((r) => setTimeout(() => r(null), 1500))]).catch(() => null);
}
