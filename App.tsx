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

const toastConfig = {
  success: (props: any) => <CustomToast {...props} />,
  error: (props: any) => <CustomToast {...props} />,
};

const ENTRY_PIN = "2580"; // <-- PIN para ENTRAR a la app (cámbialo)
const ADMIN_PIN = "4321"; // <-- PIN para SALIR de la app (cámbialo)

export default function App() {
  useKeepAwake();

  // --- Estado kiosco/locks:
  const [isUnlocked, setIsUnlocked] = useState(false); // gate global (entrada)
  const [entryPin, setEntryPin] = useState("");
  const [entryVisible, setEntryVisible] = useState(true);
   const bridgeRef = useRef<BridgeClient | null>(null);
  const tapsRef = useRef(0); // salida admin (5 toques)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [unlockVisible, setUnlockVisible] = useState(false);
  const [exitPin, setExitPin] = useState("");

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
  // si quieres ver en UI:
  // Toast.show({ type: s.includes('error') ? 'error' : 'success', text1: s });
};
useEffect(() => {
  if (!isUnlocked) return;

  // ⚙️ CONFIGURA TUS DATOS AQUÍ
  const backendUrl = "https://ticketapi-ceqz.onrender.com"; 
  const sioPath = "/socket.io";
  const locationId = "sucursal-central-01";
   const printerIp = "192.168.1.200"
  const token = "supersecreto123";  

  const bridge = new BridgeClient({
    backendUrl,
    sioPath,
    locationId,
    printerIp,
    token,
    onStatus: handleBridgeStatus,
  });
  bridgeRef.current = bridge;
  bridge.init();

  return () => {
    // (no hay stop explícito; el socket cierra al desmontar la app)
    bridgeRef.current = null;
  };
}, [isUnlocked]);
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
    const backSub = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true
    );
    const interval = setInterval(hideNavBar, 3000); // re-ocultar frecuentemente

    return () => {
      appSub.remove();
      backSub.remove();
      clearInterval(interval);
    };
  }, []);

  // ---- Entrada con PIN
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

  // ---- 5 toques rápidos en esquina sup. izq. para pedir PIN de salida
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
      const brokeLock = await stopKioskIfPossible(); // rompe Lock Task real si está activo
      await NavigationBar.setVisibilityAsync("visible").catch(() => {});
      Toast.show({
        type: "success",
        text1: brokeLock ? "Lock Task detenido" : "Saliendo",
      });
      BackHandler.exitApp(); // opcional
    } else {
      Toast.show({ type: "error", text1: "PIN incorrecto" });
      setExitPin("");
    }
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
          {/* área invisible para re-ocultar barra */}
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
          {/* Aquí agregué onLayout={hideNavBar} */}
          <View
            style={{ flex: 1, backgroundColor: "#fff" }}
            onLayout={hideNavBar}
          >
            <AppNavigator />
            <Toast config={toastConfig} />
          </View>

          {/* área invisible para pedir PIN de salida (5 toques) */}
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
        </>
      )}

      {/* Modal de PIN de salida */}
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
            <Text
              style={{
                color: "#fff",
                fontSize: 18,
                fontWeight: "700",
                marginBottom: 12,
              }}
            >
              Salir (PIN requerido)
            </Text>
            <TextInput
              value={exitPin}
              onChangeText={(t) =>
                setExitPin(t.replace(/[^0-9]/g, "").slice(0, 6))
              }
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
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                gap: 12,
              }}
            >
              <Pressable
                onPress={() => setUnlockVisible(false)}
                style={{ paddingVertical: 10, paddingHorizontal: 16 }}
              >
                <Text style={{ color: "#cbd5e1", fontSize: 16 }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={tryExitUnlock}
                style={{
                  backgroundColor: "#1e40af",
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 8,
                }}
              >
                <Text
                  style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}
                >
                  Desbloquear
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaProvider>
  );
}
