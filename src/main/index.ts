import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  safeStorage,
  screen,
  Tray,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type Rectangle
} from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type {
  AppSettings,
  BondData,
  ChatMode,
  ChatMessage,
  ChatResult,
  PetAction,
  PetGender,
  PetScale,
  SettingsPatch,
  WeatherData,
  WindowMode
} from '../shared/types'

interface StoredSettings extends Omit<AppSettings, 'hasApiKey'> {
  apiKeyEncrypted?: string
  windowPosition?: { x: number; y: number }
  weather?: WeatherData
  bond?: BondData
}

const DEFAULT_SETTINGS: StoredSettings = {
  soundEnabled: true,
  reducedMotion: false,
  launchAtLogin: false,
  scale: 1,
  petGender: 'female',
  chatMode: 'local',
  apiBaseUrl: '',
  model: '',
  scheduleEnabled: true,
  sleepStart: '21:00',
  sleepEnd: '08:00',
  awakeGraceMinutes: 15,
  mealTimesEnabled: true,
  weatherEnabled: false,
  weatherLocation: ''
}

const WEATHER_REFRESH_INTERVAL_MS = 60 * 60 * 1000

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function freshBond(): BondData {
  const today = todayISO()
  return { firstSeen: today, lastSeen: today, days: 1, totalFocusSeconds: 0, milestonesSeen: [] }
}

function idleWeather(): WeatherData {
  return { connected: false, condition: 'unknown', tempC: null, updatedAt: null }
}

