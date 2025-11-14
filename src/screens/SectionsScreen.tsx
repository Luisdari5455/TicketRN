import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Animated,
  Easing,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";
import { FontAwesome5 } from "@expo/vector-icons";
import { getServices, registerTicket } from "../services/ticketService";
import type { RouteProp } from "@react-navigation/native";
import { useIdleReset } from "../hooks/useIdleReset";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

type NavigationProp = NativeStackNavigationProp<RootStackParamList, "Sections">;
type SectionsRouteProp = RouteProp<RootStackParamList, "Sections">;

interface ServiceType {
  idService: number;
  name: string;
  description?: string;
}

const { width, height } = Dimensions.get("window");

const COL_CHAMBRAY = "#3b618c";
const COL_DEEP = "#104c80";
const COL_NAVY = "#0f172a";

const SHEET_HEIGHT = Math.min(height * 0.68, 560);
const MAX_SHEET_WIDTH = 720;
const SUBMIT_TIMEOUT_MS = 15000;

export default function SectionsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SectionsRouteProp>();
  const insets = useSafeAreaInsets();

  const { dpi, name, sessionId } = route.params || ({} as any);

  const [sections, setSections] = useState<ServiceType[]>([]);
  const [loading, setLoading] = useState(true);

  const [detailsVisible, setDetailsVisible] = useState(false);
  const [detailsService, setDetailsService] = useState<ServiceType | null>(null);

  const [submittingServiceId, setSubmittingServiceId] = useState<number | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const sheetY = useRef(new Animated.Value(40)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  useKeepAwake();

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    };
  }, []);

  const { bump } = useIdleReset({
    timeoutMs: 60000,
    onTimeout: () => {
      setDetailsVisible(false);
      Toast.show({ type: "info", text1: "Sesión reiniciada por inactividad" });
      navigation.replace("Welcome" as any);
    },
  });

  useEffect(() => {
    if (!sessionId) {
      Toast.show({ type: "info", text1: "Sesión inválida Vuelve a iniciar el registro." });
      navigation.replace("Welcome" as any);
    }
  }, [sessionId, navigation]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const data = await getServices();
        setSections(data.items);
      } catch (err) {
        console.error("Error al obtener servicios", err);
        Toast.show({ type: "error", text1: "Error", text2: "No se pudieron cargar las secciones" });
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
      setSubmittingServiceId(null);
      setDetailsVisible(false);
      Alert.alert(
        "Tiempo de espera agotado",
        "No se pudo completar la operación. Vuelve a intentarlo.",
        [{ text: "Aceptar", onPress: () => navigation.replace("Welcome" as any) }]
      );
    }, SUBMIT_TIMEOUT_MS);
  };

  const safeBack = useCallback(() => {
    if (detailsVisible && submittingServiceId === null) {
      bump();
      setDetailsVisible(false);
      return;
    }
    if (navigation.canGoBack?.() && navigation.canGoBack()) {
      bump();
      navigation.goBack();
      return;
    }
    const parent = navigation.getParent?.();
    if (parent) {
      try {
        bump();
        (parent as any).navigate("Home");
        return;
      } catch {}
    }
    try {
      bump();
      (navigation as any).reset({ index: 0, routes: [{ name: "Home" }] });
    } catch {
      (navigation as any).reset({ index: 0, routes: [{ name: "Welcome" }] });
    }
  }, [detailsVisible, submittingServiceId, navigation, bump]);

  const handleSelect = async (section: ServiceType) => {
    if (submittingServiceId !== null) return;

    try {
      bump();
      setSubmittingServiceId(section.idService);
      startSafetyTimer();

      const idempotencyKey = `${sessionId || "nosession"}:${dpi || "nodpi"}:${section.idService}`;

      const payload: any = {
        name,
        idService: section.idService,
        locationId: "sucursal-central-01",
        idempotencyKey,
      };
      if (dpi) payload.dpi = dpi;

      const ticketInfo = await registerTicket(payload);

      if (!isMountedRef.current) return;
      clearSafetyTimer();
      setSubmittingServiceId(null);

      bump();
      navigation.navigate("Result" as any, { ticketInfo });
    } catch (error: any) {
      console.error("Error al registrar ticket:", error?.response?.data || error?.message || error);
      if (!isMountedRef.current) return;
      clearSafetyTimer();
      setSubmittingServiceId(null);
      Alert.alert("Error", "No se pudo registrar el ticket.");
    }
  };

  const openDetails = (service: ServiceType) => {
    if (submittingServiceId !== null) return;
    bump();
    setDetailsService(service);
    setDetailsVisible(true);
  };

  const closeDetails = () => {
    if (submittingServiceId !== null) return;
    bump();
    setDetailsVisible(false);
  };

  const splitDesc = (desc?: string) =>
    (desc || "")
      .split(",")
      .map((s) => s.trim())
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
            onPress={() => {
              bump();
              onOpenMore && onOpenMore();
            }}
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
    <LinearGradient
      colors={[COL_DEEP, COL_DEEP, COL_DEEP, COL_NAVY]}
      style={[styles.container, { paddingTop: insets.top + 12 }]}
      onTouchStart={bump}
    >
      {/* Flecha igual a SinDPI/DPI: fija, circular y translúcida con safe area */}
 <TouchableOpacity
  style={[
    styles.backButton,
    { top: insets.top + 12, left: 75 }  // ← movida un poco a la derecha
  ]}
  onPress={safeBack}
  activeOpacity={0.85}
  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
  accessibilityRole="button"
  accessibilityLabel="Regresar"
