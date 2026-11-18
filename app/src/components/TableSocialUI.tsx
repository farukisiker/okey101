// E2 (Claude Sonnet): what the player sees of the table's chat. GameShell draws <TableSocialBar/> in its top bar
// and <TableSocialLayer/> over the game. Both render nothing when there is nothing to talk to (offline, okey, bots only).
import { useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../i18n';
import { TableSocialValue, useTableSocial, voiceStatusKey } from '../net/TableSocial';
import { QUICK_EMOJI, QUICK_SAYINGS, REPORT_KEYS, REPORT_REASONS, SAYING_KEYS } from '../net/social';
import { colors, font } from '../theme';
import { Button } from './Button';

/** The two top-bar buttons: Söz and Oyuncular. */
export function TableSocialBar({ onOpenSay, onOpenPlayers }: { onOpenSay(): void; onOpenPlayers(): void }) {
  const s = useTableSocial();
  if (!s || s.others.length === 0) return null;
  return (
    <>
      <Button title={`💬 ${t('sayButton')}`} variant="secondary" onPress={onOpenSay} style={styles.barBtn} />
      <Button title={`👥 ${t('tablePlayers')}`} variant="secondary" onPress={onOpenPlayers} style={styles.barBtn} />
    </>
  );
}

type Sheet = null | 'say' | 'players';

/** Hook for GameShell: which sheet is open, and the bar + layer elements to draw. */
export function useSocialSheets() {
  const [sheet, setSheet] = useState<Sheet>(null);
  const s = useTableSocial();
  const active = s !== null && s.others.length > 0;
  return {
    active,
    bar: <TableSocialBar onOpenSay={() => setSheet('say')} onOpenPlayers={() => setSheet('players')} />,
    layer: s ? <TableSocialLayer social={s} sheet={active ? sheet : null} onClose={() => setSheet(null)} /> : null,
  };
}

function TableSocialLayer({ social: s, sheet, onClose }: { social: TableSocialValue; sheet: Sheet; onClose(): void }) {
  const [askMic, setAskMic] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3500);
  };

  const onMic = () => {
    if (!s.voice.micOn && !s.explained) setAskMic(true);
    else s.toggleMic();
  };
  const insets = useSafeAreaInsets();
  const status = voiceStatusKey(s.voice);
  // A server without LiveKit (or a table without voice) is not an error the player should see: no mic at all.
  const voiceUsable = s.voice.error !== 'not_configured' && s.voice.error !== 'voice_off';
  const banned = s.voice.bannedUntil > Date.now();

  return (
    <View style={styles.layer} pointerEvents="box-none">
      {/* Bubbles and who is speaking: top right, under the bar. */}
      <View style={styles.stack} pointerEvents="none">
        {s.bubbles.filter((b) => !s.anchored.has(b.seat)).map((b) => (
          <View key={b.id} style={styles.bubble} accessibilityLiveRegion="polite">
            <Text style={styles.bubbleName} numberOfLines={1}>{s.nameOf(b.seat)}</Text>
            <Text style={[styles.bubbleText, b.emoji ? styles.bubbleEmoji : null]} numberOfLines={2}>{b.emoji ?? (b.saying ? t(SAYING_KEYS[b.saying]) : '')}</Text>
          </View>
        ))}
        {s.voice.speaking
          .filter((seat) => seat !== s.mySeat)
          .map((seat) => (
            <View key={`v${seat}`} style={styles.speaking}>
              <Text style={styles.speakingText} numberOfLines={1}>{`🔊 ${t('voiceSpeaking', { name: s.nameOf(seat) })}`}</Text>
            </View>
          ))}
      </View>

      {/* Microphone: bottom right. ● on green = open, ✕ on red outline = closed. */}
      {s.voiceOn && voiceUsable && s.others.length > 0 && (
        <View style={[styles.micWrap, { right: 10 + insets.right, bottom: 12 + insets.bottom }]} pointerEvents="box-none">
          {status && <Text style={[styles.micStatus, (banned || s.voice.status === 'failed' || s.voice.error === 'permission') && styles.micStatusBad]}>{t(status)}</Text>}
          <View style={styles.micRow} pointerEvents="box-none">
            <Text style={styles.micLabel}>{s.voice.micOn ? t('voiceOnLabel') : t('voiceOffLabel')}</Text>
            <Pressable
              onPress={onMic}
              disabled={banned || s.voice.status === 'connecting'}
              accessibilityRole="button"
              accessibilityLabel={s.voice.micOn ? t('voiceOnA11y') : t('voiceOffA11y')}
              style={({ pressed }) => [styles.mic, s.voice.micOn ? styles.micOn : styles.micOff, (banned || s.voice.status === 'connecting') && { opacity: 0.5 }, pressed && { opacity: 0.75 }]}
            >
              <Text style={styles.micIcon}>🎤</Text>
              <Text style={[styles.micMark, { color: s.voice.micOn ? colors.felt : colors.danger }]}>{s.voice.micOn ? '●' : '✕'}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {sheet === 'say' && <SaySheet s={s} onClose={onClose} onError={flash} />}
      {sheet === 'players' && <PlayersSheet s={s} onClose={onClose} onToast={flash} />}

      {askMic && (
        <Sheet title={t('voiceAskTitle')} onClose={() => setAskMic(false)}>
          <Text style={styles.body}>{t('voiceAskBody')}</Text>
          <View style={styles.row}>
            <Button
              title={t('voiceAskGo')}
              onPress={() => {
                setAskMic(false);
                s.markExplained();
                s.toggleMic();
              }}
              style={styles.wide}
            />
            <Button title={t('voiceAskCancel')} variant="secondary" onPress={() => setAskMic(false)} style={styles.wide} />
          </View>
        </Sheet>
      )}

      {/* Last, so a message about a sheet action is drawn above the sheet's dim background. */}
      {toast && (
        <View style={[styles.toast, { bottom: 84 + insets.bottom }]} pointerEvents="none">
          <Text style={styles.toastText} accessibilityLiveRegion="polite">{toast}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * The saying bubble of one seat, drawn just under that player's chip (the chip must not clip: overflow visible).
 * While mounted, the corner stack leaves this seat out. Renders nothing off an online table.
 */
export function SeatBubble({ seat }: { seat: number }) {
  const s = useTableSocial();
  const anchor = s?.anchor;
  useEffect(() => (anchor ? anchor(seat) : undefined), [anchor, seat]);
  const b = s?.bubbles.find((x) => x.seat === seat);
  if (!b) return null;
  return (
    <View style={styles.seatBubble} pointerEvents="none" accessibilityLiveRegion="polite">
      <View style={styles.bubble}>
        <Text style={[styles.bubbleText, b.emoji ? styles.bubbleEmoji : null]} numberOfLines={2}>{b.emoji ?? (b.saying ? t(SAYING_KEYS[b.saying]) : '')}</Text>
      </View>
    </View>
  );
}

/** Dim background plus a card with a title and a big close button. */
function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: React.ReactNode }) {
  return (
    <View style={styles.dim}>
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle} numberOfLines={1}>{title}</Text>
          <Button title={`✕ ${t('tableSocialClose')}`} variant="secondary" onPress={onClose} style={styles.closeBtn} />
        </View>
        <ScrollView contentContainerStyle={styles.cardBody}>{children}</ScrollView>
      </View>
    </View>
  );
}

function SaySheet({ s, onClose, onError }: { s: TableSocialValue; onClose(): void; onError(msg: string): void }) {
  const waiting = s.sayWaitMs > 0;
  const send = async (msg: { saying: (typeof QUICK_SAYINGS)[number] } | { emoji: (typeof QUICK_EMOJI)[number] }) => {
    const err = await s.say(msg);
    if (err) onError(err);
    else onClose();
  };
  return (
    <Sheet title={t('sayTitle')} onClose={onClose}>
      {waiting && <Text style={styles.wait}>{t('sayWait')}</Text>}
      <View style={styles.grid}>
        {QUICK_SAYINGS.map((k) => (
          <Button key={k} title={t(SAYING_KEYS[k])} variant="secondary" disabled={waiting} onPress={() => void send({ saying: k })} style={styles.sayBtn} />
        ))}
      </View>
      <View style={styles.grid}>
        {QUICK_EMOJI.map((e) => (
          <Pressable
            key={e}
            disabled={waiting}
            accessibilityRole="button"
            accessibilityLabel={e}
            onPress={() => void send({ emoji: e })}
            style={({ pressed }) => [styles.emojiBtn, waiting && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.emoji}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

function PlayersSheet({ s, onClose, onToast }: { s: TableSocialValue; onClose(): void; onToast(msg: string): void }) {
  const [reporting, setReporting] = useState<number | null>(null);
  if (reporting !== null) {
    return (
      <Sheet title={`${t('tableReportTitle')}: ${s.nameOf(reporting)}`} onClose={() => setReporting(null)}>
        <View style={styles.grid}>
          {REPORT_REASONS.map((r) => (
            <Button
              key={r}
              title={t(REPORT_KEYS[r])}
              variant="secondary"
              style={styles.sayBtn}
              onPress={async () => {
                const seat = reporting;
                setReporting(null);
                onToast(await s.report(seat, r, s.voice.speaking.includes(seat) ? 'voice' : undefined));
              }}
            />
          ))}
        </View>
      </Sheet>
    );
  }
  return (
    <Sheet title={t('tablePlayers')} onClose={onClose}>
      {s.others.length === 0 && <Text style={styles.body}>{t('tableNoOthers')}</Text>}
      {s.others.map((p) => {
        const isBlocked = s.blocked.has(p.seat);
        const isMuted = s.muted.has(p.seat);
        const speaking = s.voice.speaking.includes(p.seat);
        return (
          <View key={p.seat} style={styles.person}>
            <View style={styles.personHead}>
              <Text style={styles.personName} numberOfLines={1}>{`${speaking ? '🔊 ' : ''}${p.name}`}</Text>
              {isBlocked && <Text style={[styles.chip, styles.chipBlocked]}>{`⛔ ${t('tableBlockedMark')}`}</Text>}
              {isMuted && !isBlocked && <Text style={[styles.chip, styles.chipMuted]}>{`✕ ${t('tableMutedMark')}`}</Text>}
            </View>
            <View style={styles.row}>
              {s.voiceOn && !isBlocked && (
                <Button
                  title={isMuted ? t('tableUnmute') : t('tableMute')}
                  variant="secondary"
                  onPress={() => s.toggleMute(p.seat)}
                  style={styles.actBtn}
                />
              )}
              <Button
                title={isBlocked ? t('tableUnblock') : t('tableBlock')}
                variant="secondary"
                onPress={async () => onToast(await (isBlocked ? s.unblock(p.seat) : s.block(p.seat)))}
                style={styles.actBtn}
              />
              <Button title={t('tableReport')} variant="secondary" onPress={() => setReporting(p.seat)} style={styles.actBtn} />
            </View>
          </View>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  barBtn: { minHeight: 56, minWidth: 56 },
  // Android draws views with elevation (cards have 3-8) above a zIndex-only sibling: the layer needs a higher elevation.
  layer: { ...StyleSheet.absoluteFill, zIndex: 700, elevation: 40 },
  stack: { position: 'absolute', top: 76, right: 10, gap: 6, alignItems: 'flex-end', maxWidth: '55%' },
  bubble: { backgroundColor: colors.tile, borderRadius: 14, borderBottomRightRadius: 3, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2, borderColor: colors.accent },
  bubbleName: { color: '#5a4a2a', fontSize: font.small, fontWeight: '800' },
  bubbleText: { color: '#1d1d1d', fontSize: 20, fontWeight: '800' },
  bubbleEmoji: { fontSize: 40, lineHeight: 48 },
  seatBubble: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, alignItems: 'center', zIndex: 800, elevation: 40 },
  speaking: { backgroundColor: colors.panel, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 2, borderColor: colors.ok },
  speakingText: { color: colors.text, fontSize: font.small, fontWeight: '800' },
  micWrap: { position: 'absolute', right: 10, bottom: 10, alignItems: 'flex-end', gap: 6 },
  micRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  micLabel: { color: colors.text, fontSize: font.small, fontWeight: '800', backgroundColor: colors.panel, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden' },
  micStatus: { color: colors.text, fontSize: font.small, fontWeight: '700', backgroundColor: colors.panel, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, overflow: 'hidden', maxWidth: 300, textAlign: 'right' },
  micStatusBad: { color: '#ffb4a8' },
  mic: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 4 },
  micOn: { backgroundColor: colors.ok, borderColor: colors.text },
  micOff: { backgroundColor: colors.panel, borderColor: colors.danger },
  micIcon: { fontSize: 28 },
  micMark: { position: 'absolute', right: 6, bottom: 2, fontSize: 22, fontWeight: '900' },
  toast: { position: 'absolute', bottom: 84, alignSelf: 'center', backgroundColor: colors.panel, borderRadius: 14, borderWidth: 2, borderColor: colors.accent, paddingHorizontal: 16, paddingVertical: 10, maxWidth: '80%' },
  toastText: { color: colors.text, fontSize: font.body, fontWeight: '800', textAlign: 'center' },
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 8 },
  card: { backgroundColor: colors.feltLight, borderRadius: 16, width: '92%', maxWidth: 760, maxHeight: '96%', padding: 12, gap: 8 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { flex: 1, color: colors.accent, fontSize: 24, fontWeight: '900' },
  closeBtn: { minHeight: 56, minWidth: 56 },
  cardBody: { gap: 10, paddingBottom: 4 },
  body: { color: colors.text, fontSize: font.body, fontWeight: '700', lineHeight: 26 },
  wait: { color: colors.accent, fontSize: font.body, fontWeight: '800', textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  sayBtn: { minWidth: 200, minHeight: 56, flexGrow: 1, flexBasis: '30%' },
  emojiBtn: { width: 68, height: 60, borderRadius: 14, backgroundColor: colors.panel, borderWidth: 2, borderColor: colors.muted, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 32 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  wide: { minWidth: 200 },
  person: { backgroundColor: colors.panel, borderRadius: 12, padding: 10, gap: 8 },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  personName: { color: colors.text, fontSize: 22, fontWeight: '900', flexShrink: 1 },
  chip: { fontSize: font.small, fontWeight: '800', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  chipBlocked: { color: colors.danger, borderWidth: 2, borderColor: colors.danger },
  chipMuted: { color: colors.accent, borderWidth: 2, borderColor: colors.accent },
  actBtn: { minWidth: 150, flexGrow: 1 },
});
