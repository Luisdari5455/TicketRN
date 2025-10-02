import React, { useMemo } from 'react';
import {
  Text,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  Image,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { width, height } = useWindowDimensions();
  const minSide = Math.min(width, height);

  const bp = useMemo(() => {
    if (width >= 1024) return 'lg';
    if (width >= 768) return 'md';
    return 'sm';
  }, [width]);

  const scale = (base: number) => {
    const factor = Math.max(0.9, Math.min(width / 375, 1.6));
    return Math.round(base * factor);
  };

  const sizes = useMemo(() => {
    // ⬇️ reducimos un poco los porcentajes para hacer más pequeño el logo central
    const circlePct = bp === 'lg' ? 0.30 : bp === 'md' ? 0.34 : 0.38;
    const circleSize = Math.min(380, Math.max(200, minSide * circlePct));
    const logoSize = circleSize * 0.75;

    const titleBase = bp === 'lg' ? 64 : bp === 'md' ? 56 : 44;
    const subtitleBase = bp === 'lg' ? 28 : bp === 'md' ? 24 : 18;

    // ⬇️ reducimos también el logo de la esquina
    const corner = Math.max(70, Math.min(160, width * (bp === 'lg' ? 0.12 : bp === 'md' ? 0.14 : 0.18)));
    const centerPad = bp === 'lg' ? 48 : bp === 'md' ? 36 : 24;

    return {
      circleSize,
      logoSize,
      titleFS: scale(titleBase),
      subtitleFS: scale(subtitleBase),
      cornerSize: corner,
      centerPad,
    };
  }, [bp, minSide, width]);

  const handleTouch = () => {
    navigation.replace('Home');
  };

  return (
    <TouchableWithoutFeedback onPress={handleTouch}>
      <LinearGradient
        colors={['#104c80', '#104c80', '#104c80', '#0f172a']}
        style={styles.container}
      >
        <View style={[styles.centerContent, { padding: sizes.centerPad }]}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 1000 }}
            style={{ alignItems: 'center', width: '100%' }}
          >
            <View
              style={[
                styles.logoBg,
                {
                  width: sizes.circleSize,
                  height: sizes.circleSize,
                  borderRadius: sizes.circleSize / 2,
                },
              ]}
            >
              <Image
                source={require('../../assets/EEMQ2.png')}
                style={{ width: sizes.logoSize, height: sizes.logoSize }}
                resizeMode="contain"
              />
            </View>

            <Text
              style={[
                styles.title,
                {
                  fontSize: sizes.titleFS,
                  lineHeight: sizes.titleFS * 1.06,
                },
              ]}
            >
              ¡Bienvenidos!
            </Text>

            <Text
              style={[
                styles.subtitle,
                {
                  fontSize: sizes.subtitleFS,
                  lineHeight: sizes.subtitleFS * 1.2,
                  marginTop: 2,
                },
              ]}
            >
              Toque la pantalla para iniciar
            </Text>
          </MotiView>
        </View>

        <Image
          source={require('../../assets/eemq1.png')}
          style={[
            styles.cornerImage,
            {
              width: sizes.cornerSize,
              height: sizes.cornerSize,
              marginLeft: bp === 'lg' ? 18 : 10,
              marginBottom: bp === 'lg' ? 18 : 10,
              opacity: bp === 'sm' ? 0.9 : 0.85,
            },
          ]}
          resizeMode="contain"
        />
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { maxWidth: 1200, alignSelf: 'center', width: '100%' } : {}),
  },
  logoBg: {
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
      },
      android: {
        elevation: 8,
      },
      default: {},
    }),
  },
  title: {
    color: '#ffffff',
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#ffffff',
    textAlign: 'center',
  },
  cornerImage: {
    position: 'absolute',
    left: 0,
    bottom: 0,
  },
});