/** Open-Meteo WMO 天气代码 → 桌宠天气类别 */
function mapWeatherCode(code: number): WeatherData['condition'] {
  if (code === 0) return 'clear'
  if (code >= 1 && code <= 3) return 'clouds'
  if (code >= 45 && code <= 48) return 'clouds'
  if (code >= 51 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'rain'
  if (code >= 85 && code <= 86) return 'snow'
  if (code >= 95 && code <= 99) return 'thunder'
  return 'unknown'
}

const WINDOW_SIZES: Record<WindowMode, { width: number; height: number }> = {
  pet: { width: 360, height: 500 },
  chat: { width: 760, height: 570 },
  focus: { width: 700, height: 550 },
  settings: { width: 760, height: 590 }
}

const MIN_PET_SCALE = 0.5
const MAX_PET_SCALE = 2
const VALID_CHAT_MODES: ChatMode[] = ['local', 'api']
const VALID_PET_GENDERS: PetGender[] = ['female', 'male']
const VALID_MODES: WindowMode[] = ['pet', 'chat', 'focus', 'settings']

let petWindow: BrowserWindow | null = null
let tray: Tray | null = null
let settingsStore: SettingsStore
let isQuitting = false
let currentMode: WindowMode = 'pet'
let persistPositionTimer: ReturnType<typeof setTimeout> | undefined
let moveFlushTimer: ReturnType<typeof setTimeout> | undefined
let pendingWindowMove = { x: 0, y: 0 }

class SettingsStore {
  private readonly filePath = join(app.getPath('userData'), 'settings.json')
  private data: StoredSettings = { ...DEFAULT_SETTINGS }

  constructor() {
    this.load()
  }

  private load(): void {
    if (!existsSync(this.filePath)) return

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<StoredSettings>
      this.data = { ...DEFAULT_SETTINGS, ...parsed }
      let shouldSaveMigration = false
      const normalizedScale = isValidPetScale(this.data.scale) ? normalizePetScale(this.data.scale) : 1
      if (normalizedScale !== this.data.scale) shouldSaveMigration = true
      this.data.scale = normalizedScale
      if (!VALID_CHAT_MODES.includes(parsed.chatMode as ChatMode)) {
        this.data.chatMode = parsed.apiBaseUrl && parsed.model && parsed.apiKeyEncrypted ? 'api' : 'local'
        shouldSaveMigration = true
      }
      if (!VALID_PET_GENDERS.includes(parsed.petGender as PetGender)) {
        this.data.petGender = 'female'
        shouldSaveMigration = true
      }
      if (!isFinitePosition(this.data.windowPosition)) delete this.data.windowPosition
      if (!isValidClockTime(this.data.sleepStart)) {
        this.data.sleepStart = DEFAULT_SETTINGS.sleepStart
        shouldSaveMigration = true
      }
      if (!isValidClockTime(this.data.sleepEnd)) {
        this.data.sleepEnd = DEFAULT_SETTINGS.sleepEnd
        shouldSaveMigration = true
      }
      if (!Number.isFinite(this.data.awakeGraceMinutes) || this.data.awakeGraceMinutes < 5 || this.data.awakeGraceMinutes > 120) {
        this.data.awakeGraceMinutes = DEFAULT_SETTINGS.awakeGraceMinutes
        shouldSaveMigration = true
      }
      if (shouldSaveMigration) this.save()
    } catch {
      this.data = { ...DEFAULT_SETTINGS }
    }
  }

  private save(): void {
    mkdirSync(dirname(this.filePath), { recursive: true })
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8')
  }

  getPublic(): AppSettings {
    return {
      soundEnabled: this.data.soundEnabled,
      reducedMotion: this.data.reducedMotion,
      launchAtLogin: this.data.launchAtLogin,
      scale: this.data.scale,
      petGender: this.data.petGender,
      chatMode: this.data.chatMode,
      apiBaseUrl: this.data.apiBaseUrl,
      model: this.data.model,
      hasApiKey: Boolean(this.data.apiKeyEncrypted),
      scheduleEnabled: this.data.scheduleEnabled,
      sleepStart: this.data.sleepStart,
      sleepEnd: this.data.sleepEnd,
      awakeGraceMinutes: this.data.awakeGraceMinutes,
      mealTimesEnabled: this.data.mealTimesEnabled,
      weatherEnabled: this.data.weatherEnabled,
      weatherLocation: this.data.weatherLocation
    }
  }

  getWeather(): WeatherData {
    return this.data.weather ?? idleWeather()
  }

  setWeather(data: WeatherData): void {
    this.data.weather = data
    this.save()
  }

  /** 返回羁绊数据，跨天时自动累计陪伴天数 */
  getBond(): BondData {
    if (!this.data.bond) {
      this.data.bond = freshBond()
      this.save()
      return this.data.bond
    }
    const today = todayISO()
    if (this.data.bond.lastSeen !== today) {
      this.data.bond = {
        ...this.data.bond,
        lastSeen: today,
        days: this.data.bond.days + 1
      }
      this.save()
    }
    return this.data.bond
  }

  recordFocus(minutes: number): BondData {
    const bond = this.getBond()
    this.data.bond = {
      ...bond,
      totalFocusSeconds: bond.totalFocusSeconds + Math.round(minutes) * 60
    }
    this.save()
    return this.data.bond
  }

  markMilestones(ids: number[]): BondData {
    const bond = this.getBond()
    const merged = [...new Set([...bond.milestonesSeen, ...ids])]
    this.data.bond = { ...bond, milestonesSeen: merged }
    this.save()
    return this.data.bond
  }

  getWindowPosition(): { x: number; y: number } | undefined {
    return this.data.windowPosition
  }

  setWindowPosition(position: { x: number; y: number }): void {
    if (!isFinitePosition(position)) return
    this.data.windowPosition = { x: Math.round(position.x), y: Math.round(position.y) }
    this.save()
  }

  update(patch: SettingsPatch): AppSettings {
    if (typeof patch.soundEnabled === 'boolean') this.data.soundEnabled = patch.soundEnabled
    if (typeof patch.reducedMotion === 'boolean') this.data.reducedMotion = patch.reducedMotion
    if (typeof patch.launchAtLogin === 'boolean') this.data.launchAtLogin = patch.launchAtLogin
    if (patch.scale !== undefined) {
      if (!isValidPetScale(patch.scale)) throw new Error('桌宠大小必须在 50% 到 200% 之间。')
      this.data.scale = normalizePetScale(patch.scale)
    }

    if (patch.petGender !== undefined) {
      if (!VALID_PET_GENDERS.includes(patch.petGender)) throw new Error('未知桌宠形象。')
      this.data.petGender = patch.petGender
    }

    if (patch.chatMode !== undefined) {
      if (!VALID_CHAT_MODES.includes(patch.chatMode)) throw new Error('未知聊天模式。')
      this.data.chatMode = patch.chatMode
    }

    if (typeof patch.apiBaseUrl === 'string') {
      this.data.apiBaseUrl = validateBaseUrl(patch.apiBaseUrl)
    }

    if (typeof patch.model === 'string') {
      this.data.model = patch.model.trim().slice(0, 120)
    }

    if (typeof patch.scheduleEnabled === 'boolean') this.data.scheduleEnabled = patch.scheduleEnabled
    if (typeof patch.mealTimesEnabled === 'boolean') this.data.mealTimesEnabled = patch.mealTimesEnabled

    if (typeof patch.sleepStart === 'string') {
      if (!isValidClockTime(patch.sleepStart)) throw new Error('入睡时间格式应为 HH:MM。')
      this.data.sleepStart = patch.sleepStart
    }

    if (typeof patch.sleepEnd === 'string') {
      if (!isValidClockTime(patch.sleepEnd)) throw new Error('起床时间格式应为 HH:MM。')
      this.data.sleepEnd = patch.sleepEnd
    }

    if (patch.awakeGraceMinutes !== undefined) {
      if (!Number.isFinite(patch.awakeGraceMinutes) || patch.awakeGraceMinutes < 5 || patch.awakeGraceMinutes > 120) {
        throw new Error('唤醒豁免时长应在 5 到 120 分钟之间。')
      }
      this.data.awakeGraceMinutes = Math.round(patch.awakeGraceMinutes)
    }

    if (typeof patch.weatherEnabled === 'boolean') this.data.weatherEnabled = patch.weatherEnabled
    if (typeof patch.weatherLocation === 'string') this.data.weatherLocation = patch.weatherLocation.trim().slice(0, 120)

    if (patch.clearApiKey) delete this.data.apiKeyEncrypted

    if (typeof patch.apiKey === 'string' && patch.apiKey.trim()) {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new Error('当前系统安全存储不可用，API Key 未保存。')
      }
      const plainKey = patch.apiKey.trim().slice(0, 500)
      this.data.apiKeyEncrypted = safeStorage.encryptString(plainKey).toString('base64')
    }

    this.save()
    return this.getPublic()
  }

  getApiKey(): string | undefined {
    if (!this.data.apiKeyEncrypted || !safeStorage.isEncryptionAvailable()) return undefined
    try {
      return safeStorage.decryptString(Buffer.from(this.data.apiKeyEncrypted, 'base64'))
    } catch {
      return undefined
    }
  }
}

