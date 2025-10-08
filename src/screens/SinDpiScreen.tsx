import React, { useMemo, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
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
import Toast from "react-native-toast-message";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SinDPI">;

export default function SinDpiScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const scale = useSharedValue(1);

  const nameRef = useRef<TextInput>(null);
  const lastNameRef = useRef<TextInput>(null); // 👈 para mover foco y poder “bump” al enviar

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

  const { bump } = useIdleReset({
    timeoutMs: 60000,
    onTimeout: () => {
      setNombre("");
      setApellido("");
      Toast.show({ type: "info", text1: "Sesión reiniciada por inactividad" });
      navigation.replace("Welcome");
    },
  });

  const handleNext = () => {
    if (!nombre.trim() || !apellido.trim()) {
      Toast.show({
        type: "info",
        text1: "Datos incompletos",
        text2: "Por favor, ingrese su nombre y apellido",
      });
      return;
    }
    navigation.navigate("Sections", {
      name: `${nombre.trim()} ${apellido.trim()}`,
      sessionId,
    });
  };

  const handleNombreChange = (t: string) => {
    setNombre(sanitize(t));
    bump(); // 👈 teclear reinicia
  };
  const handleApellidoChange = (t: string) => {
    setApellido(sanitize(t));
    bump(); // 👈 teclear reinicia
  };

  const safeBack = () => {
    if (navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    const parent = navigation.getParent?.();
    if (parent) {
      try {
        parent.navigate("Home" as never);
        return;
      } catch {}
    }
    try {
      navigation.reset({ index: 0, routes: [{ name: "Home" as never }] });
    } catch {
      navigation.reset({ index: 0, routes: [{ name: "Welcome" as never }] });
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable style={{ flex: 1 }} onTouchStart={bump}>
        <LinearGradient
          colors={["#104c80", "#104c80", "#104c80", "#0f172a"]}
          style={styles.wrapper}
        >
          {/* Flecha fija en la esquina superior izquierda con Safe Area */}
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 12, left: 12 }]}
            onPress={() => {
              bump();
              safeBack();
            }}
            activeOpacity={0.85}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            accessibilityRole="button"
            accessibilityLabel="Regresar"
          >
            <FontAwesome5 name="arrow-left" size={18} color="#ffffff" />
          </TouchableOpacity>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 700 }}
            style={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 12 }]}
          >
            <FontAwesome5 name="user" size={60} color="#fff" style={styles.icon} />
            <Text style={styles.title}>Registro sin DPI</Text>
            <Text style={styles.subtitle}>Por favor, ingrese su nombre y apellido</Text>

            <TextInput
              ref={nameRef}
              style={styles.input}
              placeholder="Nombre"
              placeholderTextColor="#9CA3AF"
              value={nombre}
              onChangeText={handleNombreChange}
              onFocus={() => bump()}           // 👈 foco cuenta como actividad
              onKeyPress={() => bump()}        // 👈 keypress cuenta como actividad
              keyboardType="default"
              inputMode="text"
              autoCapitalize="words"
              autoCorrect={false}
              importantForAutofill="no"
              textContentType="name"
              contextMenuHidden
              maxLength={60}
              returnKeyType="next"
              onSubmitEditing={() => { bump(); lastNameRef.current?.focus(); }} // 👈
            />

            <TextInput
              ref={lastNameRef}
              style={styles.input}
              placeholder="Apellido"
              placeholderTextColor="#9CA3AF"
              value={apellido}
              onChangeText={handleApellidoChange}
              onFocus={() => bump()}           // 👈
              onKeyPress={() => bump()}        // 👈
              keyboardType="default"
              inputMode="text"
              autoCapitalize="words"
              autoCorrect={false}
              importantForAutofill="no"
              textContentType="familyName"
              contextMenuHidden
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={() => { bump(); handleNext(); }} // 👈
            />

            <View style={styles.buttonWrapper}>
              <Pressable
                onPressIn={() => {
                  bump();
                  scale.value = withSpring(0.95);
                }}
                onPressOut={() => {
                  scale.value = withSpring(1);
                  bump();
                  handleNext();
                }}
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
  container: { justifyContent: "center", alignItems: "center", paddingHorizontal: 24, flex: 1 },
  icon: { marginBottom: 20 },

  // Botón de regreso (flotante, circular, con sombra)
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

  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#e5e7eb",
    marginBottom: 30,
    textAlign: "center",
    paddingHorizontal: 12,
  },

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
