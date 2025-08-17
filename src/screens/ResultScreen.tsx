import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome5 } from '@expo/vector-icons';
import { MotiView } from 'moti';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Result'>;
type ResultRouteProp = RouteProp<RootStackParamList, 'Result'>;

type TicketInfo = {
  turno?: string;       // ej: "PAGO-015"
  ventanilla?: string;  // ej: "Caja 1"
  // opcionales por si en el futuro envías más campos
  prefix?: string;
  turnNumber?: number;
};

export default function ResultScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ResultRouteProp>();

  // Seguridad: si no vienen params, evita crashear
  const rawInfo = (route.params as any)?.ticketInfo as TicketInfo | undefined;

  // Normaliza lo que vas a mostrar
  const { turno, ventanilla } = useMemo(() => {
    const safeTurno =
      rawInfo?.turno ||
      // fallback por si en algún flujo mandas prefix + turnNumber
      (rawInfo?.prefix && rawInfo?.turnNumber
        ? `${rawInfo.prefix}-${String(rawInfo.turnNumber).padStart(3, '0')}`
        : '—');

    const safeVentanilla = rawInfo?.ventanilla; // si no viene, simplemente no se muestra
    return { turno: safeTurno, ventanilla: safeVentanilla };
  }, [rawInfo?.turno, rawInfo?.ventanilla, rawInfo?.prefix, rawInfo?.turnNumber]);

  const handleBack = () => {
    navigation.navigate('Home');
  };

  // Si no llegó nada, muestra UI de “sin datos”
  if (!rawInfo) {
    return (
      <LinearGradient colors={['#0f172a', '#1e3a8a']} style={styles.wrapper}>
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'timing', duration: 500 }}
          style={styles.card}
        >
          <FontAwesome5 name="exclamation-circle" size={56} color="#ef4444" style={styles.icon} />
          <Text style={styles.title}>No se encontró el ticket</Text>
          <Text style={styles.label}>
            Vuelve a la pantalla principal e intenta generar tu turno nuevamente.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleBack}>
            <Text style={styles.buttonText}>Volver al inicio</Text>
          </TouchableOpacity>
        </MotiView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f172a', '#1e3a8a']} style={styles.wrapper}>
      <MotiView
        from={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 600 }}
        style={styles.card}
      >
        <FontAwesome5 name="check-circle" size={60} color="#10b981" style={styles.icon} />
        <Text style={styles.title}>¡Gracias por registrarse!</Text>

        <Text style={styles.label}>Su turno asignado es:</Text>
        <Text style={styles.turno}>{turno}</Text>

        {!!ventanilla && (
          <>
            <Text style={styles.label}>Ventanilla:</Text>
            <Text style={styles.ventanilla}>{ventanilla}</Text>
          </>
        )}

        <TouchableOpacity style={styles.button} onPress={handleBack}>
          <Text style={styles.buttonText}>Volver al inicio</Text>
        </TouchableOpacity>
      </MotiView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 30,
    width: '85%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 8,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1e40af',
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 12,
    marginBottom: 4,
    textAlign: 'center',
  },
  turno: {
    fontSize: 36,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  ventanilla: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e40af',
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 10,
    marginTop: 20,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
