import React from 'react';
import {
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  Platform,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();

  const handleTouch = () => {
    navigation.replace('Home'); // reemplaza para que no pueda volver atrás
  };

  return (
    <TouchableWithoutFeedback onPress={handleTouch}>
      <LinearGradient
        colors={['#0f172a', '#1e3a8a']}
        style={styles.container}
      >
        <MotiView
          from={{ opacity: 0, translateY: 20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 1000 }}
        >
          <Text style={styles.title}>¡Bienvenidos!</Text>
          <Text style={styles.subtitle}>Toque la pantalla para iniciar</Text>
        </MotiView>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 48,
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 24,
    color: '#D1D5DB',
    textAlign: 'center',
  },
});
