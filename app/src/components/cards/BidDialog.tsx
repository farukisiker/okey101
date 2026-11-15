import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme';
import { t } from '../../i18n';
import { Button } from '../Button';
import type { BidDialogProps } from './fakeTypes';

/**
 * Batak bidding dialog:
 * Large numbers (4..13) and Pass button adhering to 60+ touch ergonomics (>= 56 dp).
 */
export function BidDialog({
  visible,
  minBid,
  highestBid,
  highestBidderName,
  canPass,
  scale,
  onBid,
  onPass,
}: BidDialogProps) {
  if (!visible) return null;

  const startBid = Math.min(minBid, 5);
  const bids: number[] = [];
  for (let b = startBid; b <= 13; b++) {
    bids.push(b);
  }

  const s = Math.max(1, scale);
  const btnSize = Math.max(56, Math.round(52 * s));
  const cardWidth = Math.min(680, Math.round(540 * s));

  return (
    <View style={styles.overlay}>
      <View style={[styles.card, { width: cardWidth }]}>
        <Text style={[styles.title, { fontSize: Math.round(font.title * s * 0.9) }]}>
          {t('batakBidTitle')}
        </Text>

        <Text style={[styles.status, { fontSize: Math.round(font.body * s) }]}>
          {highestBid > 0 && highestBidderName
            ? t('batakCurrentBid', { name: highestBidderName, n: highestBid })
            : t('batakNoBidYet', { n: minBid })}
        </Text>

        {/* 2-row grid of numbers */}
        <View style={styles.grid}>
          {bids.map((b) => {
            const isLegal = b > highestBid && b >= minBid;
            return (
              <Button
                key={b}
                title={String(b)}
                onPress={() => onBid(b)}
                disabled={!isLegal}
                variant={isLegal ? 'primary' : 'secondary'}
                style={{
                  ...styles.bidBtn,
                  width: btnSize,
                  height: btnSize,
                  minWidth: btnSize,
                  minHeight: btnSize,
                }}
              />
            );
          })}
        </View>

        {/* Pass action */}
        <View style={styles.actionRow}>
          <Button
            title={t('batakPass')}
            onPress={onPass}
            disabled={!canPass}
            variant="secondary"
            style={{ ...styles.passBtn, minWidth: Math.round(180 * s), minHeight: btnSize }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    backgroundColor: colors.feltLight,
    borderColor: colors.wood,
    borderWidth: 3,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
  },
  title: {
    color: colors.text,
    fontWeight: '900',
    textAlign: 'center',
  },
  status: {
    color: colors.accent,
    fontWeight: '700',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginVertical: 4,
  },
  bidBtn: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  actionRow: {
    marginTop: 8,
  },
  passBtn: {
    borderColor: colors.muted,
  },
});
