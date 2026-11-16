import { StyleSheet, Text, View } from 'react-native';
import { colors, font } from '../../theme';
import { t } from '../../i18n';
import { Button } from '../Button';
import type { BidDialogProps } from './fakeTypes';

/**
 * Batak bidding dialog (B11): a compact strip above the hand, no dimming backdrop, so the player can read the
 * cards while bidding. Numbers (4..13) and Pass in one row, buttons >= 56 dp, text >= 15 pt.
 */
export function BidDialog({
  visible,
  minBid,
  highestBid,
  highestBidderName,
  canPass,
  scale,
  reserveBottom = 0,
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
  const status =
    highestBid > 0 && highestBidderName
      ? t('batakCurrentBid', { name: highestBidderName, n: highestBid })
      : t('batakNoBidYet', { n: minBid });

  // box-none: touches outside the compact card go to the screen underneath (action bar, hand).
  return (
    <View style={[styles.overlay, { bottom: reserveBottom }]} pointerEvents="box-none">
      <View style={styles.card}>
        <Text style={[styles.status, { fontSize: Math.max(15, Math.round(font.body * Math.min(s, 1.2))) }]} numberOfLines={1}>
          {`${t('batakBidTitle')} · ${status}`}
        </Text>

        <View style={styles.row}>
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
          <Button
            title={t('batakPass')}
            onPress={onPass}
            disabled={!canPass}
            variant="secondary"
            style={{ ...styles.passBtn, minWidth: Math.round(96 * s), minHeight: btnSize }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 6,
    zIndex: 1000,
  },
  card: {
    backgroundColor: colors.feltLight,
    borderColor: colors.wood,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 4,
    maxWidth: '98%',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 10,
  },
  status: {
    color: colors.accent,
    fontWeight: '800',
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  bidBtn: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  passBtn: {
    borderColor: colors.muted,
    paddingHorizontal: 10,
  },
});
