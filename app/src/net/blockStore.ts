// E2 (Claude Sonnet): the app's block list, on the device and (when accounts are on) on the accounts server.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { accounts, accountsEnabled } from './accounts';
import { BlockList } from './blocks';

export const blockList = new BlockList(
  AsyncStorage,
  accountsEnabled()
    ? {
        list: () => accounts.getBlocks(),
        add: (id) => accounts.blockAccount(id),
        remove: (id) => accounts.unblockAccount(id),
      }
    : null,
);
