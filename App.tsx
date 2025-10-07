// App.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Platform,
  View,
  AppState,
  AppStateStatus,
  Modal,
  Text,
  TextInput,
  Pressable,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useKeepAwake } from "expo-keep-awake";
import * as ScreenOrientation from "expo-screen-orientation";
import * as NavigationBar from "expo-navigation-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { stopKioskIfPossible } from "./src/native/KioskMode";
import { BridgeClient } from "./src/printing/bridgeClient";
import AppNavigator from "./src/navigation/AppNavigator";
import Toast from "react-native-toast-message";
import { CustomToast } from "./src/components/CustomToast";
import { loadConfig, saveConfig, defaultConfig, RuntimeConfig } from "./src/config/runtimeConfig";

const toastConfig = {
  success: (props: any) => <CustomToast {...props} />,
  error: (props: any) => <CustomToast {...props} />,
};

const ENTRY_PIN = "2580";
const ADMIN_PIN = "4321";

export default function App() {
  useKeepAwake();

  const [isUnlocked, setIsUnlocked] = useState(false);
  const [entryPin, setEntryPin] = useState("");
  const [entryVisible, setEntryVisible] = useState(true);

  const [cfg, setCfg] = useState<RuntimeConfig>(defaultConfig);
  const [cfgVisible, setCfgVisible] = useState(false);
  const [cfgPinAsk, setCfgPinAsk] = useState(false);
  const [cfgPin, setCfgPin] = useState("");

  const bridgeRef = useRef<BridgeClient | null>(null);

  const tapsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unlockVisible, setUnlockVisible] = useState(false);
  const [exitPin, setExitPin] = useState("");

  useEffect(() => {
    // cargar config persistida al inicio
    (async () => {
      const c = await loadConfig();
      setCfg(c);
    })();
  }, []);

  const hideNavBar = async () => {
    if (Platform.OS !== "android") return;
    try {
      await NavigationBar.setVisibilityAsync("hidden");
      await NavigationBar.setBehaviorAsync("overlay-swipe");
      await NavigationBar.setBackgroundColorAsync("transparent");
    } catch {}
  };

  const handleBridgeStatus = (s: string, info?: any) => {
    console.log("[BRIDGE]", s, info ?? "");
    // Toast.show({ type: s.includes('error') ? 'error' : 'success', text1: s });
  };

  // Inicializa / reconfigura el bridge cuando hay PIN y cfg cargada
  useEffect(() => {
    if (!isUnlocked) return;
    (async () => {
      if (!cfg?.backendUrl || !cfg?.locationId || !cfg?.printerIp) return;

      if (!bridgeRef.current) {
        const bridge = new BridgeClient({
          backendUrl: cfg.backendUrl,
          sioPath: cfg.sioPath,
          locationId: cfg.locationId,
          printerIp: cfg.printerIp,
          printerPort: cfg.printerPort,
          token: cfg.token,
          onStatus: handleBridgeStatus,
        });
        bridgeRef.current = bridge;
        await bridge.init();
      } else {
        await bridgeRef.current.reconfigure({
          backendUrl: cfg.backendUrl,
          sioPath: cfg.sioPath,
          locationId: cfg.locationId,
          printerIp: cfg.printerIp,
          printerPort: cfg.printerPort,
          token: cfg.token,
        });
      }
    })();

    return () => {
      // no paramos aquí para no cortar si navega de vuelta; el cierre se hace onExit
    };
  }, [isUnlocked, cfg]);

  useEffect(() => {
    const lockOrientation = async () => {
      try {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } catch {}
    };
    lockOrientation();
    hideNavBar();

    const appSub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") hideNavBar();
    });
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => true);
    const interval = setInterval(hideNavBar, 3000);

    return () => {
      appSub.remove();
      backSub.remove();
      clearInterval(interval);
    };
  }, []);

  const tryEntryUnlock = () => {
    if (entryPin === ENTRY_PIN) {
      setIsUnlocked(true);
      setEntryVisible(false);
      setEntryPin("");
      Toast.show({ type: "success", text1: "Acceso concedido" });
    } else {
      Toast.show({ type: "error", text1: "PIN inválido" });
      setEntryPin("");
    }
  };

  // 5 toques → PIN de salida
  const handleSecretTap = () => {
    tapsRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => (tapsRef.current = 0), 1000);
    if (tapsRef.current >= 5) {
      tapsRef.current = 0;
      setExitPin("");
      setUnlockVisible(true);
    }
  };

  const tryExitUnlock = async () => {
    if (exitPin === ADMIN_PIN) {
      try { bridgeRef.current?.stop(); } catch {}
      const brokeLock = await stopKioskIfPossible();
      await NavigationBar.setVisibilityAsync("visible").catch(() => {});
      Toast.show({
        type: "success",
        text1: brokeLock ? "Lock Task detenido" : "Saliendo",
      });
      BackHandler.exitApp();
    } else {
      Toast.show({ type: "error", text1: "PIN incorrecto" });
      setExitPin("");
    }
  };

  // Mantén pulsado 2s en ESQUINA INFERIOR IZQUIERDA → pedir PIN admin para abrir Config
  const handleLongPressConfig = () => {
    setCfgPin("");
    setCfgPinAsk(true);
  };

  const tryConfigPin = () => {
    if (cfgPin === ADMIN_PIN) {
      setCfgPinAsk(false);
      setCfgVisible(true);
    } else {
      Toast.show({ type: "error", text1: "PIN incorrecto" });
      setCfgPin("");
    }
  };

  const [form, setForm] = useState<RuntimeConfig>(defaultConfig);
  useEffect(() => setForm(cfg), [cfg]);

  const saveAndApplyConfig = async () => {
    const next = await saveConfig(form);
    setCfg(next);             // dispara reconfigure del bridge
    setCfgVisible(false);
    Toast.show({ type: "success", text1: "Configuración aplicada" });
  };

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      {!isUnlocked ? (
        <View
          style={{
            flex: 1,
            backgroundColor: "#0f172a",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              color: "#fff",
              fontSize: 24,
              fontWeight: "800",
              marginBottom: 16,
            }}
          >
            Ingrese PIN para continuar
          </Text>
          <TextInput
            value={entryPin}
            onChangeText={(t) =>
              setEntryPin(t.replace(/[^0-9]/g, "").slice(0, 6))
            }
            placeholder="PIN"
            placeholderTextColor="#94a3b8"
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            style={{
              backgroundColor: "#fff",
              borderRadius: 10,
              paddingVertical: 12,
              paddingHorizontal: 16,
              fontSize: 20,
              width: 280,
              textAlign: "center",
            }}
            returnKeyType="done"
            onSubmitEditing={tryEntryUnlock}
          />
          <Pressable
            onPress={tryEntryUnlock}
            style={{
              marginTop: 16,
              backgroundColor: "#1e40af",
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700" }}>
              Desbloquear
            </Text>
          </Pressable>
          <Pressable
            onPress={hideNavBar}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: 80,
              height: 80,
            }}
          />
        </View>
      ) : (
        <>
          <View
            style={{ flex: 1, backgroundColor: "#fff" }}
            onLayout={hideNavBar}
          >
            <AppNavigator />
            <Toast config={toastConfig} />
          </View>

            {/* Toque secreto (5 taps) → PIN de salida */}
            <Pressable
              onPress={handleSecretTap}
              style={{
                position: "absolute",
                top: 6,
                right: 6,
                width: 56,
                height: 56,
              }}
            />
            {/* Mantener 2s en esquina inferior izquierda → Config (PIN admin) */}
            <Pressable
              onLongPress={handleLongPressConfig}
              delayLongPress={2000}
              style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                width: 60,
                height: 60,
              }}
            />
        </>
      )}

      {/* PIN de salida */}
      <Modal
        transparent
        visible={unlockVisible}
        animationType="fade"
        onRequestClose={() => setUnlockVisible(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.6)",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onPress={() => setUnlockVisible(false)}
        >
          <Pressable
            onPress={() => {}}
            style={{
              width: 360,
              maxWidth: "95%",
              backgroundColor: "#0f172a",
              borderRadius: 16,
              padding: 20,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
              Salir (PIN requerido)
            </Text>
            <TextInput
              value={exitPin}
              onChangeText={(t) => setExitPin(t.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="PIN"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              secureTextEntry
              autoFocus
              style={{
                backgroundColor: "#fff",
                borderRadius: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                fontSize: 18,
                marginBottom: 16,
                textAlign: "center",
              }}
              returnKeyType="done"
              onSubmitEditing={tryExitUnlock}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
              <Pressable onPress={() => setUnlockVisible(false)} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
                <Text style={{ color: "#cbd5e1", fontSize: 16 }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={tryExitUnlock}
                style={{ backgroundColor: "#1e40af", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Desbloquear</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* PIN para abrir Config */}
      <Modal
        transparent
        visible={cfgPinAsk}
        animationType="fade"
        onRequestClose={() => setCfgPinAsk(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 }}
          onPress={() => setCfgPinAsk(false)}
        >
          <Pressable onPress={() => {}} style={{ width: 360, maxWidth: "95%", backgroundColor: "#0f172a", borderRadius: 16, padding: 20 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
              Configuración (PIN admin)
            </Text>
            <TextInput
              value={cfgPin}
              onChangeText={(t) => setCfgPin(t.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="PIN"
              placeholderTextColor="#94a3b8"
              keyboardType="number-pad"
              secureTextEntry
              autoFocus
              style={{
                backgroundColor: "#fff",
                borderRadius: 8,
                paddingVertical: 12,
                paddingHorizontal: 14,
                fontSize: 18,
                marginBottom: 16,
                textAlign: "center",
              }}
              returnKeyType="done"
              onSubmitEditing={tryConfigPin}
            />
            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12 }}>
              <Pressable onPress={() => setCfgPinAsk(false)} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
                <Text style={{ color: "#cbd5e1", fontSize: 16 }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={tryConfigPin}
                style={{ backgroundColor: "#1e40af", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>Continuar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de Config */}
      <Modal
        transparent
        visible={cfgVisible}
        animationType="fade"
        onRequestClose={() => setCfgVisible(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 }}
          onPress={() => setCfgVisible(false)}
        >
          <Pressable onPress={() => {}} style={{ width: 420, maxWidth: "95%", backgroundColor: "#0f172a", borderRadius: 16, padding: 20 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
              Configuración del Bridge
            </Text>

            {[
              { key: 'backendUrl', label: 'Backend URL', kb: 'url' },
              { key: 'sioPath', label: 'Socket Path', kb: 'default' },
              { key: 'locationId', label: 'Location ID', kb: 'default' },
              { key: 'printerIp', label: 'Printer IP', kb: 'numeric' },
              { key: 'printerPort', label: 'Printer Port', kb: 'numeric' },
              { key: 'token', label: 'Token (opcional)', kb: 'default' },
            ].map((f) => (
              <View key={f.key} style={{ marginBottom: 10 }}>
                <Text style={{ color: "#cbd5e1", marginBottom: 6 }}>{f.label}</Text>
                <TextInput
                  value={String((form as any)[f.key] ?? '')}
                  onChangeText={(t) => setForm((prev) => ({ ...prev, [f.key]: f.key === 'printerPort' ? Number(t.replace(/[^0-9]/g,'')) || 9100 : t }))}
                  placeholder={f.label}
                  placeholderTextColor="#94a3b8"
                  keyboardType={f.kb === 'numeric' ? 'number-pad' : 'default'}
                  style={{ backgroundColor: "#fff", borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12, fontSize: 16 }}
                />
              </View>
            ))}

            <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
              <Pressable onPress={() => setCfgVisible(false)} style={{ paddingVertical: 10, paddingHorizontal: 16 }}>
                <Text style={{ color: "#cbd5e1", fontSize: 16 }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={saveAndApplyConfig}
                style={{ backgroundColor: "#22c55e", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 }}
              >
                <Text style={{ color: "#0f172a", fontSize: 16, fontWeight: "800" }}>Guardar y aplicar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaProvider>
  );
}
