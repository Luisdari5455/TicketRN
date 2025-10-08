import React, { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import Toast from "react-native-toast-message";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome5 } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { MotiView } from "moti";
import { useIdleReset } from "../hooks/useIdleReset";
import { getClientByDpi } from "../services/ticketService";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "DPI">;

const DEPARTAMENTOS = [
  'Guatemala','El Progreso','Sacatepéquez','Chimaltenango','Escuintla','Santa Rosa',
  'Sololá','Totonicapán','Quetzaltenango','Suchitepéquez','Retalhuleu','San Marcos',
  'Huehuetenango','Quiché','Baja Verapaz','Alta Verapaz','Petén','Izabal',
  'Zacapa','Chiquimula','Jalapa','Jutiapa'
];
const MUNIS_POR_DEPTO = [17,8,16,16,13,14,19,8,24,21,9,30,32,21,8,17,14,5,11,11,7,17];

function validateCUI(raw: string): { ok: true; deptoName: string; muniNum: number } | { ok: false; reason: string } {
  const cuiRegExp = /^[0-9]{4}\s?[0-9]{5}\s?[0-9]{4}$/;
  if (!raw) return { ok: false, reason: "El DPI está vacío." };
  if (!cuiRegExp.test(raw)) return { ok: false, reason: "El DPI tiene un formato inválido." };

  const cui = raw.replace(/\s/g, "");
  if (cui.length !== 13) return { ok: false, reason: "El DPI debe tener 13 dígitos." };

  const depto = parseInt(cui.substring(9, 11), 10);
  const muni  = parseInt(cui.substring(11, 13), 10);
  const numero = cui.substring(0, 8);
  const verificador = parseInt(cui.substring(8, 9), 10);

  if (depto === 0 || muni === 0) return { ok: false, reason: "Departamento o municipio inválidos." };
  if (depto > MUNIS_POR_DEPTO.length) return { ok: false, reason: "Departamento inexistente." };
  if (muni > MUNIS_POR_DEPTO[depto - 1]) {
    return { ok: false, reason: `El municipio ${muni} no existe en el departamento ${DEPARTAMENTOS[depto - 1]}.` };
  }

  let total = 0;
  for (let i = 0; i < numero.length; i++) {
    const n = parseInt(numero[i], 10);
    if (Number.isNaN(n)) return { ok: false, reason: "El DPI contiene caracteres inválidos." };
    total += n * (i + 2);
  }
  const modulo = total % 11;
  if (modulo !== verificador) return { ok: false, reason: "El DPI no es válido (dígito verificador)." };

  return { ok: true, deptoName: DEPARTAMENTOS[depto - 1], muniNum: muni };
}

function splitFullName(full: string) {
  const parts = full.trim().replace(/\s+/g, " ").split(" ");
  if (parts.length === 1) return { nombre: parts[0], apellido: "" };
  if (parts.length === 2) return { nombre: parts[0], apellido: parts[1] };
  return { nombre: parts.slice(0, -1).join(" "), apellido: parts.slice(-1).join(" ") };
}

const sanitizeName = (raw: string) =>
  raw
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\s]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s+/g, '')
    .slice(0, 60);

