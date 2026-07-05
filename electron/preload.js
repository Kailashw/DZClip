const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("clipvault", {
  getHistory: () => ipcRenderer.invoke("get-history"),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  setSettings: (partial) => ipcRenderer.invoke("set-settings", partial),
  togglePin: (id) => ipcRenderer.invoke("toggle-pin", id),
  setLabel: (id, label) => ipcRenderer.invoke("set-label", { id, label }),
  updatePinned: (id, patch) => ipcRenderer.invoke("update-pinned", { id, patch }),
  removeItem: (id) => ipcRenderer.invoke("remove-item", id),
  clearAll: () => ipcRenderer.invoke("clear-all"),
  copyItem: (item) => ipcRenderer.invoke("copy-item", item),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  openPreferences: () => ipcRenderer.invoke("open-preferences"),
  getPlatform: () => ipcRenderer.invoke("get-platform"),
  getStorageInfo: () => ipcRenderer.invoke("get-storage-info"),
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  quitApp: () => ipcRenderer.invoke("quit-app"),
  onHistoryUpdated: (callback) => {
    const listener = (_event, items) => callback(items);
    ipcRenderer.on("history-updated", listener);
    return () => ipcRenderer.removeListener("history-updated", listener);
  },
  onSettingsUpdated: (callback) => {
    const listener = (_event, settings) => callback(settings);
    ipcRenderer.on("settings-updated", listener);
    return () => ipcRenderer.removeListener("settings-updated", listener);
  },
});
