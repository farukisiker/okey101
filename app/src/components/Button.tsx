import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { colors } from '../theme';

interface Props {
  title: string;
  onPress(): void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
}

export function Button({ title, onPress, disabled, variant = 'primary', style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'secondary' && styles.secondary,
        disabled && styles.disabled,
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Text style={[styles.text, variant === 'secondary' && { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.muted },
  disabled: { opacity: 0.4 },
  text: { color: '#2b1d00', fontWeight: '800', fontSize: 14 },
});