export default function DpiScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [dpi, setDpi] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [locked, setLocked] = useState(false);
  const lastQueried = useRef<string>("");
  const autoFillDpiRef = useRef<string | null>(null);

  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const sessionId = useMemo(() => (global as any).crypto?.randomUUID?.() ?? String(Date.now()), []);

  const clearAll = useCallback((): void => {
    setDpi('');
    setNombre('');
    setApellido('');
    setLocked(false);
    lastQueried.current = "";
    autoFillDpiRef.current = null;
  }, []);

  const clearAutoFilled = useCallback((): void => {
    if (locked || autoFillDpiRef.current) {
      setLocked(false);
      setNombre('');
      setApellido('');
      autoFillDpiRef.current = null;
    }
  }, [locked]);

  const safeBack = useCallback(() => {
    if (navigation.canGoBack?.() && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    try {
      navigation.replace('Welcome' as any);
    } catch {
      navigation.reset({ index: 0, routes: [{ name: 'Welcome' as any }] } as any);
    }
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      clearAll();
      return () => { clearAll(); };
    }, [clearAll])
  );

  const { bump } = useIdleReset({
    timeoutMs: 60000,
    onTimeout: () => {
      clearAll();
      Toast.show({ type: "info", text1: "Sesión reiniciada por inactividad" });
      navigation.replace("Welcome" as any);
    },
  });

  const bumpOnFocus = useCallback(() => bump(), [bump]);
  const bumpOnKey = useCallback(() => bump(), [bump]);

  useEffect(() => {
    const run = async () => {
      if (dpi.length !== 13) return;
      const v = validateCUI(dpi);
      if (!v.ok) return;

      if (lastQueried.current === dpi) return;
      lastQueried.current = dpi;

      try {
        const client = await getClientByDpi(dpi);
        if (client && client.name) {
          const { nombre: n, apellido: a } = splitFullName(client.name);
          setNombre(sanitizeName(n));
          setApellido(sanitizeName(a));
          setLocked(true);
          autoFillDpiRef.current = dpi;
          Toast.show({ type: "success", text1: "Cliente encontrado", text2: "Datos autocompletados." });
        } else {
          setLocked(false);
          autoFillDpiRef.current = null;
        }
      } catch {
        setLocked(false);
        autoFillDpiRef.current = null;
      }
    };

    const t = setTimeout(run, 200);
    return () => clearTimeout(t);
  }, [dpi]);

  useEffect(() => {
    if (dpi.length < 13) {
      clearAutoFilled();
      lastQueried.current = "";
    } else if (autoFillDpiRef.current && dpi !== autoFillDpiRef.current) {
      clearAutoFilled();
    }
  }, [dpi, clearAutoFilled]);

  const dpiRef = useRef<TextInput>(null);
  const nombreRef = useRef<TextInput>(null);
  const apellidoRef = useRef<TextInput>(null);

  const handleNext = () => {
    const result = validateCUI(dpi);
    if (!result.ok) {
      Toast.show({ type: "error", text1: "DPI inválido", text2: result.reason || "Ingrese un número de DPI válido de 13 dígitos." });
    } else if (!nombre.trim() || !apellido.trim()) {
      Toast.show({ type: "error", text1: "Campos requeridos", text2: "Ingrese nombre y apellido." });
    } else {
      Keyboard.dismiss();
      navigation.navigate("Sections" as any, {
        dpi: dpi.replace(/\D/g, ""),
        name: `${nombre.trim()} ${apellido.trim()}`,
        sessionId,
      } as any);
    }
  };

  const dismissAndBump = () => {
    Keyboard.dismiss();
    bump();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 8}
    >
      <TouchableWithoutFeedback onPress={dismissAndBump} accessible={false}>
        <View style={{ flex: 1 }}>
          <LinearGradient
            colors={['#104c80','#104c80','#104c80','#0f172a']}
            style={styles.wrapper}
          >
            {/* Flecha fija, circular, respeta Safe Area */}
            <TouchableOpacity
              style={[styles.backButton, { top: insets.top + 12, left: 12 }]}
              onPress={() => { bump(); safeBack(); }}
              activeOpacity={0.85}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              accessibilityRole="button"
              accessibilityLabel="Regresar"
            >
              <FontAwesome5 name="arrow-left" size={18} color="#ffffff" />
            </TouchableOpacity>

            <ScrollView
              contentContainerStyle={[
                styles.scrollContent,
                { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
              automaticallyAdjustKeyboardInsets={true}
            >
              <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: "timing", duration: 700 }}
                style={styles.inner}
              >
                <FontAwesome5 name="id-card" size={60} color="#fff" style={styles.icon} />
                <Text style={styles.title}>Registro con DPI</Text>
                <Text style={styles.subtitle}>Por favor, ingrese sus datos</Text>

                {/* DPI */}
                <TextInput
                  ref={dpiRef}
                  style={styles.input}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  placeholder="DPI: 1234567890123"
                  maxLength={13}
                  value={dpi}
                  onChangeText={(text) => {
                    bump();
                    const numericText = text.replace(/[^0-9]/g, "").slice(0, 13);
                    setDpi(numericText);
                    if (numericText.length < 13 || (autoFillDpiRef.current && numericText !== autoFillDpiRef.current)) {
                      clearAutoFilled();
                      lastQueried.current = "";
                    }
                  }}
                  onKeyPress={bumpOnKey}
                  onFocus={bumpOnFocus}
                  placeholderTextColor="#9CA3AF"
                  contextMenuHidden
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => { bump(); nombreRef.current?.focus(); }}
                />

                {/* Nombre */}
                <TextInput
                  ref={nombreRef}
                  style={[styles.input, locked && { backgroundColor: "#f3f4f6" }]}
                  placeholder="Nombre"
                  value={nombre}
                  onChangeText={(text) => { bump(); setNombre(sanitizeName(text)); }}
                  onKeyPress={bumpOnKey}
                  onFocus={bumpOnFocus}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="default"
                  inputMode="text"
                  autoCapitalize="words"
                  autoCorrect={false}
                  importantForAutofill="no"
                  textContentType="name"
                  autoComplete="name"
                  editable={!locked}
                  contextMenuHidden
                  maxLength={60}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={() => { bump(); apellidoRef.current?.focus(); }}
                />

                {/* Apellido */}
                <TextInput
                  ref={apellidoRef}
                  style={[styles.input, locked && { backgroundColor: "#f3f4f6" }]}
                  placeholder="Apellido"
                  value={apellido}
                  onChangeText={(text) => { bump(); setApellido(sanitizeName(text)); }}
                  onKeyPress={bumpOnKey}
                  onFocus={bumpOnFocus}
                  placeholderTextColor="#9CA3AF"
                  keyboardType="default"
                  inputMode="text"
                  autoCapitalize="words"
                  autoCorrect={false}
                  importantForAutofill="no"
                  textContentType="familyName"
                  autoComplete="name-family"
                  editable={!locked}
                  contextMenuHidden
                  maxLength={60}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => { bump(); Keyboard.dismiss(); handleNext(); }}
                />

                {locked && (
                  <TouchableOpacity onPress={() => { bump(); setLocked(false); }} style={{ marginBottom: 8 }}>
                    <Text style={{ color: "#93c5fd" }}>Editar nombre/apellido</Text>
                  </TouchableOpacity>
                )}

                <View style={styles.buttonWrapper}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPressIn={() => { bump(); scale.value = withSpring(0.95); }}
                    onPressOut={() => { scale.value = withSpring(1); }}
                    onPress={() => { bump(); Keyboard.dismiss(); handleNext(); }}
                  >
                    <Animated.View style={[styles.animatedButton, animatedStyle]}>
                      <Text style={styles.buttonText}>Continuar</Text>
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              </MotiView>
            </ScrollView>
          </LinearGradient>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  inner: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    flexGrow: 1,
  },

  backButton: {
    position: "absolute",
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 5,
  },

  icon: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: "800", color: "#ffffff", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 16, color: "#e5e7eb", marginBottom: 20, textAlign: "center", paddingHorizontal: 12 },

  input: {
    width: "90%",
    backgroundColor: "#ffffff",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 18,
    marginBottom: 16,
    textAlign: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },

  buttonWrapper: { width: "90%", borderRadius: 10, overflow: "hidden", marginTop: 10 },
  animatedButton: {
    backgroundColor: "#1e40af",
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 4,
    width: "100%",
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600", letterSpacing: 0.5 },
});
