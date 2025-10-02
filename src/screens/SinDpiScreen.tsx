import React, { useMemo, useState } from 'react';
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
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import { useCallback } from 'react';
import { useIdleReset } from '../hooks/useIdleReset'; // <— importa el hook

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SinDPI'>;

export default function SinDpiScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const scale = useSharedValue(1);

  // (Opcional) Un sessionId para este intento de registro
  const sessionId = useMemo(() => crypto.randomUUID?.() ?? String(Date.now()), []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Limpia SIEMPRE al entrar/enfocar la pantalla
  useFocusEffect(
    useCallback(() => {
      setNombre('');
      setApellido('');
      return undefined;
    }, [])
  );

  // Inactividad: si no hay interacción en X ms, limpia y regresa a Home
  const { bump } = useIdleReset({
    timeoutMs: 60000, // 60s (ajústalo a lo que necesites)
    onTimeout: () => {
      setNombre('');
      setApellido('');
      Alert.alert('Sesión reiniciada', 'Sin actividad, se limpió el formulario.');
      navigation.replace('Welcome');
    },
  });

  const handleNext = () => {
    if (!nombre.trim() || !apellido.trim()) {
      Alert.alert('Datos incompletos', 'Por favor, ingrese su nombre y apellido');
      return;
    }
    navigation.navigate('Sections', {
      name: `${nombre.trim()} ${apellido.trim()}`,
      sessionId, // <— opcional
    } as any);
  };

  const handleNombreChange = (text: string) => {
    const clean = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']/g, '');
    setNombre(clean);
    bump();
  };

  const handleApellidoChange = (text: string) => {
    const clean = text.replace(/[^a-zA-ZáéíóúÁÉÍÓÚüÜñÑ\s']/g, '');
    setApellido(clean);
    bump();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Captura de interacción global para reiniciar el timer */}
      <Pressable style={{ flex: 1 }} onTouchStart={bump}>
        <LinearGradient colors={['#104c80','#104c80','#104c80','#0f172a']} style={styles.wrapper}>
          {/* Flecha para regresar */}
          <TouchableOpacity style={styles.backButton} onPress={() => { bump(); navigation.navigate('Home'); }}>
            <FontAwesome5 name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>

          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 700 }}
            style={styles.container}
          >
            <FontAwesome5 name="user" size={60} color="#fff" style={styles.icon} />
            <Text style={styles.title}>Registro sin DPI</Text>
            <Text style={styles.subtitle}>Por favor, ingrese su nombre y apellido</Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre"
              placeholderTextColor="#9CA3AF"
              value={nombre}
              onChangeText={handleNombreChange}
              keyboardType="default"
              autoCapitalize="words"
              autoCorrect={false}
              importantForAutofill="no"
              textContentType="name"
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
  container: { justifyContent: 'center', alignItems: 'center', padding: 24, flex: 1 },
  icon: { marginBottom: 20 },
  backButton: { position: 'absolute', top: 40, left: 20, zIndex: 10, padding: 10 },
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#e5e7eb', marginBottom: 30, textAlign: 'center', paddingHorizontal: 12 },
  input: {
    width: '90%',
    backgroundColor: '#fff',
    borderColor: '#cbd5e1',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'left',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  buttonWrapper: { width: '90%', borderRadius: 10, overflow: 'hidden' },
  animatedButton: {
    backgroundColor: '#1e40af',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 4,
    width: '100%',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600', letterSpacing: 0.5 },
});
