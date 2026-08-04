import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  ChatMessage,
  ChatResult,
  PetAction,
  PetBridge,
  SettingsPatch,
  WindowMode
} from '../shared/types'

const bridge: PetBridge = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch: SettingsPatch): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', patch),
  setWindowMode: (mode: WindowMode): Promise<void> =>
    ipcRenderer.invoke('window:set-mode', mode),
  moveWindowBy: (deltaX: number, deltaY: number): void => {
    ipcRenderer.send('window:move-by', { deltaX, deltaY })
  },
  setClickThrough: (ignoreMouse: boolean): void => {
    ipcRenderer.send('window:set-ignore-mouse', ignoreMouse)
  },
  showContextMenu: (): void => ipcRenderer.send('pet:show-menu'),
  hideWindow: (): void => ipcRenderer.send('pet:hide'),
  quitApp: (): void => ipcRenderer.send('pet:quit'),
  sendChat: (messages: ChatMessage[]): Promise<ChatResult> =>
    ipcRenderer.invoke('chat:send', messages),
  onAction: (callback: (action: PetAction) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: PetAction): void => callback(action)
    ipcRenderer.on('pet:action', listener)
    return () => ipcRenderer.removeListener('pet:action', listener)
  }
}

contextBridge.exposeInMainWorld('petAPI', bridge)
