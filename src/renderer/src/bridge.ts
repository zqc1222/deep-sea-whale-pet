import type {
  AppSettings,
  BondData,
  ChatResult,
  PetBridge,
  SettingsPatch,
  WeatherData
} from '../../shared/types'

const DEMO_SETTINGS_KEY = 'deepsea-whale-pet:demo-settings'
const DEMO_BOND_KEY = 'deepsea-whale-pet:demo-bond'

const defaults: AppSettings = {
  soundEnabled: true,
  reducedMotion: false,
  launchAtLogin: false,
  scale: 1,
  petGender: 'female',
  chatMode: 'local',
  apiBaseUrl: '',
  model: '',
  hasApiKey: false,
  scheduleEnabled: true,
  sleepStart: '21:00',
  sleepEnd: '08:00',
  awakeGraceMinutes: 15,
  mealTimesEnabled: true,
  weatherEnabled: false,
  weatherLocation: ''
}

function loadDemoSettings(): AppSettings {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_SETTINGS_KEY) ?? '{}') as Partial<AppSettings>
    const scale = typeof parsed.scale === 'number' && Number.isFinite(parsed.scale) && parsed.scale >= 0.5 && parsed.scale <= 2
      ? Math.round(parsed.scale * 100) / 100
      : defaults.scale
    const chatMode = parsed.chatMode === 'api' ? 'api' : 'local'
    const requestedGender = new URLSearchParams(window.location.search).get('gender')
    const petGender = requestedGender === 'male' || requestedGender === 'female'
      ? requestedGender
      : parsed.petGender === 'male' ? 'male' : 'female'
    return { ...defaults, ...parsed, scale, petGender, chatMode, hasApiKey: false }
  } catch {
    return { ...defaults }
  }
}

function demoTodayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function demoWeather(): WeatherData {
  const requested = new URLSearchParams(window.location.search).get('weather')
  const condition: WeatherData['condition'] = requested === 'clear' || requested === 'clouds'
    || requested === 'rain' || requested === 'snow' || requested === 'thunder'
    ? requested
    : 'unknown'
  if (condition === 'unknown') return { connected: false, condition, tempC: null, updatedAt: null }
  return { connected: true, condition, tempC: 15, updatedAt: Date.now() }
}

function loadDemoBond(): BondData {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEMO_BOND_KEY) ?? '') as BondData
    if (parsed && typeof parsed.days === 'number' && typeof parsed.totalFocusSeconds === 'number') {
      return parsed
    }
  } catch {
    // 损坏的演示数据回退默认
  }
  const today = demoTodayISO()
  return { firstSeen: today, lastSeen: today, days: 1, totalFocusSeconds: 0, milestonesSeen: [] }
}

function saveDemoBond(bond: BondData): void {
  localStorage.setItem(DEMO_BOND_KEY, JSON.stringify(bond))
}

function getDemoBond(): BondData {
  const bond = loadDemoBond()
  const today = demoTodayISO()
  if (bond.lastSeen !== today) {
    const updated = { ...bond, lastSeen: today, days: bond.days + 1 }
    saveDemoBond(updated)
    return updated
  }
  return bond
}

let demoSettings = loadDemoSettings()

const demoBridge: PetBridge = {
  getSettings: async () => demoSettings,
  updateSettings: async (patch: SettingsPatch) => {
    const { apiKey: _apiKey, clearApiKey: _clearApiKey, ...safePatch } = patch
    demoSettings = { ...demoSettings, ...safePatch, hasApiKey: false }
    localStorage.setItem(DEMO_SETTINGS_KEY, JSON.stringify(demoSettings))
    return demoSettings
  },
  setWindowMode: async () => undefined,
  moveWindowBy: () => undefined,
  setClickThrough: () => undefined,
  showContextMenu: () => undefined,
  hideWindow: () => undefined,
  quitApp: () => undefined,
  sendChat: async (): Promise<ChatResult> => ({
    content: '浏览器演示模式不会连接外部模型；启动 Electron 版本后可在设置里安全配置。'
  }),
  getWeather: async (): Promise<WeatherData> => demoWeather(),
  getBond: async (): Promise<BondData> => getDemoBond(),
  recordFocus: async (minutes: number): Promise<BondData> => {
    const bond = getDemoBond()
    const updated = { ...bond, totalFocusSeconds: bond.totalFocusSeconds + Math.round(minutes) * 60 }
    saveDemoBond(updated)
    return updated
  },
  markMilestones: async (ids: number[]): Promise<BondData> => {
    const bond = getDemoBond()
    const updated = { ...bond, milestonesSeen: [...new Set([...bond.milestonesSeen, ...ids])] }
    saveDemoBond(updated)
    return updated
  },
  onAction: () => () => undefined
}

export const isElectron = Boolean(window.petAPI)
export const petBridge = window.petAPI ?? demoBridge
