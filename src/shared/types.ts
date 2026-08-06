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
  /** 天气感知开关 */
  weatherEnabled: boolean
  /** 天气城市名或 纬度,经度，留空则不定位 */
  weatherLocation: string
  /** 主动关怀开关 */
  careEnabled: boolean
  /** 关怀间隔分钟（实际等待 ±15% 随机） */
  careIntervalMinutes: number
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
  weatherEnabled?: boolean
  weatherLocation?: string
  careEnabled?: boolean
  careIntervalMinutes?: number
}

/** 主动关怀：主进程对用户活动的探测结果 */
export interface ActivityProbe {
  /** 系统空闲秒数，读取失败为 null */
  idleSeconds: number | null
  /** 前台窗口标题，读取失败为空串 */
  activeWindowTitle: string
}

/** 天气数据（主进程拉取并缓存） */
export interface WeatherData {
  connected: boolean
  condition: 'clear' | 'clouds' | 'rain' | 'snow' | 'thunder' | 'unknown'
  tempC: number | null
  updatedAt: number | null
}

/** 应用完整性校验信息：用于让用户核对安装包是否为官方版本 */
export interface AppHashInfo {
  /** 是否为打包安装版（开发版不适用校验） */
  packaged: boolean
  /** 打包版：resources/app.asar 的 SHA-256 前 12 位大写；开发版为空串 */
  hash: string
}

/** 羁绊养成数据（主进程持久化） */
export interface BondData {
  /** 首次启动日期 YYYY-MM-DD */
  firstSeen: string
  /** 最近一次启动日期 YYYY-MM-DD */
  lastSeen: string
  /** 累计出现过桌宠的天数 */
  days: number
  /** 累计专注秒数 */
  totalFocusSeconds: number
  /** 已弹过台词/已解锁的里程碑 id */
  milestonesSeen: number[]
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
  getWeather: () => Promise<WeatherData>
  getBond: () => Promise<BondData>
  recordFocus: (minutes: number) => Promise<BondData>
  markMilestones: (ids: number[]) => Promise<BondData>
  probeActivity: () => Promise<ActivityProbe>
  onAction: (callback: (action: PetAction) => void) => () => void
  onWeatherUpdated: (callback: (weather: WeatherData) => void) => () => void
  verifyAppHash: () => Promise<AppHashInfo>
}
