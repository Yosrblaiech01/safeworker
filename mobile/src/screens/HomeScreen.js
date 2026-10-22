import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { useReadings } from '../hooks/useReadings';
import { SENSORS, seriesFor, anomalyEpisodes, fmtValue, rowTime } from '../config/sensors';
import { COLORS, FONTS, fmtAgo, fmtTime } from '../theme';
import { SensorIcon, Logout, Chevron, Alert, Check, Clock, Bell, BellOff } from '../components/Icons';
import { Sparkline } from '../components/LineChart';
import { useAlerts } from '../alerts/AlertProvider';

const WINDOW_MIN = 60; // l'accueil résume la dernière heure

function SensorCard({ sensor, latest, spark, count, onPress, anim, wide }) {
  const press = useRef(new Animated.Value(1)).current;
  const alert = count > 0;
  return (
    <Animated.View
      style={[
        wide ? styles.cardWide : styles.cardHalf,
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
            { scale: press },
          ],
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${sensor.label}, ${fmtValue(latest, sensor)} ${sensor.unit}${alert ? `, ${count} anomalie(s)` : ''}`}
        onPress={onPress}
        onPressIn={() => Animated.spring(press, { toValue: 0.96, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(press, { toValue: 1, friction: 4, useNativeDriver: true }).start()}
        style={[styles.card, alert && styles.cardAlert]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: `${sensor.color}1F` }]}>
            <SensorIcon name={sensor.icon} color={sensor.color} size={18} />
          </View>
          {alert ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{count}</Text>
            </View>
          ) : (
            <Chevron color={COLORS.faint} />
          )}
        </View>
        <Text style={styles.cardLabel} numberOfLines={1}>{sensor.label}</Text>
        <View style={styles.valueRow}>
          <Text style={styles.cardValue}>{fmtValue(latest, sensor)}</Text>
          <Text style={styles.cardUnit}>{sensor.unit}</Text>
        </View>
        <Sparkline points={spark} color={sensor.color} width={wide ? 290 : 128} height={34} />
      </Pressable>
    </Animated.View>
  );
}

export default function HomeScreen({ navigation }) {
  const { rows, loading, error, reload } = useReadings(WINDOW_MIN);
  const { muted, setMuted, test } = useAlerts();
  const [email, setEmail] = useState('');
  const [, tick] = useState(0);

  const reveal = useRef([0, 1, 2, 3, 4, 5, 6, 7].map(() => new Animated.Value(0))).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data?.user?.email ?? ''));
    Animated.stagger(
      90,
      reveal.map((r) =>
        Animated.timing(r, { toValue: 1, duration: 650, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true })
      )
    ).start();
    const loops = [
      Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true })),
      Animated.loop(Animated.timing(scan, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })),
    ];
    loops.forEach((l) => l.start());
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => {
      loops.forEach((l) => l.stop());
      clearInterval(id);
    };
  }, []);

  const data = useMemo(() => {
    const perSensor = {};
    let all = [];
    for (const s of SENSORS) {
      const series = seriesFor(rows, s);
      const eps = anomalyEpisodes(rows, s);
      perSensor[s.key] = {
        latest: series.length ? series[series.length - 1].v : null,
        spark: series.slice(-60),
        count: eps.length,
      };
      all = all.concat(eps.map((e) => ({ ...e, sensor: s })));
    }
    all.sort((a, b) => b.end - a.end);
    const last = rows.length ? rowTime(rows[rows.length - 1]) : null;
    return { perSensor, recent: all.slice(0, 4), total: all.length, last };
  }, [rows]);

  const online = data.last && Date.now() - data.last < 15000;
  const ok = data.total === 0;
  const name = email ? email.split('@')[0] : 'Superviseur';

  const rv = (i) => ({
    opacity: reveal[i],
    transform: [{ translateY: reveal[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={loading && rows.length > 0} onRefresh={reload} tintColor={COLORS.accent} />}
        >
          {/* En-tête */}
          <Animated.View style={[styles.header, rv(0)]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hello}>Bonjour,</Text>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Activer le son des alertes' : 'Couper le son des alertes'}
              onPress={() => setMuted(!muted)}
              style={[styles.iconBtn, { marginRight: 10 }, muted && { borderColor: COLORS.dangerBorder }]}
            >
              {muted ? <BellOff color={COLORS.dangerText} /> : <Bell color={COLORS.accent} />}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Se déconnecter"
              onPress={() => supabase.auth.signOut()}
              style={styles.iconBtn}
            >
              <Logout color={COLORS.text} />
            </Pressable>
          </Animated.View>

          {/* État global */}
          <Animated.View style={[styles.hero, ok ? styles.heroOk : styles.heroAlert, rv(1)]}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.scan,
                { transform: [{ translateX: scan.interpolate({ inputRange: [0, 1], outputRange: [-120, 420] }) }, { skewX: '-18deg' }] },
              ]}
            />
            <View style={styles.heroTop}>
              <View style={styles.statusWrap}>
                <Animated.View
                  style={[
                    styles.statusRing,
                    { borderColor: ok ? COLORS.ok : COLORS.danger },
                    {
                      opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
                      transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
                    },
                  ]}
                />
                <View style={[styles.statusDot, { backgroundColor: ok ? COLORS.ok : COLORS.danger }]}>
                  {ok ? <Check color={COLORS.bg} size={20} /> : <Alert color={COLORS.bg} size={20} />}
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroKicker}>DERNIÈRE HEURE</Text>
                <Text style={styles.heroTitle}>
                  {loading && !rows.length ? 'Chargement…' : ok ? 'Tout est normal' : `${data.total} anomalie${data.total > 1 ? 's' : ''} détectée${data.total > 1 ? 's' : ''}`}
                </Text>
              </View>
            </View>
            <View style={styles.heroFoot}>
              <View style={styles.footItem}>
                <View style={[styles.liveDot, { backgroundColor: online ? COLORS.ok : COLORS.faint }]} />
                <Text style={styles.footText}>{online ? 'Bracelet connecté' : 'Bracelet hors ligne'}</Text>
              </View>
              <View style={styles.footItem}>
                <Clock color={COLORS.faint} size={14} />
                <Text style={styles.footText}>{data.last ? fmtAgo(data.last) : 'Aucune mesure'}</Text>
              </View>
            </View>
          </Animated.View>

          <Pressable accessibilityRole="button" onPress={test} style={styles.testBtn} hitSlop={6}>
            <Bell color={COLORS.muted} size={15} />
            <Text style={styles.testText}>Tester l'alarme</Text>
          </Pressable>

          {error ? (
            <Pressable onPress={reload} style={styles.errorBox} accessibilityRole="button">
              <Text style={styles.errorText}>Erreur : {error} — appuyez pour réessayer</Text>
            </Pressable>
          ) : null}

          {/* Capteurs */}
          <Animated.Text style={[styles.section, rv(2)]}>Capteurs</Animated.Text>
          <View style={styles.grid}>
            {SENSORS.map((s, i) => (
              <SensorCard
                key={s.key}
                sensor={s}
                {...data.perSensor[s.key]}
                anim={reveal[3 + i]}
                wide={i === SENSORS.length - 1 && SENSORS.length % 2 === 1}
                onPress={() => navigation.navigate('Sensor', { key: s.key })}
              />
            ))}
          </View>

          {/* Dernières anomalies */}
          <Text style={styles.section}>Dernières anomalies</Text>
          {data.recent.length === 0 ? (
            <View style={styles.emptyBox}>
              <Check color={COLORS.okText} />
              <Text style={styles.emptyText}>Aucune anomalie sur la dernière heure</Text>
            </View>
          ) : (
            data.recent.map((e, i) => (
              <Pressable
                key={`${e.sensorKey}-${e.start}-${i}`}
                accessibilityRole="button"
                onPress={() => navigation.navigate('Sensor', { key: e.sensorKey })}
                style={styles.anomaly}
              >
                <View style={[styles.iconBox, { backgroundColor: `${e.sensor.color}1F` }]}>
                  <SensorIcon name={e.sensor.icon} color={e.sensor.color} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.anomalyTitle} numberOfLines={1}>{e.label}</Text>
                  <Text style={styles.anomalySub}>
                    {fmtTime(e.start)} · {e.high ? 'max' : 'min'} {fmtValue(e.peak, e.sensor)} {e.sensor.unit}
                  </Text>
                </View>
                <Chevron color={COLORS.faint} />
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 18 },
  hello: { fontFamily: FONTS.body, fontSize: 15, color: COLORS.muted },
  name: { fontFamily: FONTS.display, fontSize: 26, color: COLORS.text, marginTop: 2 },
  iconBtn: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },

  hero: { borderRadius: 22, padding: 18, borderWidth: 1, overflow: 'hidden' },
  heroOk: { backgroundColor: 'rgba(56,217,169,0.08)', borderColor: 'rgba(56,217,169,0.30)' },
  heroAlert: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBorder },
  scan: { position: 'absolute', top: 0, bottom: 0, width: 60, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statusWrap: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  statusRing: { position: 'absolute', width: 48, height: 48, borderRadius: 24, borderWidth: 2 },
  statusDot: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  heroKicker: { fontFamily: FONTS.displaySemi, fontSize: 11, letterSpacing: 2, color: COLORS.muted },
  heroTitle: { fontFamily: FONTS.display, fontSize: 21, color: COLORS.text, marginTop: 3 },
  heroFoot: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  footItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  footText: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.muted },

  testBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-end', marginTop: 10, paddingVertical: 8, paddingHorizontal: 4, minHeight: 44 },
  testText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted },
  errorBox: { marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.dangerBorder },
  errorText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.dangerText },

  section: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.text, marginTop: 26, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  cardHalf: { width: '48.5%' },
  cardWide: { width: '100%' },
  card: { borderRadius: 18, padding: 14, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  cardAlert: { borderColor: COLORS.dangerBorder },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  iconBox: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 24, height: 24, paddingHorizontal: 7, borderRadius: 12, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.bg },
  cardLabel: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.muted },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  cardValue: { fontFamily: FONTS.display, fontSize: 26, color: COLORS.text },
  cardUnit: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.faint },

  emptyBox: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { fontFamily: FONTS.medium, fontSize: 13.5, color: COLORS.muted },
  anomaly: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, marginBottom: 10,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  anomalyTitle: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.text },
  anomalySub: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.muted, marginTop: 2 },
});
