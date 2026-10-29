import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../theme';
import { Button } from './Button';

interface Props {
  message: string;
  confirm: string;
  cancel: string;
  onConfirm(): void;
  onCancel(): void;
}

/** Large two-button question. Tapping outside does nothing, so it can't be dismissed by accident. */
export function ConfirmDialog({ message, confirm, cancel, onConfirm, onCancel }: Props) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.row}>
          <Button title={cancel} onPress={onCancel} style={{ minWidth: 160 }} />
          <Button title={confirm} variant="secondary" onPress={onConfirm} style={{ minWidth: 160 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: { backgroundColor: colors.feltLight, borderRadius: 16, padding: 24, gap: 24, alignItems: 'center', maxWidth: 520 },
  message: { color: colors.text, fontSize: font.status, fontWeight: '700', textAlign: 'center' },
  row: { flexDirection: 'row', gap: 24 },
});
