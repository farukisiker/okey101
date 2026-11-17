import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors } from '../../theme';

export interface ActionButtonProps {
  title: string;
  onPress(): void;
  disabled?: boolean;
  /** The one highlighted action. */
  primary?: boolean;
  /** Dp height, at least 56. */
  height?: number;
  style?: ViewStyle;
}

/** Big button for Geri al / Tamam / Pas: ≥ 56 dp tall, 20 pt text, up to two lines (the long Pas text). */
export function ActionButton({ title, onPress, disabled, primary, height = 64, style }: ActionButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        { minHeight: Math.max(56, height) },
        primary ? styles.primary : styles.secondary,
        disabled && styles.disabled,
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Text style={[styles.text, primary ? styles.textPrimary : styles.textSecondary]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  primary: { backgroundColor: colors.accent, borderColor: '#fff3c9' },
  secondary: { backgroundColor: colors.feltLight, borderColor: colors.muted },
  disabled: { opacity: 0.4 },
  text: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  textPrimary: { color: '#1d1209' },
  textSecondary: { color: colors.text },
});
