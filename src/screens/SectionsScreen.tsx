import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  Pressable,
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { FontAwesome5 } from '@expo/vector-icons';
import { getServices, registerTicket } from '../services/ticketService';
import type { RouteProp } from '@react-navigation/native';

// ✅ NUEVOS IMPORTS
import { useIdleReset } from '../hooks/useIdleReset';
import { useKeepAwake } from 'expo-keep-awake';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Sections'>;
type SectionsRouteProp = RouteProp<RootStackParamList, 'Sections'>;

interface ServiceType {
  idService: number;
  name: string;
  description?: string;
}

const { width, height } = Dimensions.get('window');

// Paleta (coherente con lo que vienes usando)
const COL_CHAMBRAY = '#3b618c';
const COL_DEEP = '#104c80';
const COL_NAVY = '#0f172a';

// Tamaño del popup centrado
const SHEET_HEIGHT = Math.min(height * 0.68, 560);
const MAX_SHEET_WIDTH = 720;

// Timeout duro para evitar loops de espera (ms)
const SUBMIT_TIMEOUT_MS = 15000;

export default function SectionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SectionsRouteProp>();

  // ✅ ahora leemos también sessionId
  const { dpi, name, sessionId } = route.params || ({} as any);

  const [sections, setSections] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsService, setDetailsService] = useState<ServiceType | null>(null);

  // Estado de envío para bloquear UI y evitar dobles taps
  const [submittingServiceId, setSubmittingServiceId] = useState<number | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Animaciones para popup centrado
  const sheetY = useRef(new Animated.Value(40)).current; // slide-in
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // ✅ Mantener pantalla encendida (kiosko)
  useKeepAwake();

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ✅ Guardia de sesión: si no viene sessionId, vuelve a Home
  useEffect(() => {
    if (!sessionId) {
      Alert.alert('Sesión inválida', 'Vuelve a iniciar el registro.');
      navigation.replace('Welcome');
    }
  }, [sessionId, navigation]);

  // ✅ Inactividad: si no hay interacción, cerrar modal, limpiar y volver a Home
  const { bump } = useIdleReset({
    timeoutMs: 60000, // 60s (ajústalo a tu necesidad)
    onTimeout: () => {
      setDetailsVisible(false);
      Alert.alert('Sesión reiniciada', 'Sin actividad, se reinició el flujo.');
      navigation.replace('Welcome');
    },
  });

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await getServices();
        setSections(data.items);
      } catch (err) {
        console.error('Error al obtener servicios', err);
        Alert.alert('Error', 'No se pudieron cargar las secciones');
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sheetY, {
        toValue: detailsVisible ? 0 : 40,
        duration: detailsVisible ? 220 : 180,
        easing: detailsVisible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: detailsVisible ? 1 : 0,
        duration: detailsVisible ? 220 : 180,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [detailsVisible, sheetY, overlayOpacity]);

  const clearSafetyTimer = () => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  };

  const startSafetyTimer = () => {
    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => {
      if (!isMountedRef.current) return;
      // Si el server está muy lento o no responde, protegemos la UX
      setSubmittingServiceId(null);
      setDetailsVisible(false);
      Alert.alert(
        'Tiempo de espera agotado',
        'No se pudo completar la operación. Vuelve a intentarlo.',
        [{ text: 'Aceptar', onPress: () => navigation.replace('Welcome') }]
      );
    }, SUBMIT_TIMEOUT_MS);
  };

