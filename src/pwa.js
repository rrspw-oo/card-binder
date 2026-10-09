import { Workbox } from "workbox-window";

const UPDATE_INTERVAL = 30 * 60 * 1000;

export function registerPWA() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  const wb = new Workbox(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
  wb.addEventListener("waiting", () => wb.messageSkipWaiting());
  let hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  const check = () => wb.update().catch(() => {});
  wb.register()
    .then(() => {
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
      window.addEventListener("pageshow", (e) => e.persisted && check());
      setInterval(check, UPDATE_INTERVAL);
    })
    .catch(() => {});
}
