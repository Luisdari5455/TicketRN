import React, { useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import Toast from "react-native-toast-message";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome5 } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { MotiView } from "moti";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "DPI">;

export default function DpiScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [dpi, setDpi] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  /**
   * Validación estructural de DPI de Guatemala
   * - 13 dígitos
   * - Departamento 01-22
   * - Municipio válido según dpto
   * - Evita entradas obvias inválidas (todos iguales, todos ceros)
   * Retorna { ok, reason }
   */
  const validateDpi = (raw: string): { ok: boolean; reason?: string } => {
    const value = (raw || "").replace(/\D/g, "");

    if (value.length !== 13) {
      return { ok: false, reason: "El DPI debe tener 13 dígitos." };
    }

    // Evitar todos ceros o todos el mismo dígito
    if (/^([0])\1{12}$/.test(value) || /^(\d)\1{12}$/.test(value)) {
      return { ok: false, reason: "El DPI ingresado no es válido." };
    }

    // Extrae depto (pos 10-11) y muni (pos 12-13) en base 1
    const depto = parseInt(value.substring(9, 11), 10);   // dígitos 10-11 (1-indexed)
    const muni  = parseInt(value.substring(11, 13), 10);  // dígitos 12-13 (1-indexed)

    if (!Number.isInteger(depto) || !Number.isInteger(muni) || depto <= 0 || muni <= 0) {
      return { ok: false, reason: "Departamento o municipio inválidos." };
    }

    const municipiosPorDepto: Record<number, number> = {
      1: 17,  2: 8,  3: 16, 4: 16, 5: 14, 6: 30, 7: 19, 8: 8,  9: 11, 10: 17,
      11: 33, 12: 30, 13: 21, 14: 8,  15: 17, 16: 14, 17: 5,  18: 11, 19: 30,
      20: 17, 21: 11, 22: 34,
    };

    const maxMuni = municipiosPorDepto[depto];
    if (!maxMuni) {
      return { ok: false, reason: "Departamento inexistente." };
    }
    if (muni > maxMuni) {
      return { ok: false, reason: `El municipio no existe en el departamento ${depto}.` };
    }

    // (Opcional) Puedes agregar más reglas aquí (p.ej., listas negras conocidas, etc.)

    return { ok: true };
  };

  const handleNext = () => {
    const result = validateDpi(dpi);
    if (!result.ok) {
      Toast.show({
        type: "error",
        text1: "DPI inválido",
        text2: result.reason || "Ingrese un número de DPI válido de 13 dígitos.",
      });
      return;
    }

    if (!nombre.trim() || !apellido.trim()) {
      Toast.show({
        type: "error",
        text1: "Campos requeridos",
        text2: "Ingrese nombre y apellido.",
      });
      return;
    }

    navigation.navigate("Sections", {
      dpi: dpi.replace(/\D/g, ""),
      name: `${nombre.trim()} ${apellido.trim()}`,
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#0f172a", "#1e3a8a"]} style={styles.container}>
        {/* Flecha de regreso */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate("Home")}
        >
          <FontAwesome5 name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>

        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 700 }}
          style={styles.innerContainer}
        >
          <FontAwesome5 name="id-card" size={60} color="#fff" style={styles.icon} />
          <Text style={styles.title}>Registro con DPI</Text>
          <Text style={styles.subtitle}>
            Por favor, ingrese sus datos
          </Text>

          {/* DPI */}
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="DPI: 1234567890123"
            maxLength={13}
            value={dpi}
            onChangeText={(text) => {
              // Solo números, tope 13
              const numericText = text.replace(/[^0-9]/g, "").slice(0, 13);
              setDpi(numericText);
            }}
            placeholderTextColor="#9CA3AF"
          />

          {/* Nombre */}
          <TextInput
            style={styles.input}
            placeholder="Nombre"
            value={nombre}
            onChangeText={setNombre}
            placeholderTextColor="#9CA3AF"
          />

          {/* Apellido */}
          <TextInput
            style={styles.input}
            placeholder="Apellido"
            value={apellido}
            onChangeText={setApellido}
            placeholderTextColor="#9CA3AF"
          />

          {/* Botón continuar */}
          <View style={styles.buttonWrapper}>
            <Pressable
              onPressIn={() => {
                scale.value = withSpring(0.95);
              }}
              onPressOut={() => {
                scale.value = withSpring(1);
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  innerContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  icon: {
    marginBottom: 20,
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
    marginBottom: 20,
    textAlign: "center",
    paddingHorizontal: 12,
  },
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
  buttonWrapper: {
    width: "90%",
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 10,
  },
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