const handleSelect = async (section: ServiceType) => {
  if (submittingServiceId !== null) return;

  try {
    bump();
    setSubmittingServiceId(section.idService);
    startSafetyTimer();

    const idempotencyKey = `${sessionId || 'nosession'}:${dpi || 'nodpi'}:${section.idService}`;

    // ⬇️ NO mandes dpi si no existe
    const payload: any = {
      name,
      idService: section.idService,
      locationId: 'sucursal-central-01',
      idempotencyKey,
    };
    if (dpi) payload.dpi = dpi;

    const ticketInfo = await registerTicket(payload);

    if (!isMountedRef.current) return;
    clearSafetyTimer();
    setSubmittingServiceId(null);

    navigation.navigate('Result', { ticketInfo });
  } catch (error: any) {
    console.error('Error al registrar ticket:', error?.response?.data || error?.message || error);
    if (!isMountedRef.current) return;
    clearSafetyTimer();
    setSubmittingServiceId(null);
    Alert.alert('Error', 'No se pudo registrar el ticket.');
  }
};


  const openDetails = (service: ServiceType) => {
    if (submittingServiceId !== null) return; // no abrir mientras enviamos
    bump(); // ✅
    setDetailsService(service);
    setDetailsVisible(true);
  };

  const closeDetails = () => {
    if (submittingServiceId !== null) return; // bloquear cierre durante envío
    bump(); // ✅
    setDetailsVisible(false);
  };

  const splitDesc = (desc?: string) =>
    (desc || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

  const renderPreviewChips = (desc?: string, onOpenMore?: () => void) => {
    const parts = splitDesc(desc);
    if (parts.length === 0) {
      if (!desc) return null;
      return (
        <Text style={styles.descFallback} numberOfLines={2} ellipsizeMode="tail">
          {desc}
        </Text>
      );
    }
    const preview = parts.slice(0, 2);
    const restCount = Math.max(parts.length - preview.length, 0);

    return (
      <View style={styles.chipsRow}>
        {preview.map((p, idx) => (
          <View key={`${p}-${idx}`} style={styles.chip}>
            <Text style={styles.chipText}>{p}</Text>
          </View>
        ))}
        {restCount > 0 && (
          <TouchableOpacity
            onPress={onOpenMore}
            style={[styles.chip, styles.moreChip]}
            activeOpacity={0.85}
            disabled={submittingServiceId !== null}
          >
            <Text style={styles.chipText}>+{restCount}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    // ✅ Cualquier toque en pantalla reinicia el timer
    <Pressable style={{ flex: 1 }} onTouchStart={bump}>
      <LinearGradient colors={[COL_DEEP, COL_DEEP, COL_DEEP, COL_NAVY]} style={styles.container}>
        {/* ← Botón para regresar */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            if (submittingServiceId !== null) return; // bloquea atrás durante envío
            bump(); // ✅
            navigation.goBack();
          }}
          accessibilityLabel="Regresar"
          activeOpacity={0.85}
          disabled={submittingServiceId !== null}
        >
          <FontAwesome5 name="arrow-left" size={20} color="#ffffff" />
        </TouchableOpacity>

        <MotiView
          from={{ opacity: 0, translateY: -20 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 700 }}
        >
          <Text style={styles.title}>Seleccione una sección</Text>
        </MotiView>

        <FlatList
          data={sections}
          keyExtractor={(item) => item?.idService?.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const disabled = submittingServiceId !== null;
            const isSubmittingThis = submittingServiceId === item.idService;

            return (
              <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'timing', delay: index * 100 }}
              >
                <TouchableOpacity
                  style={[
                    styles.cardButton,
                    disabled && { opacity: isSubmittingThis ? 1 : 0.6 },
                  ]}
                  onPress={() => handleSelect(item)}
                  activeOpacity={0.9}
                  disabled={disabled}
                >
                  <FontAwesome5 name="chevron-right" size={18} color="#fff" style={styles.icon} />
                  <Text style={styles.cardTitle}>{item.name}</Text>

                  <View style={{ width: '100%', marginTop: 8, alignItems: 'center' }}>
                    {renderPreviewChips(item.description, () => openDetails(item))}
                  </View>

                  <TouchableOpacity
                    style={styles.infoButton}
                    onPress={() => openDetails(item)}
                    activeOpacity={0.85}
                    disabled={disabled}
                  >
                    <FontAwesome5 name="info-circle" size={18} color="#e2e8f0" />
                  </TouchableOpacity>

                  {/* Indicador inline en la tarjeta que está enviando */}
                  {isSubmittingThis && (
                    <View style={styles.inlineLoading}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.inlineLoadingText}>Generando ticket…</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </MotiView>
            );
          }}
        />

        {/* ===== Popup CENTRADO ===== */}
        <Modal
          visible={detailsVisible}
          transparent
          animationType="none"
          onRequestClose={closeDetails}
        >
          <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={closeDetails} />

          <View pointerEvents="box-none" style={styles.sheetContainer}>
            <Animated.View
              style={[
                styles.sheet,
                {
                  transform: [{ translateY: sheetY }],
                  height: SHEET_HEIGHT,
                  width: Math.min(width * 0.92, MAX_SHEET_WIDTH),
                },
              ]}
            >
              <LinearGradient
                colors={[COL_CHAMBRAY, COL_CHAMBRAY, COL_CHAMBRAY]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sheetGradient}
              >
                <SafeAreaView style={{ flex: 1 }}>
                  {/* Grip */}
                  <View style={styles.handleWrap}>
                    <View style={styles.handle} />
                  </View>

                  {/* Header */}
                  <View style={styles.sheetHeader}>
                    <Text style={styles.sheetTitle} numberOfLines={1}>
                      {detailsService?.name || 'Detalles'}
                    </Text>
                    <TouchableOpacity onPress={closeDetails} style={styles.sheetCloseBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      disabled={submittingServiceId !== null}
                    >
                      <FontAwesome5 name="times" size={18} color="#ffffff" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.headerDivider} />

                  {/* Contenido */}
                  <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.sheetBody}
                    showsVerticalScrollIndicator
                  >
                    {(() => {
                      const parts = splitDesc(detailsService?.description);
                      if (parts.length === 0) {
                        return (
                          <Text style={styles.sheetDescText}>
                            {detailsService?.description || 'Sin descripción.'}
                          </Text>
                        );
                      }
                      return (
                        <View style={styles.modalChipsWrap}>
                          {parts.map((p, idx) => (
                            <View key={`${p}-${idx}`} style={styles.modalChip}>
                              <Text style={styles.modalChipText}>{p}</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </ScrollView>

                  {/* Footer */}
                  <View style={styles.sheetFooter}>
                    <TouchableOpacity
                      style={styles.modalCloseBtn}
                      onPress={closeDetails}
                      activeOpacity={0.9}
                      disabled={submittingServiceId !== null}
                    >
                      <Text style={styles.modalCloseText}>Cerrar</Text>
                    </TouchableOpacity>
                  </View>
                </SafeAreaView>
              </LinearGradient>
            </Animated.View>
          </View>
        </Modal>

        {/* Overlay global opcional (si prefieres en vez del inline) */}
        <Modal visible={submittingServiceId !== null} transparent animationType="fade">
          <View style={styles.globalOverlay}>
            <View style={styles.globalLoaderCard}>
              <ActivityIndicator size="large" />
              <Text style={styles.globalLoaderText}>Procesando…</Text>
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  backButton: {
    position: 'absolute',
    top: Platform.select({ ios: 18, android: 16 }) as number,
    left: 16,
    zIndex: 20,
    padding: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 40,
    letterSpacing: 0.3,
  },
  listContainer: {
    alignItems: 'center',
    paddingBottom: 40,
  },
  cardButton: {
    width: width * 0.9,
    backgroundColor: '#2563EB',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.15 : 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
    position: 'relative',
  },
  icon: {
    position: 'absolute',
    left: 16,
    top: '50%',
    transform: [{ translateY: -9 }],
    opacity: 0.9,
  },
  cardTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8 as any,
    justifyContent: 'center',
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderColor: 'rgba(255,255,255,0.24)',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 6,
  },
  moreChip: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  chipText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  descFallback: {
    color: '#e5e7eb',
    fontSize: 14,
    textAlign: 'center',
  },

  infoButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    padding: 6,
  },

  // Inline loader sobre la tarjeta seleccionada
  inlineLoading: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8 as any,
    backgroundColor: 'rgba(0,0,0,0.18)',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  inlineLoadingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,12,18,0.55)',
  },
  sheetContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  sheet: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.25 : 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 24,
    overflow: 'hidden',
    backgroundColor: COL_NAVY,
  },
  sheetGradient: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
  },
  handleWrap: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  sheetHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: { color: '#ffffff', fontSize: 18, fontWeight: '800', letterSpacing: 0.3 },
  sheetCloseBtn: { position: 'absolute', right: 12, top: 10, padding: 6 },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },

  sheetBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  sheetDescText: {
    color: '#ffffff',
    opacity: 0.95,
    fontSize: 16,
    lineHeight: 22,
  },
  modalChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  modalChip: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  modalChipText: {
    color: '#fff',
    fontSize: 14.5,
    fontWeight: '700',
  },
  sheetFooter: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 10,
    borderTopColor: 'rgba(255,255,255,0.18)',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalCloseBtn: {
    alignSelf: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    minWidth: 160,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  modalCloseText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },

  // Overlay global
  globalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  globalLoaderCard: {
    backgroundColor: '#fff',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    minWidth: 180,
    alignItems: 'center',
  },
  globalLoaderText: {
    marginTop: 10,
    fontWeight: '700',
    color: '#111827',
  },
});
