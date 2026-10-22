// SAFE WORKER — Écran d'accueil (application superviseur)
// React Native + Expo · animations avec l'API Animated (aucune lib d'animation externe)

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Pressable,
  AccessibilityInfo,
} from 'react-native';
import Svg, { Path, Circle, Rect, Defs, Pattern } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

// ---------- Palette ----------
export const COLORS = {
  bg: '#0B0F14',
  surface: '#121821',
  chip: '#151C26',
  border: 'rgba(255,255,255,0.10)',
  text: '#F2F4F7',
  muted: '#9AA4B2',
  faint: '#8A94A3',
  accent: '#F5A524', // jaune sécurité
  accentInk: '#1A1206',
  ok: '#38D9A9',
  okText: '#5FE3B8',
  heart: '#FF6B5A',
};

const AnimatedPath = Animated.createAnimatedComponent(Path);

// ---------- Petites icônes (SVG) ----------
const IconShield = () => (
  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={COLORS.accentInk} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z" />
    <Path d="M7.5 12.5h2.2l1.3-2.6 2 5 1.3-2.4h2.2" />
  </Svg>
);
const IconPulse = ({ c }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M3 12h4l2-5 4 10 2-5h6" />
  </Svg>
);
const IconTemp = ({ c }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z" />
  </Svg>
);
const IconDrop = ({ c }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 3s6 6.4 6 11a6 6 0 0 1-12 0c0-4.6 6-11 6-11z" />
  </Svg>
);
const IconWalk = ({ c }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={13} cy={4.5} r={1.8} />
    <Path d="M9 21l2.5-6 2.5 2v4M8 11l3-3 3 2 3 1M11 8l1.5 7" />
  </Svg>
);
const IconRadar = ({ c }) => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M4 12a8 8 0 0 1 16 0M7.5 12a4.5 4.5 0 0 1 9 0" />
    <Circle cx={12} cy={12} r={1.5} />
  </Svg>
);
const IconArrow = () => (
  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={COLORS.accentInk} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M5 12h14M13 6l6 6-6 6" />
  </Svg>
);
const IconLock = () => (
  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={COLORS.faint} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x={5} y={11} width={14} height={9} rx={2} />
    <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);

// ---------- Helpers d'animation ----------
const loop = (value, duration, { delay = 0, easing = Easing.linear, native = true } = {}) =>
  Animated.sequence([
    Animated.delay(delay),
    Animated.loop(
      Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: native })
    ),
  ]);

// ---------- Capteur flottant ----------
function SensorChip({ label, icon, style, delay, reduceMotion }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    const a = loop(v, 4200, { delay, easing: Easing.inOut(Easing.sin) });
    a.start();
    return () => a.stop();
  }, [reduceMotion]);
  const translateY = v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -9, 0] });
  return (
    <Animated.View style={[styles.chip, style, { transform: [{ translateY }] }]}>
      {icon}
      <Text style={styles.chipText}>{label}</Text>
    </Animated.View>
  );
}

