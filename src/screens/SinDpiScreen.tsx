import React, { useMemo, useState, useCallback } from "react";
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
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { MotiView } from "moti";
import { useIdleReset } from "../hooks/useIdleReset";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "SinDPI">;

export default function SinDpiScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const scale = useSharedValue(1);

  // ID de sesión opcional
  const sessionId = useMemo(
    () => (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
    []
  );

  // === Sanitizador: solo letras (todas las lenguas), tildes, apóstrofo, guion, espacios ===
  // \p{L} = letras Unicode, \p{M} = marcas (tildes combinadas)
  const sanitize = useCallback((raw: string) => {
    return raw
      .normalize("NFC") // normaliza tildes
      .replace(/[^\p{L}\p{M}\s'’-]/gu, "") // quita todo lo que NO sea letra/tilde/espacio/'/–
      .replace(/\s{2,}/g, " ") // colapsa espacios múltiples
      .replace(/^\s+/g, "") // sin espacios al inicio
      .slice(0, 60); // límite razonable (opcional)
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Limpia al entrar/enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      setNombre("");
      setApellido("");
      return undefined;
    }, [])
  );

  // Inactividad: reinicia
  const { bump } = useIdleReset({
    timeoutMs: 60000,
    onTimeout: () => {
      setNombre("");
      setApellido("");
      Alert.alert(
        "Sesión reiniciada",
        "Sin actividad, se limpió el formulario."
      );

      navigation.replace("Welcome");
    },
  });

  const handleNext = () => {
    if (!nombre.trim() || !apellido.trim()) {
      Alert.alert(
        "Datos incompletos",
        "Por favor, ingrese su nombre y apellido"
      );
      return;
    }
    navigation.navigate("Sections", {
      name: `${nombre.trim()} ${apellido.trim()}`,
      sessionId,
    } as any);
  };

  const handleNombreChange = (text: string) => {
    const clean = sanitize(text);
    setNombre(clean);
    bump();
  };

  const handleApellidoChange = (text: string) => {
    const clean = sanitize(text);
    setApellido(clean);
    bump();
  };

  // ---------- ✅ Back robusto ----------
  const safeBack = () => {
    // 1) Volver si hay historial en este stack
    if (navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    // 2) Intentar navegar en el navegador padre (Tabs/Drawer) a 'Home'
    const parent = navigation.getParent?.();
    if (parent) {
      try {
        parent.navigate("Home" as never);
        return;
      } catch (_) {
        // ignoramos y seguimos al reset
      }
    }

    // 3) Último recurso: resetear este stack a 'Home' (o 'Welcome')
    try {
      navigation.reset({
        index: 0,
        routes: [{ name: "Home" as never }],
      });
    } catch {
      navigation.reset({
        index: 0,
        routes: [{ name: "Welcome" as never }],
      });
    }
  };
  // -------------------------------------

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Captura de interacción global para reiniciar el timer */}
      <Pressable style={{ flex: 1 }} onTouchStart={bump}>
        <LinearGradient
          colors={["#104c80", "#104c80", "#104c80", "#0f172a"]}
          style={styles.wrapper}
        >
          {/* Flecha para regresar */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              bump();
              safeBack();
            }}
          >
            <FontAwesome5 name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 700 }}
            style={styles.container}
          >
            <FontAwesome5
              name="user"
              size={60}
              color="#fff"
              style={styles.icon}
            />
            <Text style={styles.title}>Registro sin DPI</Text>
            <Text style={styles.subtitle}>
              Por favor, ingrese su nombre y apellido
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre"
              placeholderTextColor="#9CA3AF"
              value={nombre}
              onChangeText={handleNombreChange}
              keyboardType="default" // no numérico
              autoCapitalize="words"
              autoCorrect={false}
              importantForAutofill="no"
              textContentType="name"
              contextMenuHidden={true} // opcional: bloquea pegar/copiar
            />
            <TextInput
              style={styles.input}
              placeholder="Apellido"
              placeholderTextColor="#9CA3AF"
              value={apellido}
              onChangeText={handleApellidoChange}
              keyboardType="default"
              autoCapitalize="words"
              autoCorrect={false}
              importantForAutofill="no"
              textContentType="familyName"
              contextMenuHidden={true} // opcional
            />

            <View style={styles.buttonWrapper}>
              <Pressable
                onPressIn={() => {
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
  container: {
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    flex: 1,
  },
  icon: { marginBottom: 20 },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 10,
    padding: 10,
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
  buttonText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
});