async function resolveCoordinates(
  location: string,
  signal: AbortSignal
): Promise<{ lat: number; lon: number }> {
  const trimmed = location.trim()
  const coords = /^(-?\d{1,3}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(trimmed)
  if (coords) return { lat: Number(coords[1]), lon: Number(coords[2]) }
  const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(trimmed)}&count=1&language=zh`
  const response = await fetch(geoUrl, { signal })
  if (!response.ok) throw new Error('地理编码失败。')
  const result = await response.json() as { results?: Array<{ latitude: number; longitude: number }> }
  const first = result.results?.[0]
  if (!first) throw new Error('没有找到该城市。')
  return { lat: first.latitude, lon: first.longitude }
}

/** 拉取天气并写入设置；失败时写入未连接状态（静默降级） */
async function refreshWeather(): Promise<void> {
  const settings = settingsStore.getPublic()
  if (!settings.weatherEnabled || !settings.weatherLocation.trim()) return
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20_000)
  try {
    const { lat, lon } = await resolveCoordinates(settings.weatherLocation, controller.signal)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=auto`
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error('天气服务返回异常。')
    const result = await response.json() as {
      current_weather?: { temperature?: number; weathercode?: number }
    }
    const current = result.current_weather
    if (!current || current.weathercode === undefined) throw new Error('没有当前天气数据。')
    settingsStore.setWeather({
      connected: true,
      condition: mapWeatherCode(current.weathercode),
      tempC: typeof current.temperature === 'number' ? current.temperature : null,
      updatedAt: Date.now()
    })
  } catch {
    settingsStore.setWeather(idleWeather())
  } finally {
    clearTimeout(timeout)
  }
}

function isFinitePosition(value: unknown): value is { x: number; y: number } {
  if (!value || typeof value !== 'object') return false
  const position = value as { x?: unknown; y?: unknown }
  return typeof position.x === 'number' && Number.isFinite(position.x) &&
    typeof position.y === 'number' && Number.isFinite(position.y)
}

function isValidPetScale(value: unknown): value is PetScale {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_PET_SCALE && value <= MAX_PET_SCALE
}

function normalizePetScale(value: PetScale): PetScale {
  return Math.round(value * 100) / 100
}

function isValidClockTime(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return false
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

function validateBaseUrl(rawValue: string): string {
  const value = rawValue.trim().slice(0, 500)
  if (!value) return ''
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error('API 地址格式不正确。')
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) {
    throw new Error('API 地址只允许 http 或 https。')
  }
  return value.replace(/\/$/, '')
}

