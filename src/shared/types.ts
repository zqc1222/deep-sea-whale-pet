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
  /** 作息时段行为总开关 */
  scheduleEnabled: boolean
  /** 入睡时间，HH:MM（24 小时制） */
  sleepStart: string
  /** 起床时间，HH:MM（24 小时制） */
  sleepEnd: string
  /** 被点击唤醒后的豁免时长（分钟），期内不再入睡 */
  awakeGraceMinutes: number
  /** 饭点提醒开关 */
  mealTimesEnabled: boolean
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
  scheduleEnabled?: boolean
  sleepStart?: string
  sleepEnd?: string
  awakeGraceMinutes?: number
  mealTimesEnabled?: boolean
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
