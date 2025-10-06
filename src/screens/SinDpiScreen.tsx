import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableOpacity,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome5 } from "@expo/vector-icons";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { MotiView } from "moti";
import { useIdleReset } from "../hooks/useIdleReset";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SinDPI">;

export default function SinDpiScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const scale = useSharedValue(1);

  // ⏫ Flecha: coordenada absoluta Y
  const [arrowTop, setArrowTop] = useState(insets.top + 120);
  const nameRef = useRef<TextInput>(null);
  const SECRET_SAFE = 110; // evita el hotspot 100x100
  const SHIFT = 44;        // cuánto arriba del input (ajústalo si quieres)

  const sessionId = useMemo(
    () => (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
    []
  );

  const sanitize = useCallback((raw: string) => {
    return raw
      .normalize("NFC")
      .replace(/[^\p{L}\p{M}\s'’-]/gu, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^\s+/g, "")
      .slice(0, 60);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  useFocusEffect(
    useCallback(() => {
      setNombre("");
      setApellido("");
      return undefined;
    }, [])
  );

  // ⚠️ NO toco tu manejo de idle / navegación
  const { bump } = useIdleReset({
    timeoutMs: 60000,
    onTimeout: () => {
      setNombre("");
      setApellido("");
      Alert.alert("Sesión reiniciada", "Sin actividad, se limpió el formulario.");
      navigation.replace("Welcome");
    },
  });

  const handleNext = () => {
    if (!nombre.trim() || !apellido.trim()) {
      Alert.alert("Datos incompletos", "Por favor, ingrese su nombre y apellido");
      return;
    }
    navigation.navigate("Sections", {
      name: `${nombre.trim()} ${apellido.trim()}`,
      sessionId,
    });
  };

  const handleNombreChange = (t: string) => { setNombre(sanitize(t)); bump(); };
  const handleApellidoChange = (t: string) => { setApellido(sanitize(t)); bump(); };

  const safeBack = () => {
    if (navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const parent = navigation.getParent?.();
    if (parent) {
      try { parent.navigate("Home" as never); return; } catch {}
    }
    try { navigation.reset({ index: 0, routes: [{ name: "Home" as never }] }); }
    catch { navigation.reset({ index: 0, routes: [{ name: "Welcome" as never }] }); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable style={{ flex: 1 }} onTouchStart={bump}>
        <LinearGradient colors={["#104c80", "#104c80", "#104c80", "#0f172a"]} style={styles.wrapper}>
          {/* Flecha: absoluta respecto a toda la pantalla, ubicada con Y real del input */}
          <TouchableOpacity
            style={[styles.backButton, { top: Math.max(insets.top + SECRET_SAFE, arrowTop) }]}
            onPress={() => { bump(); safeBack(); }}
            activeOpacity={0.8}
            hitSlop={{ top: 18, bottom: 18, left: 18, right: 18 }}
            accessibilityRole="button"
            accessibilityLabel="Regresar"
          >
            <FontAwesome5 name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 700 }}
            style={styles.container}
          >
            <FontAwesome5 name="user" size={60} color="#fff" style={styles.icon} />
            <Text style={styles.title}>Registro sin DPI</Text>
            <Text style={styles.subtitle}>Por favor, ingrese su nombre y apellido</Text>

            {/* Primer input: medimos su posición absoluta en pantalla */}
            <TextInput
              ref={nameRef}
              style={styles.input}
              placeholder="Nombre"
              placeholderTextColor="#9CA3AF"
              value={nombre}
              onChangeText={handleNombreChange}
              keyboardType="default"
              inputMode="text"
              autoCapitalize="words"
              autoCorrect={false}
              importantForAutofill="no"
              textContentType="name"
              contextMenuHidden
              maxLength={60}
              onLayout={() => {
                // esperamos al siguiente frame y medimos en ventana
                requestAnimationFrame(() => {
                  nameRef.current?.measureInWindow?.((x, y, w, h) => {
                    if (typeof y === "number") setArrowTop(y - SHIFT);
                  });
                });
              }}
            />

            <TextInput
              style={styles.input}
              placeholder="Apellido"
              placeholderTextColor="#9CA3AF"
              value={apellido}
              onChangeText={handleApellidoChange}
              keyboardType="default"
              inputMode="text"
              autoCapitalize="words"
              autoCorrect={false}
              importantForAutofill="no"
              textContentType="familyName"
              contextMenuHidden
              maxLength={60}
            />

            <View style={styles.buttonWrapper}>
              <Pressable
                onPressIn={() => { scale.value = withSpring(0.95); }}
                onPressOut={() => { scale.value = withSpring(1); bump(); handleNext(); }}
              >
                <Animated.View style={[styles.animatedButton, animatedStyle]}>
                  <Text style={styles.buttonText}>Continuar</Text>
                </Animated.View>
              </Pressable>
            </View>
          </MotiView>
        </LinearGradient>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { justifyContent: "center", alignItems: "center", padding: 24, flex: 1 },
  icon: { marginBottom: 20 },

  // Flecha blanca simple en el borde izquierdo
  backButton: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    padding: 10,
  },

  title: { fontSize: 28, fontWeight: "800", color: "#ffffff", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 16, color: "#e5e7eb", marginBottom: 30, textAlign: "center", paddingHorizontal: 12 },

  input: {
    width: "90%",
    backgroundColor: "#fff",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 18,
    marginBottom: 20,
    textAlign: "left",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  buttonWrapper: { width: "90%", borderRadius: 10, overflow: "hidden" },
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