>
  <FontAwesome5 name="arrow-left" size={18} color="#ffffff" />
</TouchableOpacity>

      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: "timing", duration: 700 }}
      >
        <Text style={styles.title}>Seleccione una sección</Text>
      </MotiView>

      <FlatList
        data={sections}
        keyExtractor={(item) => item?.idService?.toString() || String(item?.idService)}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        onScroll={bump}
        onMomentumScrollBegin={bump}
        onScrollBeginDrag={bump}
        onScrollEndDrag={bump}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const disabled = submittingServiceId !== null;
          const isSubmittingThis = submittingServiceId === item.idService;

          return (
            <MotiView
              from={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "timing", delay: index * 100 }}
            >
              <TouchableOpacity
                style={[styles.cardButton, disabled && { opacity: isSubmittingThis ? 1 : 0.6 }]}
                onPress={() => handleSelect(item)}
                onPressIn={bump}
                activeOpacity={0.9}
                disabled={disabled}
              >
                <FontAwesome5 name="chevron-right" size={18} color="#fff" style={styles.icon} />
                <Text style={styles.cardTitle}>{item.name}</Text>

                <View style={{ width: "100%", marginTop: 8, alignItems: "center" }}>
                  {renderPreviewChips(item.description, () => openDetails(item))}
                </View>

                <TouchableOpacity
                  style={styles.infoButton}
                  onPress={() => openDetails(item)}
                  onPressIn={bump}
                  activeOpacity={0.85}
                  disabled={disabled}
                >
                  <FontAwesome5 name="info-circle" size={18} color="#e2e8f0" />
                </TouchableOpacity>

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
        ListEmptyComponent={
          !loading ? <Text style={{ color: "#e5e7eb" }}>No hay secciones disponibles.</Text> : null
        }
      />

      {/* ===== Popup CENTRADO ===== */}
      <Modal
        visible={detailsVisible}
        transparent
        animationType="none"
        onRequestClose={() => {
          bump();
          closeDetails();
        }}
        onShow={bump}
      >
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]} />
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject as any}
          activeOpacity={1}
          onPress={() => {
            bump();
            closeDetails();
          }}
        />
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
                <View style={styles.handleWrap}>
                  <View style={styles.handle} />
                </View>

                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle} numberOfLines={1}>
                    {detailsService?.name || "Detalles"}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      bump();
                      closeDetails();
                    }}
                    style={styles.sheetCloseBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    disabled={submittingServiceId !== null}
                  >
                    <FontAwesome5 name="times" size={18} color="#ffffff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.headerDivider} />

                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.sheetBody}
                  showsVerticalScrollIndicator
                  onScroll={bump}
                  onScrollBeginDrag={bump}
                  onMomentumScrollBegin={bump}
                  onScrollEndDrag={bump}
                  scrollEventThrottle={16}
                >
                  {(() => {
                    const parts = (detailsService?.description || "")
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean);
                    if (parts.length === 0) {
                      return (
                        <Text style={styles.sheetDescText}>
                          {detailsService?.description || "Sin descripción."}
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

                <View style={styles.sheetFooter}>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => {
                      bump();
                      closeDetails();
                    }}
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

      {/* Overlay global de carga */}
      <Modal visible={submittingServiceId !== null} transparent animationType="fade" onShow={bump}>
        <View style={styles.globalOverlay}>
          <View style={styles.globalLoaderCard}>
            <ActivityIndicator size="large" />
            <Text style={styles.globalLoaderText}>Procesando…</Text>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },

  // ✅ misma flecha que SinDPI/DPI
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

  // (puedes borrar backPill/backLabel si ya no los usas)
  backPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 6,
  },
  backLabel: { color: "#0f172a", fontSize: 16, fontWeight: "700", marginLeft: 8 },

  title: {
    fontSize: 30,
    fontWeight: "700",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 40,
    letterSpacing: 0.3,
  },
  listContainer: { alignItems: "center", paddingBottom: 40 },
  cardButton: {
    width: width * 0.9,
    backgroundColor: "#2563EB",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.15 : 0.18,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 6,
    position: "relative",
  },
  icon: {
    position: "absolute",
    left: 16,
    top: "50%",
    transform: [{ translateY: -9 }],
    opacity: 0.9,
  },
  cardTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.2,
  },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 as any, justifyContent: "center" },
  chip: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderColor: "rgba(255,255,255,0.24)",
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 6,
  },
  moreChip: { backgroundColor: "rgba(255,255,255,0.25)" },
  chipText: { color: "#fff", fontSize: 13.5, fontWeight: "700", letterSpacing: 0.2 },
  descFallback: { color: "#e5e7eb", fontSize: 14, textAlign: "center" },

  infoButton: { position: "absolute", right: 12, top: 12, padding: 6 },

  inlineLoading: {
    position: "absolute",
    bottom: 12,
    right: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8 as any,
    backgroundColor: "rgba(0,0,0,0.18)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  inlineLoadingText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(10,12,18,0.55)" },
  sheetContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  sheet: {
    borderRadius: 24,
    shadowColor: "#000",
    shadowOpacity: Platform.OS === "ios" ? 0.25 : 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 24,
    overflow: "hidden",
    backgroundColor: COL_NAVY,
  },
  sheetGradient: { flex: 1, borderRadius: 24, overflow: "hidden" },
  handleWrap: { alignItems: "center", paddingTop: 10, paddingBottom: 4 },
  handle: { width: 48, height: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.5)" },
  sheetHeader: { paddingHorizontal: 16, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  sheetTitle: { color: "#ffffff", fontSize: 18, fontWeight: "800", letterSpacing: 0.3 },
  sheetCloseBtn: { position: "absolute", right: 12, top: 10, padding: 6 },
  headerDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.18)" },

  sheetBody: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 8 },
  sheetDescText: { color: "#ffffff", opacity: 0.95, fontSize: 16, lineHeight: 22 },
  modalChipsWrap: { flexDirection: "row", flexWrap: "wrap" },
  modalChip: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderColor: "rgba(255,255,255,0.28)",
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  modalChipText: { color: "#fff", fontSize: 14.5, fontWeight: "700" },
  sheetFooter: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    paddingTop: 10,
    borderTopColor: "rgba(255,255,255,0.18)",
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  modalCloseBtn: {
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 14,
    minWidth: 160,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  modalCloseText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  globalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" },
  globalLoaderCard: {
    backgroundColor: "#fff",
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 14,
    minWidth: 180,
    alignItems: "center",
  },
  globalLoaderText: { marginTop: 10, fontWeight: "700", color: "#111827" },
});