// ---------- Écran ----------
export default function WelcomeScreen({ onLogin = () => {} }) {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [reduceMotion, setReduceMotion] = useState(false);
  const [btnW, setBtnW] = useState(340);

  // Valeurs animées
  const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const ecg = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(1)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(1)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const reveal = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!fontsLoaded) return;

    if (reduceMotion) {
      reveal.forEach((r) => r.setValue(1));
      return;
    }

    const anims = [
      // Ondes radar autour du bracelet
      ...rings.map((r, i) => loop(r, 3600, { delay: i * 1200, easing: Easing.bezier(0.2, 0.6, 0.3, 1) })),
      // Tracé ECG (strokeDashoffset → pas de driver natif)
      loop(ecg, 2800, { easing: Easing.inOut(Easing.ease), native: false }),
      // Orbite
      loop(orbit, 40000),
      // Bouton : reflet qui balaie
      loop(shine, 3200, { easing: Easing.inOut(Easing.ease) }),
      // Battement de cœur
      Animated.loop(
        Animated.sequence([
          Animated.timing(heart, { toValue: 1.18, duration: 160, useNativeDriver: true }),
          Animated.timing(heart, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.timing(heart, { toValue: 1.1, duration: 160, useNativeDriver: true }),
          Animated.timing(heart, { toValue: 1, duration: 160, useNativeDriver: true }),
          Animated.delay(660),
        ])
      ),
      // Point "Temps réel" qui clignote
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: 0.25, duration: 800, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ),
      // Apparition en cascade du contenu
      Animated.stagger(
        200,
        reveal.map((r) =>
          Animated.timing(r, { toValue: 1, duration: 800, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true })
        )
      ),
    ];
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [fontsLoaded, reduceMotion]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;

  const revealStyle = (r) => ({
    opacity: r,
    transform: [{ translateY: r.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
  });

  return (
    <View style={styles.root}>
      {/* Grille technique de fond */}
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <Pattern id="grid" width={26} height={26} patternUnits="userSpaceOnUse">
            <Path d="M26 0H0V26" fill="none" stroke="rgba(255,255,255,0.035)" strokeWidth={1} />
          </Pattern>
          <Pattern id="stripes" width={28} height={28} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width={14} height={28} fill={COLORS.accent} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
        {/* Bande de signalisation jaune/noir */}
        <Rect width="100%" height={6} fill="url(#stripes)" opacity={0.9} />
      </Svg>

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* En-tête */}
        <Animated.View style={[styles.header, revealStyle(reveal[0])]}>
          <View style={styles.brand}>
            <View style={styles.logo}><IconShield /></View>
            <Text style={styles.brandText}>SAFE WORKER</Text>
          </View>
          <View style={styles.live}>
            <Animated.View style={[styles.liveDot, { opacity: dot }]} />
            <Text style={styles.liveText}>Temps réel</Text>
          </View>
        </Animated.View>

        {/* Héro : bracelet + ondes + capteurs */}
        <View style={styles.hero}>
          {rings.map((r, i) => (
            <Animated.View
              key={i}
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  opacity: r.interpolate({ inputRange: [0, 1], outputRange: [0.9, 0] }),
                  transform: [{ scale: r.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1.25] }) }],
                },
              ]}
            />
          ))}

          <Animated.View
            pointerEvents="none"
            style={[
              styles.orbit,
              { transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] },
            ]}
          >
            <Svg width={276} height={276} viewBox="0 0 276 276">
              <Circle cx={138} cy={138} r={132} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={1} strokeDasharray="2 9" />
              <Circle cx={138} cy={6} r={4} fill={COLORS.accent} />
            </Svg>
          </Animated.View>

          <View style={styles.core}>
            <Animated.View style={{ transform: [{ scale: heart }] }}>
              <Svg width={34} height={34} viewBox="0 0 24 24">
                <Path fill={COLORS.heart} d="M12 20.5s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.8-7.5 10.2-7.5 10.2z" />
              </Svg>
            </Animated.View>
            <Svg width={128} height={40} viewBox="0 0 128 40" fill="none">
              <AnimatedPath
                d="M0 22h30l6-10 7 22 8-30 6 18h12l4-6 4 6h51"
                stroke={COLORS.accent}
                strokeWidth={2.4}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="520"
                strokeDashoffset={ecg.interpolate({ inputRange: [0, 0.6, 1], outputRange: [520, 0, -520] })}
              />
            </Svg>
            <Text style={styles.coreLabel}>BRACELET ESP32</Text>
          </View>

          <SensorChip reduceMotion={reduceMotion} delay={0} label="Rythme cardiaque" icon={<IconPulse c="#FF8A7A" />} style={{ left: 4, top: 42 }} />
          <SensorChip reduceMotion={reduceMotion} delay={700} label="Température" icon={<IconTemp c={COLORS.accent} />} style={{ right: 0, top: 18 }} />
          <SensorChip reduceMotion={reduceMotion} delay={1400} label="Humidité" icon={<IconDrop c="#6CB8FF" />} style={{ right: -2, top: 236 }} />
          <SensorChip reduceMotion={reduceMotion} delay={2100} label="Posture & fatigue" icon={<IconWalk c={COLORS.okText} />} style={{ left: 0, top: 262 }} />
          <View style={styles.bottomChipWrap} pointerEvents="none">
            <SensorChip reduceMotion={reduceMotion} delay={2800} label="Obstacles" icon={<IconRadar c="#C9A7FF" />} style={{ position: 'relative' }} />
          </View>
        </View>

        {/* Texte */}
        <View style={styles.copy}>
          <Animated.Text style={[styles.kicker, revealStyle(reveal[1])]}>ESPACE SUPERVISEUR</Animated.Text>
          <Animated.Text style={[styles.title, revealStyle(reveal[2])]}>
            {'Chaque ouvrier,\nsuivi et protégé.'}
          </Animated.Text>
          <Animated.Text style={[styles.subtitle, revealStyle(reveal[3])]}>
            Signes vitaux, environnement et alertes IA de vos équipes en zone industrielle, en direct sur votre téléphone.
          </Animated.Text>
        </View>

        {/* Actions */}
        <Animated.View style={[styles.actions, revealStyle(reveal[4])]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Se connecter"
            onPress={onLogin}
            onLayout={(e) => setBtnW(e.nativeEvent.layout.width)}
            style={({ pressed }) => [styles.cta, pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 }]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.shine,
                {
                  transform: [
                    { translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-btnW * 0.5, btnW * 1.1] }) },
                    { skewX: '-20deg' },
                  ],
                },
              ]}
            />
            <Text style={styles.ctaText}>Se connecter</Text>
            <IconArrow />
          </Pressable>
          <View style={styles.note}>
            <IconLock />
            <Text style={styles.noteText}>Accès réservé aux superviseurs autorisés</Text>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ---------- Styles ----------
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg, overflow: 'hidden' },
  safe: { flex: 1, paddingHorizontal: 24, paddingTop: 14, paddingBottom: 24 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 38, height: 38, borderRadius: 11, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 17, letterSpacing: 2.4, color: COLORS.text },
  live: {
    flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 7, paddingHorizontal: 11,
    borderRadius: 999, backgroundColor: 'rgba(56,217,169,0.10)', borderWidth: 1, borderColor: 'rgba(56,217,169,0.35)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.ok },
  liveText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: COLORS.okText },

  hero: { height: 360, marginTop: 8, alignItems: 'center', justifyContent: 'center' },
  ring: {
    position: 'absolute', width: 300, height: 300, borderRadius: 150,
    borderWidth: 1.5, borderColor: 'rgba(245,165,36,0.55)',
  },
  orbit: { position: 'absolute', width: 276, height: 276 },
  core: {
    width: 168, height: 168, borderRadius: 84, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 30, shadowOffset: { width: 0, height: 24 }, elevation: 16,
  },
  coreLabel: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 11, letterSpacing: 2, color: COLORS.muted },

  chip: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14,
    backgroundColor: COLORS.chip, borderWidth: 1, borderColor: COLORS.border,
  },
  chipText: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: COLORS.text },
  bottomChipWrap: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },

  copy: { marginTop: 22, gap: 12 },
  kicker: { fontFamily: 'SpaceGrotesk_600SemiBold', fontSize: 12, letterSpacing: 2.4, color: COLORS.accent },
  title: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 34, lineHeight: 37, color: COLORS.text },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 15, lineHeight: 23, color: COLORS.muted },

  actions: { marginTop: 'auto', gap: 12 },
  cta: {
    height: 56, borderRadius: 16, backgroundColor: COLORS.accent, overflow: 'hidden',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
  },
  shine: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 70, backgroundColor: 'rgba(255,255,255,0.35)' },
  ctaText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16, letterSpacing: 0.3, color: COLORS.accentInk },
  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  noteText: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: COLORS.faint },
});
