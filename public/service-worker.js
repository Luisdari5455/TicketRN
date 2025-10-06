// service-worker.js (mínimo viable para habilitar PWA Install)
self.addEventListener("install", (event) => {
  // Puedes precachear estáticos aquí si quieres
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough por defecto (opcionalmente implementa caché según tus rutas)
self.addEventListener("fetch", () => {});
