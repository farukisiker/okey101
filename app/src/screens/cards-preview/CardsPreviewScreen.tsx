import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, font } from '../../theme';
import { type Key, t } from '../../i18n';
import {
  CardBack,
  CardView,
  createDeck,
} from '../../components/cards';
import type { BatakAction, BatakView, PistiAction, PistiView } from '@kahve/catalog';
import { PistiScreen } from '../PistiScreen';
import { BatakScreen } from '../BatakScreen';
import {
  mockBatakBiddingMyTurn,
  mockBatakFinished,
  mockBatakPlayingMyTurn,
  mockBatakTrumpSelection,
  mockPisti2PlayerInitial,
  mockPistiCelebration,
  mockPistiFinished,
  mockPistiOpportunity,
} from './mockData';

type PreviewMode =
  | 'pisti-init'
  | 'pisti-opp'
  | 'pisti-celeb'
  | 'pisti-done'
  | 'batak-bid'
  | 'batak-trump'
  | 'batak-play'
  | 'batak-done'
  | 'gallery';

interface ScenarioTab {
  id: PreviewMode;
  labelKey: Key;
}

const TABS: ScenarioTab[] = [
  { id: 'pisti-init', labelKey: 'cardsPreviewPistiInit' },
  { id: 'pisti-opp', labelKey: 'cardsPreviewPistiOpp' },
  { id: 'pisti-celeb', labelKey: 'cardsPreviewPistiCeleb' },
  { id: 'pisti-done', labelKey: 'cardsPreviewPistiDone' },
  { id: 'batak-bid', labelKey: 'cardsPreviewBatakBid' },
  { id: 'batak-trump', labelKey: 'cardsPreviewBatakTrump' },
  { id: 'batak-play', labelKey: 'cardsPreviewBatakPlay' },
  { id: 'batak-done', labelKey: 'cardsPreviewBatakDone' },
  { id: 'gallery', labelKey: 'cardsPreviewGalleryTab' },
];

/**
 * Developer preview screen to inspect and test all Pişti and Batak UI states.
 */
export function CardsPreviewScreen() {
  const [tab, setTab] = useState<PreviewMode>('pisti-init');

  // Interactive local states for testing card play
  const [pistiView, setPistiView] = useState<PistiView>(mockPisti2PlayerInitial);
  const [batakView, setBatakView] = useState<BatakView>(mockBatakPlayingMyTurn);

  const handlePistiAction = (action: PistiAction) => {
    if (action.type === 'play') {
      const playedCard = pistiView.hand.find((c) => c.id === action.cardId);
      if (!playedCard) return;
      setPistiView((prev) => ({
        ...prev,
        hand: prev.hand.filter((c) => c.id !== action.cardId),
        topCard: playedCard,
        centerCount: prev.centerCount + 1,
        playableCardIds: prev.playableCardIds.filter((id) => id !== action.cardId),
      }));
    }
  };

  const handleBatakAction = (action: BatakAction) => {
    if (action.type === 'bid') {
      setBatakView((prev) => ({
        ...prev,
        highestBid: action.amount,
        highestBidder: prev.seat,
        phase: 'selectingTrump',
      }));
    } else if (action.type === 'pass') {
      setBatakView((prev) => ({
        ...prev,
        canPass: false,
      }));
    } else if (action.type === 'selectTrump') {
      setBatakView((prev) => ({
        ...prev,
        trump: action.suit,
        phase: 'playing',
      }));
    } else if (action.type === 'play') {
      const playedCard = batakView.hand.find((c) => c.id === action.cardId);
      if (!playedCard) return;
      setBatakView((prev) => ({
        ...prev,
        hand: prev.hand.filter((c) => c.id !== action.cardId),
        currentTrick: [...prev.currentTrick, { seat: prev.seat, card: playedCard }],
        legalCardIds: prev.legalCardIds.filter((id) => id !== action.cardId),
      }));
    }
  };

  const allCards = createDeck();

  return (
    <View style={styles.container}>
      {/* Top selector strip */}
      <View style={styles.topSelector}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map((tabItem) => (
            <TouchableOpacity
              key={tabItem.id}
              onPress={() => {
                setTab(tabItem.id);
                if (tabItem.id === 'pisti-init') setPistiView(mockPisti2PlayerInitial);
                if (tabItem.id === 'pisti-opp') setPistiView(mockPistiOpportunity);
                if (tabItem.id === 'pisti-celeb') setPistiView(mockPistiCelebration);
                if (tabItem.id === 'pisti-done') setPistiView(mockPistiFinished);
                if (tabItem.id === 'batak-bid') setBatakView(mockBatakBiddingMyTurn);
                if (tabItem.id === 'batak-trump') setBatakView(mockBatakTrumpSelection);
                if (tabItem.id === 'batak-play') setBatakView(mockBatakPlayingMyTurn);
                if (tabItem.id === 'batak-done') setBatakView(mockBatakFinished);
              }}
              style={[styles.tabBtn, tab === tabItem.id && styles.activeTabBtn]}
            >
              <Text style={[styles.tabLabel, tab === tabItem.id && styles.activeTabLabel]}>{t(tabItem.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Screen viewport */}
      <View style={styles.viewport}>
        {tab === 'pisti-init' || tab === 'pisti-opp' || tab === 'pisti-celeb' || tab === 'pisti-done' ? (
          <PistiScreen
            view={pistiView}
            seat={0}
            onAction={handlePistiAction}
            onNextRound={() => setPistiView(mockPisti2PlayerInitial)}
            onLeave={() => {}}
          />
        ) : tab === 'batak-bid' || tab === 'batak-trump' || tab === 'batak-play' || tab === 'batak-done' ? (
          <BatakScreen
            view={batakView}
            seat={0}
            onAction={handleBatakAction}
            onNextRound={() => setBatakView(mockBatakPlayingMyTurn)}
            onLeave={() => {}}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.galleryScroll}>
            <Text style={styles.galleryTitle}>{t('cardsPreviewGalleryTitle')}</Text>
            <View style={styles.galleryGrid}>
              {allCards.map((card) => (
                <View key={card.id} style={styles.galleryItem}>
                  <CardView card={card} width={64} />
                </View>
              ))}
              <View style={styles.galleryItem}>
                <CardBack width={64} />
              </View>
              <View style={styles.galleryItem}>
                <CardBack width={64} count={38} />
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07301f',
  },
  topSelector: {
    backgroundColor: '#052216',
    borderBottomWidth: 1,
    borderBottomColor: colors.wood,
    paddingVertical: 6,
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    gap: 8,
  },
  tabBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeTabBtn: {
    backgroundColor: colors.accent,
    borderColor: '#ffffff',
  },
  tabLabel: {
    color: colors.muted,
    fontSize: font.small,
    fontWeight: '700',
  },
  activeTabLabel: {
    color: '#2b1d00',
    fontWeight: '900',
  },
  viewport: {
    flex: 1,
  },
  galleryScroll: {
    padding: 16,
    alignItems: 'center',
  },
  galleryTitle: {
    color: colors.text,
    fontSize: font.title,
    fontWeight: '900',
    marginBottom: 16,
    textAlign: 'center',
  },
  galleryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    maxWidth: 960,
  },
  galleryItem: {
    margin: 2,
  },
});
