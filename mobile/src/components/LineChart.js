import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Svg, { Path, Line, Circle, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS, fmtHM } from '../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const PAD_L = 42;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 26;

// Graphique linéaire animé (tracé qui se dessine) + lignes de seuil + points d'anomalie
export default function LineChart({
  points,
  anomalies = [],
  refLines = [],
  color = COLORS.accent,
  height = 230,
  decimals = 0,
  animateKey,
}) {
  const [w, setW] = useState(0);
  const draw = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    draw.setValue(0);
    Animated.timing(draw, {
      toValue: 1,
      duration: 1300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animateKey, w > 0]);

  const geo = useMemo(() => {
    if (!w || points.length < 2) return null;
    let t0 = Infinity, t1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      if (p.t < t0) t0 = p.t;
      if (p.t > t1) t1 = p.t;
      if (p.v < y0) y0 = p.v;
      if (p.v > y1) y1 = p.v;
    }
    for (const a of anomalies) {
      if (a.v < y0) y0 = a.v;
      if (a.v > y1) y1 = a.v;
    }
    // On n'élargit l'échelle vers un seuil que s'il est proche des données
    const span0 = Math.max(y1 - y0, 1);
    for (const r of refLines) {
      if (r.value >= y0 - span0 && r.value <= y1 + span0) {
        y0 = Math.min(y0, r.value);
        y1 = Math.max(y1, r.value);
      }
    }
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.12;
    y0 -= pad;
    y1 += pad;
    const tspan = t1 - t0 || 1;
    const iw = w - PAD_L - PAD_R;
    const ih = height - PAD_T - PAD_B;
    const x = (t) => PAD_L + ((t - t0) / tspan) * iw;
    const y = (v) => PAD_T + (1 - (v - y0) / (y1 - y0)) * ih;

    let d = '';
    let len = 0;
    let px = 0, py = 0;
    points.forEach((p, i) => {
      const X = x(p.t), Y = y(p.v);
      d += `${i ? 'L' : 'M'}${X.toFixed(1)} ${Y.toFixed(1)}`;
      if (i) len += Math.hypot(X - px, Y - py);
      px = X; py = Y;
    });
    const base = PAD_T + ih;
    const area = `${d}L${x(points[points.length - 1].t).toFixed(1)} ${base}L${x(points[0].t).toFixed(1)} ${base}Z`;
    const ticks = [0, 1, 2, 3].map((i) => y0 + ((y1 - y0) * i) / 3);
    return { x, y, d, area, len: Math.ceil(len) + 10, ticks, t0, t1, ih, y0, y1 };
  }, [w, points, anomalies, refLines, height]);

  return (
    <View style={{ height }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      {!geo ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Pas encore de données sur cette période</Text>
        </View>
      ) : (
        <Svg width={w} height={height}>
          {geo.ticks.map((tv, i) => (
            <React.Fragment key={i}>
              <Line x1={PAD_L} x2={w - PAD_R} y1={geo.y(tv)} y2={geo.y(tv)} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
              <SvgText x={PAD_L - 8} y={geo.y(tv) + 4} fill={COLORS.faint} fontSize={10.5} fontFamily={FONTS.medium} textAnchor="end">
                {tv.toFixed(decimals)}
              </SvgText>
            </React.Fragment>
          ))}

          {refLines
            .filter((r) => r.value > geo.y0 && r.value < geo.y1)
            .map((r, i) => (
              <React.Fragment key={`r${i}`}>
                <Line x1={PAD_L} x2={w - PAD_R} y1={geo.y(r.value)} y2={geo.y(r.value)} stroke={COLORS.danger} strokeOpacity={0.7} strokeWidth={1.2} strokeDasharray="5 5" />
                <SvgText x={w - PAD_R} y={geo.y(r.value) - 5} fill={COLORS.dangerText} fontSize={10} fontFamily={FONTS.semi} textAnchor="end">
                  {r.label}
                </SvgText>
              </React.Fragment>
            ))}

          <AnimatedPath d={geo.area} fill={color} fillOpacity={draw.interpolate({ inputRange: [0, 1], outputRange: [0, 0.1] })} />
          <AnimatedPath
            d={geo.d}
            fill="none"
            stroke={color}
            strokeWidth={2.2}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={`${geo.len}`}
            strokeDashoffset={draw.interpolate({ inputRange: [0, 1], outputRange: [geo.len, 0] })}
          />

          {anomalies.map((a, i) => (
            <React.Fragment key={`a${i}`}>
              <Circle cx={geo.x(a.t)} cy={geo.y(a.v)} r={7} fill={COLORS.danger} fillOpacity={0.22} />
              <Circle cx={geo.x(a.t)} cy={geo.y(a.v)} r={3.5} fill={COLORS.danger} stroke={COLORS.bg} strokeWidth={1.5} />
            </React.Fragment>
          ))}

          <SvgText x={PAD_L} y={height - 6} fill={COLORS.faint} fontSize={10.5} fontFamily={FONTS.medium} textAnchor="start">{fmtHM(geo.t0)}</SvgText>
          <SvgText x={(PAD_L + w - PAD_R) / 2} y={height - 6} fill={COLORS.faint} fontSize={10.5} fontFamily={FONTS.medium} textAnchor="middle">{fmtHM((geo.t0 + geo.t1) / 2)}</SvgText>
          <SvgText x={w - PAD_R} y={height - 6} fill={COLORS.faint} fontSize={10.5} fontFamily={FONTS.medium} textAnchor="end">{fmtHM(geo.t1)}</SvgText>
        </Svg>
      )}
    </View>
  );
}

// Mini-courbe pour les cartes de l'accueil
export function Sparkline({ points, color, width = 120, height = 36 }) {
  const d = useMemo(() => {
    if (points.length < 2) return null;
    let y0 = Infinity, y1 = -Infinity;
    for (const p of points) { if (p.v < y0) y0 = p.v; if (p.v > y1) y1 = p.v; }
    if (y0 === y1) { y0 -= 1; y1 += 1; }
    const t0 = points[0].t, tspan = points[points.length - 1].t - t0 || 1;
    return points
      .map((p, i) => `${i ? 'L' : 'M'}${(((p.t - t0) / tspan) * width).toFixed(1)} ${(3 + (1 - (p.v - y0) / (y1 - y0)) * (height - 6)).toFixed(1)}`)
      .join('');
  }, [points, width, height]);
  if (!d) return <View style={{ width, height }} />;
  return (
    <Svg width={width} height={height}>
      <Path d={d} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.faint },
});
