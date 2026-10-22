// Alertes en temps réel : à chaque nouvelle mesure (INSERT dans sensor_readings),
// on applique les règles de src/config/sensors.js. Une NOUVELLE anomalie déclenche
// un son + une vibration + une popup animée.
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, Vibration, Platform } from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { SENSORS, TABLE, rowTime, fmtValue } from '../config/sensors';
import { COLORS, FONTS, fmtTime } from '../theme';
import { SensorIcon, Alert } from '../components/Icons';

// Une anomalie qui continue ne re-sonne pas ; il faut 30 s de calme pour une nouvelle alerte.
const NEW_ALERT_GAP_MS = 30000;

const AlertsContext = createContext({ muted: false, setMuted: () => {}, test: () => {}, history: [] });
export const useAlerts = () => useContext(AlertsContext);

export function AlertProvider({ children, onOpenSensor }) {
  const player = useAudioPlayer(require('../assets/alert.wav'));
  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  mutedRef.current = muted;
  const lastSeen = useRef({});

  const show = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const l = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, []);

  const ring = useCallback(() => {
    if (mutedRef.current) return;
    try {
      player.seekTo(0);
      player.play();
    } catch (e) {
      console.warn('[SAFE WORKER] Son impossible :', e?.message);
    }
    if (Platform.OS !== 'web') Vibration.vibrate([0, 400, 200, 400, 200, 400]);
  }, [player]);

  const push = useCallback(
    (a) => {
      setQueue((q) => [...q.slice(-9), a]);
      setHistory((h) => [a, ...h].slice(0, 50));
      ring();
    },
    [ring]
  );

  // Écoute temps réel
  useEffect(() => {
    const channel = supabase
      .channel(`alerts-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: TABLE }, ({ new: r }) => {
        const rt = rowTime(r);
        const t = Number.isFinite(rt) ? rt : Date.now();
        for (const s of SENSORS) {
          const v = s.value(r);
          const a = s.anomaly(r, v);
          if (!a) continue;
          const prev = lastSeen.current[s.key];
          lastSeen.current[s.key] = t;
          if (prev && t - prev < NEW_ALERT_GAP_MS) continue; // même épisode
          push({ id: `${s.key}-${t}`, sensor: s, label: a.label, value: v, t });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [push]);

  const current = queue[0];

  useEffect(() => {
    if (!current) return;
    show.setValue(0);
    Animated.spring(show, { toValue: 1, friction: 7, tension: 80, useNativeDriver: true }).start();
  }, [current?.id]);

  const dismiss = () => {
    Animated.timing(show, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setQueue((q) => q.slice(1)));
  };
  const dismissAll = () => {
    Animated.timing(show, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => setQueue([]));
  };

  const test = () =>
    push({ id: `test-${Date.now()}`, sensor: SENSORS[0], label: "Test de l'alarme", value: 135, t: Date.now() });

  return (
    <AlertsContext.Provider value={{ muted, setMuted, test, history }}>
      {children}

      {current ? (
        <Animated.View style={[styles.backdrop, { opacity: show }]} pointerEvents="auto">
          <Animated.View
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
            style={[
              styles.card,
              {
                transform: [
                  { scale: show.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                  { translateY: show.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
                ],
              },
            ]}
          >
            <View style={styles.iconWrap}>
              <Animated.View
                style={[
                  styles.iconRing,
                  {
                    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
                    transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                  },
                ]}
              />
              <View style={styles.icon}>
                <Alert color={COLORS.bg} size={30} />
              </View>
            </View>

            <Text style={styles.kicker}>ALERTE · {fmtTime(current.t)}</Text>
            <Text style={styles.title}>{current.label}</Text>

            <View style={styles.sensorRow}>
              <View style={[styles.sensorIcon, { backgroundColor: `${current.sensor.color}1F` }]}>
                <SensorIcon name={current.sensor.icon} color={current.sensor.color} size={18} />
              </View>
              <Text style={styles.sensorLabel}>{current.sensor.label}</Text>
              <Text style={styles.sensorValue}>
                {fmtValue(current.value, current.sensor)} {current.sensor.unit}
              </Text>
            </View>

            {queue.length > 1 ? (
              <Text style={styles.more}>+ {queue.length - 1} autre{queue.length > 2 ? 's' : ''} alerte{queue.length > 2 ? 's' : ''}</Text>
            ) : null}

            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  const key = current.sensor.key;
                  dismissAll();
                  onOpenSensor?.(key);
                }}
                style={({ pressed }) => [styles.btnPrimary, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.btnPrimaryText}>Voir le détail</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={queue.length > 1 ? dismiss : dismissAll}
                style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.btnText}>{queue.length > 1 ? 'Suivante' : 'OK'}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      ) : null}
    </AlertsContext.Provider>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,7,10,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 1000,
    elevation: 1000,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 26,
    padding: 22,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.dangerBorder,
    alignItems: 'center',
  },
  iconWrap: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  iconRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: COLORS.danger },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: FONTS.displaySemi, fontSize: 12, letterSpacing: 2, color: COLORS.dangerText },
  title: { fontFamily: FONTS.display, fontSize: 23, color: COLORS.text, textAlign: 'center', marginTop: 6 },
  sensorRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', marginTop: 18, padding: 12,
    borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  sensorIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sensorLabel: { flex: 1, fontFamily: FONTS.medium, fontSize: 14, color: COLORS.muted },
  sensorValue: { fontFamily: FONTS.display, fontSize: 20, color: COLORS.dangerText },
  more: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted, marginTop: 12 },
  actions: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 18 },
  btnPrimary: { flex: 1, height: 50, borderRadius: 14, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontFamily: FONTS.display, fontSize: 15, color: COLORS.bg },
  btn: { flex: 1, height: 50, borderRadius: 14, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: FONTS.display, fontSize: 15, color: COLORS.text },
});