function scaledPetSize(scale: PetScale): { width: number; height: number } {
  return {
    width: Math.round(WINDOW_SIZES.pet.width * scale),
    height: Math.round(WINDOW_SIZES.pet.height * scale)
  }
}

function sizeForMode(mode: WindowMode): { width: number; height: number } {
  return mode === 'pet' ? scaledPetSize(settingsStore.getPublic().scale) : WINDOW_SIZES[mode]
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}

function clampBounds(bounds: Rectangle): Rectangle {
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y })
  const workArea = display.workArea
  const width = Math.min(bounds.width, workArea.width)
  const height = Math.min(bounds.height, workArea.height)
  return {
    width,
    height,
    x: clamp(bounds.x, workArea.x, workArea.x + workArea.width - width),
    y: clamp(bounds.y, workArea.y, workArea.y + workArea.height - height)
  }
}

function initialBounds(): Rectangle {
  const size = sizeForMode('pet')
  const workArea = screen.getPrimaryDisplay().workArea
  const saved = settingsStore.getWindowPosition()
  const fallback = {
    x: workArea.x + workArea.width - size.width - 32,
    y: workArea.y + workArea.height - size.height - 24
  }
  return clampBounds({ ...size, ...(saved ?? fallback) })
}

function createPetWindow(): void {
  petWindow = new BrowserWindow({
    ...initialBounds(),
    title: '深海鲸灵',
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      backgroundThrottling: false
    }
  })

  petWindow.setAlwaysOnTop(true, 'floating')
  petWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false })
  petWindow.setMenuBarVisibility(false)

  if (process.env.ELECTRON_RENDERER_URL) {
    void petWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void petWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  petWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  petWindow.webContents.on('will-navigate', (event) => event.preventDefault())

  petWindow.once('ready-to-show', () => petWindow?.show())
  petWindow.on('move', schedulePositionSave)
  petWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      petWindow?.hide()
    }
  })
  petWindow.on('closed', () => {
    petWindow = null
  })
}

function schedulePositionSave(): void {
  if (!petWindow || currentMode !== 'pet') return
  if (persistPositionTimer) clearTimeout(persistPositionTimer)
  persistPositionTimer = setTimeout(() => {
    if (!petWindow) return
    const { x, y } = petWindow.getBounds()
    settingsStore.setWindowPosition({ x, y })
  }, 220)
}

function setWindowMode(mode: WindowMode): void {
  if (!petWindow) return
  const previous = petWindow.getBounds()
  const nextSize = sizeForMode(mode)
  const next = clampBounds({
    width: nextSize.width,
    height: nextSize.height,
    x: previous.x + previous.width - nextSize.width,
    y: previous.y + previous.height - nextSize.height
  })
  currentMode = mode
  petWindow.setIgnoreMouseEvents(false)
  petWindow.setBounds(next, true)
}

function flushWindowMove(): void {
  moveFlushTimer = undefined
  const delta = pendingWindowMove
  pendingWindowMove = { x: 0, y: 0 }

  if (!petWindow || petWindow.isDestroyed() || currentMode !== 'pet') return
  const bounds = petWindow.getBounds()
  const next = clampBounds({
    ...bounds,
    x: bounds.x + Math.round(delta.x),
    y: bounds.y + Math.round(delta.y)
  })
  if (next.x === bounds.x && next.y === bounds.y) return
  petWindow.setPosition(next.x, next.y, false)
  petWindow.webContents.invalidate()
}

function moveWindowBy(deltaX: number, deltaY: number): void {
  if (!petWindow || currentMode !== 'pet') return
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return
  if (Math.abs(deltaX) > 120 || Math.abs(deltaY) > 120) return
  pendingWindowMove.x += deltaX
  pendingWindowMove.y += deltaY
  if (!moveFlushTimer) moveFlushTimer = setTimeout(flushWindowMove, 16)
}

function sendPetAction(action: PetAction): void {
  if (!petWindow || petWindow.isDestroyed()) return
  petWindow.show()
  petWindow.webContents.send('pet:action', action)
}

function quitApplication(): void {
  isQuitting = true
  app.quit()
}

