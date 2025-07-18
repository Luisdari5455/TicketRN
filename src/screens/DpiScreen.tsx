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

  const isValidDpi = (dpi: string): boolean => {
    if (!/^\d{13}$/.test(dpi)) return false;

    const depto = parseInt(dpi.substring(9, 11), 10);
    const muni = parseInt(dpi.substring(11, 13), 10);

    if (depto === 0 || muni === 0) return false;

    const municipiosPorDepto: Record<number, number> = {
      1: 17, 2: 8, 3: 16, 4: 16, 5: 14, 6: 30, 7: 19, 8: 8, 9: 11, 10: 17,
      11: 33, 12: 30, 13: 21, 14: 8, 15: 17, 16: 14, 17: 5, 18: 11, 19: 30,
      20: 17, 21: 11, 22: 34,
    };

    const maxMuni = municipiosPorDepto[depto];
    return !!maxMuni && muni <= maxMuni;
  };

  const handleNext = () => {
    if (!isValidDpi(dpi)) {
      Toast.show({
        type: "error",
        text1: "DPI inválido",
        text2: "Ingrese un número de DPI válido de 13 dígitos.",
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
      dpi,
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
              const numericText = text.replace(/[^0-9]/g, "");
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
