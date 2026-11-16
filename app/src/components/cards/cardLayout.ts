import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type CardGameLayout, computeCardLayout } from './computeCardLayout';

export { computeCardLayout };
export type { CardGameLayout };

export function useCardLayout(handCount = 4): CardGameLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return computeCardLayout(width, height, {
    left: insets.left,
    right: insets.right,
    top: insets.top,
    bottom: insets.bottom,
  }, handCount);
}