function showPetMenu(): void {
  const menu = Menu.buildFromTemplate([
    { label: '和鲸灵聊聊', click: () => sendPetAction('chat') },
    { label: '专注 25 分钟', click: () => sendPetAction('focus') },
    { label: '设置', click: () => sendPetAction('settings') },
    { type: 'separator' },
    { label: '暂时藏进深海', click: () => petWindow?.hide() },
    { label: '退出深海鲸灵', click: quitApplication }
  ])
  menu.popup({ window: petWindow ?? undefined })
}

function createTray(): void {
  const traySvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="14" fill="#0b1f3a"/>
      <path d="M7 18c3.6 5.8 13.4 6.4 17.7.2-3.2 1.4-5.2.5-6.5-2.7-2.7 2.3-6.8 3.2-11.2 2.5Z" fill="#39d9ff"/>
      <path d="M15.5 11c-1.3-3.4-4.2-4.8-6.8-4 1 3.2 3.4 5 6.8 4Zm1 0c1.3-3.4 4.2-4.8 6.8-4-1 3.2-3.4 5-6.8 4Z" fill="#eafbff"/>
      <circle cx="21.5" cy="16" r="1.2" fill="#eafbff"/>
    </svg>`
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(traySvg).toString('base64')}`
  const icon = nativeImage.createFromDataURL(dataUrl).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('深海鲸灵 · 非官方同人原型')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示 / 隐藏', click: () => petWindow?.isVisible() ? petWindow.hide() : petWindow?.show() },
    { label: '和鲸灵聊聊', click: () => sendPetAction('chat') },
    { label: '专注计时', click: () => sendPetAction('focus') },
    { label: '设置', click: () => sendPetAction('settings') },
    { type: 'separator' },
    { label: '退出', click: quitApplication }
  ]))
  tray.on('click', () => petWindow?.isVisible() ? petWindow.hide() : petWindow?.show())
}

function ensureTrustedInvoke(event: IpcMainInvokeEvent): void {
  if (!petWindow || event.sender !== petWindow.webContents) throw new Error('不受信任的窗口请求。')
}

function ensureTrustedEvent(event: IpcMainEvent): boolean {
  return Boolean(petWindow && event.sender === petWindow.webContents)
}

