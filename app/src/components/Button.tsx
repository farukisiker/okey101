import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors } from '../theme';

interface Props {
  title: string;
  onPress(): void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'success';
  size?: 'normal' | 'large';
  /** Small second line under the title, e.g. "21 sayı daha". */
  subtitle?: string;
  style?: ViewStyle;
}

/** Big, high-contrast buttons: at least 56pt tall, 20pt text. */
export function Button({ title, onPress, disabled, variant = 'primary', size = 'normal', subtitle, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        size === 'large' && styles.large,
        variant === 'secondary' && styles.secondary,
        variant === 'success' && styles.success,
        disabled && styles.disabled,
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          size === 'large' && styles.largeText,
          (variant === 'secondary' || disabled) && { color: colors.text },
        ]}
        numberOfLines={1}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, (variant === 'secondary' || disabled) && { color: colors.muted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.accent,
    minHeight: 56,
    minWidth: 88,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  large: { minHeight: 76, minWidth: 280, borderRadius: 16 },
  secondary: { backgroundColor: 'rgba(0,0,0,0.2)', borderColor: colors.muted },
  success: { backgroundColor: colors.ok },
  // Disabled stays readable: dimmed, but with an outline instead of fading away.
  disabled: { opacity: 0.75, backgroundColor: 'rgba(0,0,0,0.25)', borderColor: 'rgba(169,194,182,0.6)' },
  text: { color: '#2b1d00', fontWeight: '800', fontSize: 20 },
  largeText: { fontSize: 30, fontWeight: '900' },
  subtitle: { color: '#2b1d00', fontSize: 13, fontWeight: '600', marginTop: -1 },
});
