export type WindowMode = 'pet' | 'chat' | 'focus' | 'settings'
export type PetAction = 'chat' | 'focus' | 'settings' | 'hide' | 'quit'
export type PetScale = number
export type ChatMode = 'local' | 'api'
export type PetGender = 'female' | 'male'

export interface AppSettings {
  soundEnabled: boolean
  reducedMotion: boolean
  launchAtLogin: boolean
  scale: PetScale
  petGender: PetGender
  chatMode: ChatMode
  apiBaseUrl: string
  model: string
  hasApiKey: boolean
}

export interface SettingsPatch {
  soundEnabled?: boolean
  reducedMotion?: boolean
  launchAtLogin?: boolean
  scale?: PetScale
  petGender?: PetGender
  chatMode?: ChatMode
  apiBaseUrl?: string
  model?: string
  apiKey?: string
  clearApiKey?: boolean
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatResult {
  content: string
}

export interface PetBridge {
  getSettings: () => Promise<AppSettings>
  updateSettings: (patch: SettingsPatch) => Promise<AppSettings>
  setWindowMode: (mode: WindowMode) => Promise<void>
  moveWindowBy: (deltaX: number, deltaY: number) => void
  setClickThrough: (ignoreMouse: boolean) => void
  showContextMenu: () => void
  hideWindow: () => void
  quitApp: () => void
  sendChat: (messages: ChatMessage[]) => Promise<ChatResult>
  onAction: (callback: (action: PetAction) => void) => () => void
}