function registerIpc(): void {
  ipcMain.handle('settings:get', (event) => {
    ensureTrustedInvoke(event)
    return settingsStore.getPublic()
  })

  ipcMain.handle('settings:update', (event, rawPatch: unknown) => {
    ensureTrustedInvoke(event)
    if (!rawPatch || typeof rawPatch !== 'object') throw new Error('设置内容无效。')
    const patch = rawPatch as SettingsPatch
    const previous = settingsStore.getPublic()
    const updated = settingsStore.update(patch)

    if (previous.launchAtLogin !== updated.launchAtLogin) {
      app.setLoginItemSettings({ openAtLogin: updated.launchAtLogin })
    }
    if (previous.scale !== updated.scale && currentMode === 'pet') setWindowMode('pet')
    if (previous.weatherEnabled !== updated.weatherEnabled
      || previous.weatherLocation !== updated.weatherLocation) {
      void refreshWeather()
    }
    return updated
  })

  ipcMain.handle('weather:get', (event) => {
    ensureTrustedInvoke(event)
    return settingsStore.getWeather()
  })

  ipcMain.handle('bond:get', (event) => {
    ensureTrustedInvoke(event)
    return settingsStore.getBond()
  })

  ipcMain.handle('bond:record-focus', (event, rawMinutes: unknown) => {
    ensureTrustedInvoke(event)
    if (typeof rawMinutes !== 'number' || !Number.isFinite(rawMinutes) || rawMinutes <= 0 || rawMinutes > 600) {
      throw new Error('专注时长无效。')
    }
    return settingsStore.recordFocus(rawMinutes)
  })

  ipcMain.handle('bond:mark-milestones', (event, rawIds: unknown) => {
    ensureTrustedInvoke(event)
    if (!Array.isArray(rawIds)) throw new Error('里程碑数据无效。')
    const ids = rawIds
      .filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
      .slice(0, 50)
    return settingsStore.markMilestones(ids)
  })

  ipcMain.handle('window:set-mode', (event, rawMode: unknown) => {
    ensureTrustedInvoke(event)
    if (typeof rawMode !== 'string' || !VALID_MODES.includes(rawMode as WindowMode)) {
      throw new Error('未知窗口模式。')
    }
    setWindowMode(rawMode as WindowMode)
  })

  ipcMain.on('window:move-by', (event, rawDelta: unknown) => {
    if (!ensureTrustedEvent(event) || !rawDelta || typeof rawDelta !== 'object') return
    const delta = rawDelta as { deltaX?: unknown; deltaY?: unknown }
    if (typeof delta.deltaX === 'number' && typeof delta.deltaY === 'number') {
      moveWindowBy(delta.deltaX, delta.deltaY)
    }
  })

  ipcMain.on('window:set-ignore-mouse', (event, rawIgnore: unknown) => {
    if (!ensureTrustedEvent(event) || !petWindow || typeof rawIgnore !== 'boolean') return
    if (currentMode !== 'pet' && rawIgnore) return
    petWindow.setIgnoreMouseEvents(rawIgnore, rawIgnore ? { forward: true } : undefined)
  })

  ipcMain.on('pet:show-menu', (event) => {
    if (ensureTrustedEvent(event)) showPetMenu()
  })
  ipcMain.on('pet:hide', (event) => {
    if (ensureTrustedEvent(event)) petWindow?.hide()
  })
  ipcMain.on('pet:quit', (event) => {
    if (ensureTrustedEvent(event)) quitApplication()
  })

  ipcMain.handle('chat:send', async (event, rawMessages: unknown): Promise<ChatResult> => {
    ensureTrustedInvoke(event)
    const messages = validateMessages(rawMessages)
    const settings = settingsStore.getPublic()
    const apiKey = settingsStore.getApiKey()
    if (settings.chatMode !== 'api') {
      throw new Error('当前是本地陪伴模式；如需调用模型，请先在设置中切换到 API 模式。')
    }
    if (!apiKey || !settings.apiBaseUrl || !settings.model) {
      throw new Error('请先在设置里填写 API 地址、模型名和 API Key。')
    }

    const endpoint = settings.apiBaseUrl.endsWith('/chat/completions')
      ? settings.apiBaseUrl
      : `${settings.apiBaseUrl}/chat/completions`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 35_000)

    try {
      const characterPrompt = settings.petGender === 'male'
        ? '当前形象是活泼温柔的鲸鱼少年。'
        : '当前形象是活泼温柔的鲸鱼少女。'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            {
              role: 'system',
              content: `你是原创桌宠“深海鲸灵”，${characterPrompt}语气温柔、聪明、简短，偶尔使用海洋意象。不要声称自己是 DeepSeek 官方角色或官方产品。`
            },
            ...messages
          ],
          temperature: 0.75
        }),
        signal: controller.signal
      })
      if (!response.ok) throw new Error(`模型服务返回 ${response.status}。`)
      const result = await response.json() as {
        choices?: Array<{ message?: { content?: unknown } }>
      }
      const content = result.choices?.[0]?.message?.content
      if (typeof content !== 'string' || !content.trim()) throw new Error('模型没有返回可显示的内容。')
      return { content: content.trim().slice(0, 8000) }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('模型响应超时，请稍后重试。')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  })
}

function validateMessages(rawMessages: unknown): ChatMessage[] {
  if (!Array.isArray(rawMessages)) throw new Error('对话内容无效。')
  return rawMessages.slice(-20).map((message) => {
    if (!message || typeof message !== 'object') throw new Error('对话内容无效。')
    const candidate = message as { role?: unknown; content?: unknown }
    if (!['user', 'assistant'].includes(String(candidate.role)) || typeof candidate.content !== 'string') {
      throw new Error('对话内容无效。')
    }
    return {
      role: candidate.role as ChatMessage['role'],
      content: candidate.content.trim().slice(0, 4000)
    }
  }).filter((message) => message.content)
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    petWindow?.show()
    petWindow?.focus()
  })

  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('com.deepsea.whalepet')
    Menu.setApplicationMenu(null)
    settingsStore = new SettingsStore()
    registerIpc()
    createPetWindow()
    createTray()
    void refreshWeather()
    setInterval(() => { void refreshWeather() }, WEATHER_REFRESH_INTERVAL_MS)

    screen.on('display-removed', () => {
      if (petWindow) petWindow.setBounds(clampBounds(petWindow.getBounds()))
    })
    screen.on('display-metrics-changed', () => {
      if (petWindow) petWindow.setBounds(clampBounds(petWindow.getBounds()))
    })
  })
}

app.on('activate', () => {
  if (!petWindow) createPetWindow()
  else petWindow.show()
})

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  // The tray owns the lifecycle on Windows; choosing "退出" ends the app.
})
