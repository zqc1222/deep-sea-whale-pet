import { contextBridge, ipcRenderer } from 'electron'
import type {
  ActivityProbe,
  AppSettings,
  BondData,
  ChatMessage,
  ChatResult,
  PetAction,
  PetBridge,
  SettingsPatch,
  WeatherData,
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
  getWeather: (): Promise<WeatherData> => ipcRenderer.invoke('weather:get'),
  getBond: (): Promise<BondData> => ipcRenderer.invoke('bond:get'),
  recordFocus: (minutes: number): Promise<BondData> =>
    ipcRenderer.invoke('bond:record-focus', minutes),
  markMilestones: (ids: number[]): Promise<BondData> =>
    ipcRenderer.invoke('bond:mark-milestones', ids),
  probeActivity: (): Promise<ActivityProbe> => ipcRenderer.invoke('activity:probe'),
  onAction: (callback: (action: PetAction) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, action: PetAction): void => callback(action)
    ipcRenderer.on('pet:action', listener)
    return () => ipcRenderer.removeListener('pet:action', listener)
  },
  onWeatherUpdated: (callback: (weather: WeatherData) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, weather: WeatherData): void => callback(weather)
    ipcRenderer.on('weather:updated', listener)
    return () => ipcRenderer.removeListener('weather:updated', listener)
  }
}

contextBridge.exposeInMainWorld('petAPI', bridge)
