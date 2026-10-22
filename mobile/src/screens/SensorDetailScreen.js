import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReadings } from '../hooks/useReadings';
import { getSensor, seriesFor, anomalyEpisodes, downsample, fmtValue } from '../config/sensors';
import { COLORS, FONTS, fmtTime, fmtDuration } from '../theme';
import { SensorIcon, Back, Alert, Check, Clock } from '../components/Icons';
import LineChart from '../components/LineChart';

const PERIODS = [
  { label: '10 min', minutes: 10 },
  { label: '1 h', minutes: 60 },
  { label: '6 h', minutes: 360 },
];

export default function SensorDetailScreen({ route, navigation }) {
  const sensor = getSensor(route.params?.key) ?? getSensor('heart_rate');
  const [period, setPeriod] = useState(1);
  const { rows, loading, error, reload } = useReadings(PERIODS[period].minutes);

  const reveal = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const live = useRef(new Animated.Value(1)).current;
  const pill = useRef(new Animated.Value(period)).current;
  const [segW, setSegW] = useState(0);

  useEffect(() => {
    Animated.stagger(
      120,
      reveal.map((r) => Animated.timing(r, { toValue: 1, duration: 650, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true }))
    ).start();
    const l = Animated.loop(
      Animated.sequence([
        Animated.timing(live, { toValue: 0.25, duration: 800, useNativeDriver: true }),
        Animated.timing(live, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    l.start();
    return () => l.stop();
  }, []);

  useEffect(() => {
    Animated.spring(pill, { toValue: period, friction: 8, tension: 70, useNativeDriver: true }).start();
  }, [period]);

  const d = useMemo(() => {
    const series = seriesFor(rows, sensor);
    const episodes = anomalyEpisodes(rows, sensor);
    const vals = series.map((p) => p.v);
    const latest = series.length ? series[series.length - 1] : null;
    const latestAnomaly = latest ? sensor.anomaly(rows[rows.length - 1], latest.v) : null;
    return {
      points: downsample(series, 240),
      markers: episodes.filter((e) => e.peak != null).map((e) => ({ t: e.peakT, v: e.peak })),
      episodes,
      latest,
      latestAnomaly,
      min: vals.length ? Math.min(...vals) : null,
      max: vals.length ? Math.max(...vals) : null,
      avg: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null,
    };
  }, [rows, sensor]);

  const rv = (i) => ({
    opacity: reveal[i],
    transform: [{ translateY: reveal[i].interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  const segItem = segW / PERIODS.length;

  return (
    <View style={styles.root}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* En-tête */}
          <Animated.View style={[styles.header, rv(0)]}>
            <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <Back color={COLORS.text} />
            </Pressable>
            <View style={[styles.iconBox, { backgroundColor: `${sensor.color}1F` }]}>
              <SensorIcon name={sensor.icon} color={sensor.color} size={20} />
            </View>
            <Text style={styles.title} numberOfLines={1}>{sensor.label}</Text>
            <View style={styles.live}>
              <Animated.View style={[styles.liveDot, { opacity: live }]} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </Animated.View>

          {/* Valeur actuelle */}
          <Animated.View style={[styles.current, rv(1)]}>
            <Text style={styles.kicker}>VALEUR ACTUELLE</Text>
            <View style={styles.bigRow}>
              <Text style={[styles.big, { color: d.latestAnomaly ? COLORS.dangerText : COLORS.text }]}>
                {d.latest ? fmtValue(d.latest.v, sensor) : '—'}
              </Text>
              <Text style={styles.bigUnit}>{sensor.unit}</Text>
            </View>
            <View style={[styles.state, d.latestAnomaly ? styles.stateBad : styles.stateOk]}>
              {d.latestAnomaly ? <Alert size={14} color={COLORS.dangerText} /> : <Check size={14} color={COLORS.okText} />}
              <Text style={[styles.stateText, { color: d.latestAnomaly ? COLORS.dangerText : COLORS.okText }]}>
                {d.latestAnomaly ? d.latestAnomaly.label : 'Normal'}
              </Text>
              {d.latest ? <Text style={styles.stateTime}>· {fmtTime(d.latest.t)}</Text> : null}
            </View>

            <View style={styles.stats}>
              {[
                ['Min', d.min],
                ['Moyenne', d.avg],
                ['Max', d.max],
              ].map(([k, v]) => (
                <View key={k} style={styles.stat}>
                  <Text style={styles.statLabel}>{k}</Text>
                  <Text style={styles.statValue}>{fmtValue(v, sensor)}</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Période */}
          <Animated.View style={[styles.seg, rv(2)]} onLayout={(e) => setSegW(e.nativeEvent.layout.width - 8)}>
            {segW > 0 ? (
              <Animated.View
                style={[
                  styles.segPill,
                  { width: segItem, transform: [{ translateX: pill.interpolate({ inputRange: [0, PERIODS.length - 1], outputRange: [0, segItem * (PERIODS.length - 1)] }) }] },
                ]}
              />
            ) : null}
            {PERIODS.map((p, i) => (
              <Pressable
                key={p.label}
                accessibilityRole="button"
                accessibilityState={{ selected: i === period }}
                onPress={() => setPeriod(i)}
                style={styles.segBtn}
              >
                <Text style={[styles.segText, i === period && styles.segTextOn]}>{p.label}</Text>
              </Pressable>
            ))}
          </Animated.View>

          {/* Graphique */}
          <Animated.View style={[styles.chartCard, rv(2)]}>
            <View style={styles.chartHead}>
              <Text style={styles.chartTitle}>Évolution · {PERIODS[period].label}</Text>
              {loading ? <ActivityIndicator size="small" color={sensor.color} /> : null}
            </View>
            {error ? (
              <Pressable onPress={reload} accessibilityRole="button" style={{ paddingVertical: 30 }}>
                <Text style={styles.errorText}>Erreur : {error} — appuyez pour réessayer</Text>
              </Pressable>
            ) : (
              <LineChart
                points={d.points}
                anomalies={d.markers}
                refLines={sensor.refLines}
                color={sensor.color}
                decimals={sensor.decimals}
                animateKey={`${sensor.key}-${period}-${loading}`}
              />
            )}
            <View style={styles.legend}>
              <View style={styles.legendItem}><View style={[styles.legendLine, { backgroundColor: sensor.color }]} /><Text style={styles.legendText}>Mesure</Text></View>
              <View style={styles.legendItem}><View style={styles.legendDash} /><Text style={styles.legendText}>Seuil</Text></View>
              <View style={styles.legendItem}><View style={styles.legendDot} /><Text style={styles.legendText}>Anomalie</Text></View>
            </View>
          </Animated.View>

          {/* Anomalies */}
          <Animated.View style={rv(3)}>
            <View style={styles.listHead}>
              <Text style={styles.section}>Anomalies</Text>
              <Text style={styles.count}>{d.episodes.length}</Text>
            </View>
            {d.episodes.length === 0 ? (
              <View style={styles.emptyBox}>
                <Check color={COLORS.okText} />
                <Text style={styles.emptyText}>Aucune anomalie sur cette période</Text>
              </View>
            ) : (
              d.episodes.slice(0, 50).map((e, i) => (
                <View key={`${e.start}-${i}`} style={styles.item}>
                  <View style={styles.timeline}>
                    <View style={styles.tDot} />
                    {i < Math.min(d.episodes.length, 50) - 1 ? <View style={styles.tLine} /> : null}
                  </View>
                  <View style={styles.itemBody}>
                    <View style={styles.itemTop}>
                      <Text style={styles.itemTitle} numberOfLines={1}>{e.label}</Text>
                      <Text style={styles.itemPeak}>
                        {fmtValue(e.peak, sensor)} {sensor.unit}
                      </Text>
                    </View>
                    <View style={styles.itemMeta}>
                      <Clock color={COLORS.faint} size={13} />
                      <Text style={styles.itemTime}>
                        {e.start === e.end ? fmtTime(e.start) : `${fmtTime(e.start)} → ${fmtTime(e.end)}`}
                      </Text>
                      <Text style={styles.itemDur}>· {fmtDuration(e.end - e.start || 2000)}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  iconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontFamily: FONTS.display, fontSize: 20, color: COLORS.text },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: 'rgba(56,217,169,0.10)', borderWidth: 1, borderColor: 'rgba(56,217,169,0.35)' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.ok },
  liveText: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.okText },

  current: { marginTop: 22, padding: 18, borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  kicker: { fontFamily: FONTS.displaySemi, fontSize: 11, letterSpacing: 2, color: COLORS.muted },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  big: { fontFamily: FONTS.display, fontSize: 54, lineHeight: 62 },
  bigUnit: { fontFamily: FONTS.medium, fontSize: 18, color: COLORS.faint },
  state: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, marginTop: 4 },
  stateOk: { backgroundColor: 'rgba(56,217,169,0.10)', borderColor: 'rgba(56,217,169,0.35)' },
  stateBad: { backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBorder },
  stateText: { fontFamily: FONTS.semi, fontSize: 12.5 },
  stateTime: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.muted },
  stats: { flexDirection: 'row', marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  stat: { flex: 1 },
  statLabel: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.faint },
  statValue: { fontFamily: FONTS.display, fontSize: 19, color: COLORS.text, marginTop: 2 },

  seg: { flexDirection: 'row', marginTop: 18, padding: 4, borderRadius: 14, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  segPill: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: 10, backgroundColor: COLORS.accent },
  segBtn: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center' },
  segText: { fontFamily: FONTS.semi, fontSize: 13.5, color: COLORS.muted },
  segTextOn: { color: COLORS.accentInk },

  chartCard: { marginTop: 14, padding: 14, borderRadius: 22, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  chartHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, minHeight: 22 },
  chartTitle: { fontFamily: FONTS.semi, fontSize: 14, color: COLORS.text },
  legend: { flexDirection: 'row', gap: 16, marginTop: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLine: { width: 14, height: 3, borderRadius: 2 },
  legendDash: { width: 14, height: 0, borderTopWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.danger },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger },
  legendText: { fontFamily: FONTS.medium, fontSize: 12, color: COLORS.muted },
  errorText: { fontFamily: FONTS.medium, fontSize: 13, color: COLORS.dangerText, textAlign: 'center' },

  listHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 26, marginBottom: 12 },
  section: { fontFamily: FONTS.display, fontSize: 18, color: COLORS.text },
  count: { fontFamily: FONTS.semi, fontSize: 12, color: COLORS.bg, backgroundColor: COLORS.danger, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' },
  emptyBox: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  emptyText: { fontFamily: FONTS.medium, fontSize: 13.5, color: COLORS.muted },
  item: { flexDirection: 'row', gap: 12 },
  timeline: { width: 14, alignItems: 'center', paddingTop: 18 },
  tDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger, borderWidth: 2, borderColor: COLORS.dangerBorder },
  tLine: { flex: 1, width: 2, backgroundColor: 'rgba(255,107,90,0.25)', marginTop: 4 },
  itemBody: { flex: 1, padding: 14, borderRadius: 16, marginBottom: 10, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, fontFamily: FONTS.semi, fontSize: 14, color: COLORS.text },
  itemPeak: { fontFamily: FONTS.display, fontSize: 15, color: COLORS.dangerText },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  itemTime: { fontFamily: FONTS.medium, fontSize: 12.5, color: COLORS.muted },
  itemDur: { fontFamily: FONTS.body, fontSize: 12.5, color: COLORS.faint },
});
