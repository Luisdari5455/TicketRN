import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { useIdleReset } from '../hooks/useIdleReset';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SinDPI'>;

export default function SinDpiScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const scale = useSharedValue(1);

  // ID de sesión
  const sessionId = useMemo(
    () => (globalThis as any).crypto?.randomUUID?.() ?? String(Date.now()),
    []
  );

  // Sanitizador: solo letras/tildes/espacios/apóstrofo/guion
  const sanitize = useCallback((raw: string) => {
    return raw
      .normalize('NFC')
      .replace(/[^\p{L}\p{M}\s'’-]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/^\s+/g, '')
      .slice(0, 60);
  }, []);

  const onlyLetters = /^[\p{L}\p{M}\s'’-]+$/u;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Limpia al enfocar
  useFocusEffect(
    useCallback(() => {
      setNombre('');
      setApellido('');
      return undefined;
    }, [])
  );

  // Inactividad
  const { bump } = useIdleReset({
    timeoutMs: 60000,
    onTimeout: () => {
      setNombre('');
      setApellido('');
      Alert.alert('Sesión reiniciada', 'Sin actividad, se limpió el formulario.');
      navigation.replace('Welcome');
    },
  });

  const handleNext = () => {
    const name = nombre.trim();
    const last = apellido.trim();

    if (!name || !last) {
      Alert.alert('Datos incompletos', 'Por favor, ingrese su nombre y apellido');
      return;
    }
    if (!onlyLetters.test(name) || !onlyLetters.test(last)) {
      Alert.alert('Entrada inválida', 'Sólo se permiten letras y espacios.');
      return;
    }

    navigation.navigate('Sections', {
      name: `${name} ${last}`,
      sessionId,
    });
  };

  const handleNombreChange = (text: string) => {
    setNombre(sanitize(text));
    bump();
  };

  const handleApellidoChange = (text: string) => {
    setApellido(sanitize(text));
    bump();
  };

  // Back seguro
  const safeBack = useCallback(() => {
    if (navigation.canGoBack?.() && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    try {
      navigation.replace('Welcome');
    } catch {
      navigation.reset({
        index: 0,
        routes: [{ name: 'Welcome' as keyof RootStackParamList } as any],
      });
    }
  }, [navigation]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Contenedor que capta interacción sin bloquear hijos */}
      <LinearGradient
        colors={['#104c80', '#104c80', '#104c80', '#0f172a']}
        style={styles.wrapper}
        onTouchStart={bump}
      >
        {/* Botón de regreso grande y visible */}
        <TouchableOpacity
          style={[styles.backButton, { top: insets.top + 8 }]}
          onPress={() => {
            bump();
            safeBack();
          }}
          activeOpacity={0.75}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          accessibilityRole="button"
          accessibilityLabel="Regresar"
        >
          <View style={styles.backPill}>
            <FontAwesome5 name="arrow-left" size={18} color="#0f172a" />
            <Text style={styles.backLabel}>Regresar</Text>
          </View>
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
            inputMode="text"
            returnKeyType="next"
            autoCapitalize="words"
            autoCorrect={false}
            importantForAutofill="no"
            textContentType="name"
            contextMenuHidden
            maxLength={60}
            onSubmitEditing={() => {
              // opcional: enfocar el segundo input si usas ref
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
            returnKeyType="done"
            autoCapitalize="words"
            autoCorrect={false}
            importantForAutofill="no"
            textContentType="familyName"
            contextMenuHidden
            maxLength={60}
            onSubmitEditing={handleNext}
          />

          <View style={styles.buttonWrapper}>
            <TouchableOpacity
              activeOpacity={0.85}
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
            </TouchableOpacity>
          </View>
        </MotiView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  container: { justifyContent: 'center', alignItems: 'center', padding: 24, flex: 1 },
  icon: { marginBottom: 20 },

  // Botón back
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 50,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 as any, // RN <0.73 puede no tipar gap; visualmente funciona
    backgroundColor: '#ffffff',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
  },
  backLabel: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '700',
  },

  // Textos
  title: { fontSize: 28, fontWeight: '800', color: '#ffffff', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 16, color: '#e5e7eb', marginBottom: 30, textAlign: 'center', paddingHorizontal: 12 },

  // Inputs
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

  // Botón continuar
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
