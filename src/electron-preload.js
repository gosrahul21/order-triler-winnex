const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  invoke: (channel, ...args) => {
    const validChannels = [
      'get-assets',
      'get-balance',
      'get-config',
      'save-config',
      'place-order',
      'get-positions',
      'close-position',
      'set-tpsl',
      'get-price',
      'trigger-alert'
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
  },
  send: (channel, data) => {
    const validChannels = ['show-notification'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  platform: process.platform,
});
