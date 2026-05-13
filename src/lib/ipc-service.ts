export const isElectron = typeof window !== 'undefined' && !!(window as any).electron;

/**
 * Request notification permission and send a desktop notification.
 * Uses the Web Notifications API directly (works in Electron renderer without preload).
 * Falls back to IPC if window.electron is available.
 */
export async function sendDesktopNotification(title: string, body: string) {
  // 1) Try Web Notifications API directly (works in Electron renderer)
  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
      return;
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        new Notification(title, { body });
        return;
      }
    }
  }
  // 2) Fallback: try via Electron IPC preload bridge
  const el = (window as any).electron;
  if (el?.send) {
    el.send('show-notification', { title, body });
  }
}

async function callIpc(channel: string, ...args: any[]) {
  if (isElectron) {
    return await (window as any).electron?.invoke(channel, ...args);
  } else {
    // Fallback to API routes if needed, or throw error
    console.warn(`Attempted IPC call ${channel} outside of Electron`);
    return { success: false, error: 'IPC not available' };
  }
}

export const ipcService = {
  getAssets: () => callIpc('get-assets'),
  getBalance: () => callIpc('get-balance'),
  getConfig: () => callIpc('get-config'),
  saveConfig: (config: any) => callIpc('save-config', config),
  placeOrder: (params: any) => callIpc('place-order', params),
  getPositions: () => callIpc('get-positions'),
  closePosition: (params: any) => callIpc('close-position', params),
  setTpSl: (params: any) => callIpc('set-tpsl', params),
  getPrice: (symbol: string) => callIpc('get-price', symbol),
  triggerAlert: (params: any) => callIpc('trigger-alert', params),
  showNotification: sendDesktopNotification,
};
