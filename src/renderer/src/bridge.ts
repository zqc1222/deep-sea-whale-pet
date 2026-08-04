import type {
  AppSettings,
  ChatResult,
  PetBridge,
  SettingsPatch
} from '../../shared/types'

const DEMO_SETTINGS_KEY = 'deepsea-whale-pet:demo-settings'

const defaults: AppSettings = {
  soundEnabled: true,
  reducedMotion: false,
  launchAtLogin: false,
  scale: 1,
  petGender: 'female',
  chatMode: 'local',
  apiBaseUrl: '',
  model: '',
  hasApiKey: false
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
  onAction: () => () => undefined
}

export const isElectron = Boolean(window.petAPI)
export const petBridge = window.petAPI ?? demoBridge
