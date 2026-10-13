// 데이터 저장과 UI는 앱에 맡기고, 새 코드 확인 및 안전한 화면 교체만 담당한다.
function createAppUpdater({ version, canReload, beforeReload }) {
  if (!("serviceWorker" in navigator)) {
    return { check: async () => false, applyPendingUpdate: () => {} };
  }

  const reloadKey = "tiny-week:update-reload";
  let registration = null;
  let checkInFlight = null;
  let lastCheck = 0;
  let pendingVersion = null;
  let composing = false;
  let reloading = false;
  let applyTimer = null;

  function readWorkerVersion(worker) {
    return new Promise((resolve) => {
      const channel = new MessageChannel();
      const finish = (value) => {
        clearTimeout(timeout);
        channel.port1.close();
        channel.port2.close();
        resolve(value);
      };
      const timeout = setTimeout(() => finish(null), 2000);
      channel.port1.onmessage = (event) => {
        finish(typeof event.data?.version === "string" ? event.data.version : null);
      };
      try {
        worker.postMessage({ type: "GET_APP_VERSION" }, [channel.port2]);
      } catch (_error) {
        finish(null);
      }
    });
  }

  async function inspectController() {
    const worker = navigator.serviceWorker.controller;
    if (!worker || reloading) return;
    const activeVersion = await readWorkerVersion(worker);
    if (!activeVersion || worker !== navigator.serviceWorker.controller) return;

    if (activeVersion === version) {
      pendingVersion = null;
      try { sessionStorage.removeItem(reloadKey); } catch (_error) {}
      return;
    }
    pendingVersion = activeVersion;
    applyPendingUpdate();
  }

  function applyPendingUpdate() {
    clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      if (!pendingVersion || reloading || composing || document.visibilityState !== "visible" || !canReload()) return;
      const transition = `${version}->${pendingVersion}`;
      try {
        // 잘못된 배포로 이전 코드가 다시 제공돼도 무한 새로고침하지 않는다.
        if (sessionStorage.getItem(reloadKey) === transition) return;
        beforeReload();
        sessionStorage.setItem(reloadKey, transition);
      } catch (_error) {
        // 현재 화면을 유지하고 다음 확인 시 재시도한다.
        return;
      }
      reloading = true;
      location.reload();
    }, 250);
  }

  function check(force = false) {
    applyPendingUpdate();
    if (checkInFlight) return checkInFlight;
    if (!navigator.onLine || document.visibilityState !== "visible") return Promise.resolve(false);
    if (!force && Date.now() - lastCheck < 15000) return Promise.resolve(false);
    lastCheck = Date.now();

    checkInFlight = (async () => {
      try {
        if (!registration) {
          registration = await navigator.serviceWorker.register("service-worker.js", { updateViaCache: "none" });
        }
        await registration.update();
        await inspectController();
        return true;
      } catch (_error) {
        // 오프라인·일시적인 설치 실패는 현재 버전을 유지한 채 재시도한다.
        return false;
      } finally {
        checkInFlight = null;
      }
    })();
    return checkInFlight;
  }

  navigator.serviceWorker.addEventListener("controllerchange", inspectController);
  window.addEventListener("pageshow", () => check(true));
  window.addEventListener("online", () => check(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check(true);
  });
  document.addEventListener("focusout", applyPendingUpdate);
  document.addEventListener("compositionstart", () => { composing = true; });
  document.addEventListener("compositionend", () => {
    composing = false;
    applyPendingUpdate();
  });
  // 계속 열어둔 화면도 새 배포를 찾는다. 백그라운드에서는 요청하지 않는다.
  setInterval(check, 60000);
  check(true);

  return { check, applyPendingUpdate };
}
