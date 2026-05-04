import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('openpi', {
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    node: process.versions.node,
  },
});