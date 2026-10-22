import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase, isConfigured, SUPABASE_URL } from '../lib/supabase';
import { COLORS, FONTS } from '../theme';
import { Mail, Lock, Eye, EyeOff, Alert, Shield } from '../components/Icons';

const NOT_CONFIGURED =
  "Supabase n'est pas configuré : colle l'URL et la clé anon de ton site web dans src/config/supabase.config.js, puis relance « npx expo start -c ».";

// Connexion uniquement : les comptes superviseurs sont créés sur le site web.
const translateError = (msg = '') => {
  const m = msg.toLowerCase();
  if (!isConfigured) return NOT_CONFIGURED;
  if (m.includes('invalid login credentials')) return 'E-mail ou mot de passe incorrect (compte du site web).';
  if (m.includes('email not confirmed')) return "Ce compte n'est pas encore confirmé. Vérifiez vos e-mails.";
  if (m.includes('invalid api key')) return 'Clé Supabase invalide : vérifie SUPABASE_ANON_KEY dans supabase.config.js.';
  if (m.includes('fetch') || m.includes('network'))
    return `Impossible de joindre ${SUPABASE_URL}. Vérifie l'URL dans supabase.config.js (la même que le site web) et ta connexion.`;
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessayez dans quelques minutes.';
  return msg || 'Une erreur est survenue.';
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [focus, setFocus] = useState(null);
  const pwdRef = useRef(null);

  const reveal = useRef([0, 1, 2, 3].map(() => new Animated.Value(0))).current;
  const ring = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(
      140,
      reveal.map((r) =>
        Animated.timing(r, { toValue: 1, duration: 700, easing: Easing.bezier(0.2, 0.7, 0.2, 1), useNativeDriver: true })
      )
    ).start();
    const l = Animated.loop(Animated.timing(ring, { toValue: 1, duration: 2600, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, []);

  const doShake = () => {
    shake.setValue(0);
    Animated.sequence(
      [10, -10, 7, -7, 3, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true }))
    ).start();
  };

  const onSubmit = async () => {
    if (loading) return;
    setError(null);
    if (!email.trim() || !password) {
      setError('Saisissez votre e-mail et votre mot de passe.');
      doShake();
      return;
    }
    if (!isConfigured) {
      setError(NOT_CONFIGURED);
      doShake();
      return;
    }
    setLoading(true);
    let e = null;
    try {
      ({ error: e } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }));
    } catch (err) {
      e = err;
    }
    setLoading(false);
    if (e) console.warn('[SAFE WORKER] Erreur de connexion :', e.message);
    if (e) {
      setError(translateError(e.message));
      doShake();
    }
    // Succès : App.js détecte la session et ouvre l'accueil automatiquement.
  };

  const rv = (r) => ({
    opacity: r,
    transform: [{ translateY: r.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
  });

  return (
    <View style={styles.root}>
      <View style={styles.stripe} />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {!isConfigured ? (
              <View style={[styles.error, { marginTop: 16 }]}>
                <Alert color={COLORS.dangerText} size={16} />
                <Text style={styles.errorText}>{NOT_CONFIGURED}</Text>
              </View>
            ) : null}

            <Animated.View style={[styles.logoWrap, rv(reveal[0])]}>
              <Animated.View
                style={[
                  styles.logoRing,
                  {
                    opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                    transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
                  },
                ]}
              />
              <View style={styles.logo}><Shield color={COLORS.accentInk} size={30} /></View>
            </Animated.View>

            <Animated.View style={rv(reveal[1])}>
              <Text style={styles.kicker}>ESPACE SUPERVISEUR</Text>
              <Text style={styles.title}>Connexion</Text>
              <Text style={styles.subtitle}>Utilisez le compte superviseur créé sur la plateforme web SAFE WORKER.</Text>
            </Animated.View>

            <Animated.View style={[styles.form, rv(reveal[2]), { transform: [...rv(reveal[2]).transform, { translateX: shake }] }]}>
              <Text style={styles.label}>Adresse e-mail</Text>
              <View style={[styles.field, focus === 'email' && styles.fieldFocus]}>
                <Mail color={focus === 'email' ? COLORS.accent : COLORS.faint} />
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="superviseur@entreprise.com"
                  placeholderTextColor="#5D6775"
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  textContentType="username"
                  returnKeyType="next"
                  onSubmitEditing={() => pwdRef.current?.focus()}
                  onFocus={() => setFocus('email')}
                  onBlur={() => setFocus(null)}
                  style={styles.input}
                  accessibilityLabel="Adresse e-mail"
                />
              </View>

              <Text style={[styles.label, { marginTop: 16 }]}>Mot de passe</Text>
              <View style={[styles.field, focus === 'pwd' && styles.fieldFocus]}>
                <Lock color={focus === 'pwd' ? COLORS.accent : COLORS.faint} />
                <TextInput
                  ref={pwdRef}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#5D6775"
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={onSubmit}
                  onFocus={() => setFocus('pwd')}
                  onBlur={() => setFocus(null)}
                  style={styles.input}
                  accessibilityLabel="Mot de passe"
                />
                <Pressable
                  onPress={() => setShowPwd((s) => !s)}
                  accessibilityRole="button"
                  accessibilityLabel={showPwd ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  hitSlop={10}
                  style={styles.eye}
                >
                  {showPwd ? <EyeOff color={COLORS.faint} /> : <Eye color={COLORS.faint} />}
                </Pressable>
              </View>

              {error ? (
                <View style={styles.error} accessibilityLiveRegion="polite">
                  <Alert color={COLORS.dangerText} size={16} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </Animated.View>

            <Animated.View style={[styles.actions, rv(reveal[3])]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Se connecter"
                onPress={onSubmit}
                disabled={loading}
                style={({ pressed }) => [styles.cta, (pressed || loading) && { opacity: 0.85, transform: [{ scale: 0.985 }] }]}
              >
                {loading ? <ActivityIndicator color={COLORS.accentInk} /> : <Text style={styles.ctaText}>Se connecter</Text>}
              </Pressable>
              <View style={styles.info}>
                <Text style={styles.infoText}>
                  Pas de compte ? Les comptes sont créés uniquement par l'administrateur sur le site web.
                </Text>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  stripe: { height: 4, backgroundColor: COLORS.accent },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 28 },
  back: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, marginTop: 10,
  },
  logoWrap: { alignSelf: 'center', marginTop: 26, marginBottom: 28, width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  logoRing: { position: 'absolute', width: 76, height: 76, borderRadius: 24, borderWidth: 2, borderColor: COLORS.accent },
  logo: { width: 76, height: 76, borderRadius: 24, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: FONTS.displaySemi, fontSize: 12, letterSpacing: 2.4, color: COLORS.accent },
  title: { fontFamily: FONTS.display, fontSize: 34, color: COLORS.text, marginTop: 6 },
  subtitle: { fontFamily: FONTS.body, fontSize: 15, lineHeight: 22, color: COLORS.muted, marginTop: 8 },
  form: { marginTop: 28 },
  label: { fontFamily: FONTS.semi, fontSize: 13, color: COLORS.text, marginBottom: 8 },
  field: {
    height: 56, borderRadius: 16, backgroundColor: COLORS.card, borderWidth: 1.5, borderColor: COLORS.border,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12,
  },
  fieldFocus: { borderColor: COLORS.accent, backgroundColor: COLORS.cardHi },
  input: { flex: 1, height: '100%', color: COLORS.text, fontFamily: FONTS.medium, fontSize: 15 },
  eye: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  error: {
    flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 16, padding: 12, borderRadius: 12,
    backgroundColor: COLORS.dangerBg, borderWidth: 1, borderColor: COLORS.dangerBorder,
  },
  errorText: { flex: 1, fontFamily: FONTS.medium, fontSize: 13.5, color: COLORS.dangerText },
  actions: { marginTop: 'auto', paddingTop: 28, gap: 14 },
  cta: { height: 56, borderRadius: 16, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.accentInk },
  info: { padding: 14, borderRadius: 14, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  infoText: { fontFamily: FONTS.body, fontSize: 12.5, lineHeight: 18, color: COLORS.faint, textAlign: 'center' },
});
