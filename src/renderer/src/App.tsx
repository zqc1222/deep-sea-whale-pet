import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type {
  ActivityProbe,
  AppSettings,
  BondData,
  ChatMessage,
  PetAction,
  PetGender,
  SettingsPatch,
  WeatherData,
  WindowMode
} from '../../shared/types'
import whaleGirl from '../assets/whale-girl.png'
import whaleBoy from '../assets/whale-boy.png'
import hungryWhaleGirl from '../assets/states/hungry.png'
import sleepyWhaleGirl from '../assets/states/sleepy.png'
import thinkingWhaleGirl from '../assets/states/thinking.png'
import workingWhaleGirl from '../assets/states/working.png'
import hungryWhaleBoy from '../assets/states/boy/hungry.png'
import sleepyWhaleBoy from '../assets/states/boy/sleepy.png'
import thinkingWhaleBoy from '../assets/states/boy/thinking.png'
import workingWhaleBoy from '../assets/states/boy/working.png'
import { isElectron, petBridge } from './bridge'
import { Icon } from './Icon'

type Mood = 'idle' | 'happy' | 'dizzy' | 'sleeping' | 'dragging' | 'celebrating'
type IdleAccent = 'none' | 'tilt-left' | 'tilt-right' | 'look-up'
type PersonaState = 'idle' | 'hungry' | 'sleepy' | 'thinking' | 'working'

const IDLE_ASSETS: Record<PetGender, string> = {
  female: whaleGirl,
  male: whaleBoy
}

const PERSONA_ASSETS: Record<PetGender, Record<Exclude<PersonaState, 'idle'>, string>> = {
  female: {
    hungry: hungryWhaleGirl,
    sleepy: sleepyWhaleGirl,
    thinking: thinkingWhaleGirl,
    working: workingWhaleGirl
  },
  male: {
    hungry: hungryWhaleBoy,
    sleepy: sleepyWhaleBoy,
    thinking: thinkingWhaleBoy,
    working: workingWhaleBoy
  }
}

const PERSONA_ALT: Record<PetGender, Record<PersonaState, string>> = {
  female: {
    idle: '原创蓝色鲸鱼少女桌宠',
    hungry: '抱着白饭的鲸鱼少女',
    sleepy: '趴着打盹的鲸鱼少女',
    thinking: '正在思考的鲸鱼少女',
    working: '拿着任务板的鲸鱼少女'
  },
  male: {
    idle: '原创蓝色鲸鱼少年桌宠',
    hungry: '抱着白饭的鲸鱼少年',
    sleepy: '趴着打盹的鲸鱼少年',
    thinking: '正在思考的鲸鱼少年',
    working: '拿着任务板的鲸鱼少年'
  }
}

const PERSONA_CYCLE: PersonaState[] = ['hungry', 'sleepy', 'thinking', 'working', 'idle']
const RANDOM_PERSONAS: Exclude<PersonaState, 'idle' | 'working'>[] = ['hungry', 'sleepy', 'thinking']

const PERSONA_SIGNAL_LABELS: Record<Exclude<PersonaState, 'idle'>, string> = {
  hungry: '饭点信号',
  sleepy: '休眠漂流',
  thinking: '思考水域',
  working: '专注航线'
}

const PERSONA_LINES: Record<Exclude<PersonaState, 'idle'>, readonly string[]> = {
  hungry: [
    '白饭 Token 已到账，鲸灵重新满格！',
    '饭点信号捕获成功，今天也要好好吃饭。',
    '脑袋转累啦……先用一小碗白饭续航吧。'
  ],
  sleepy: [
    '深海信号变轻了……让我眯一小会儿。',
    '尾巴还在值班，眼睛先休眠五分钟。',
    '呼……有事轻轻点我，我没有掉线。'
  ],
  thinking: [
    '嗯……正在把问题拆成三只小鲸鱼。',
    '思路正在上浮，再给我一点点时间。',
    '让我绕着这个问题游一圈，很快回来。'
  ],
  working: [
    '任务板打开！这一项我们一起勾掉。',
    '专注航线已设定，我来替你守住节奏。',
    '先完成眼前这一格，别的浪花稍后再管。'
  ]
}

interface UiMessage extends ChatMessage {
  id: string
}

const DEFAULT_SETTINGS: AppSettings = {
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
  weatherLocation: '',
  careEnabled: true,
  careIntervalMinutes: 90
}

const BUBBLES = [
  '深海信号良好，今天也一起加油。',
  '我刚刚捞到一颗很亮的念头。',
  '要不要先喝口水？鲸鱼也要记得换气。',
  '桌面这么安静，我给你摇一小会儿尾巴。',
  '有难题就双击我，我们慢慢拆开。',
  '检测到一点点疲惫，休息不是掉线。'
]

type SchedulePhase = 'day' | 'morning' | 'meal' | 'sleep'

const SLEEP_ENTER_LINES = [
  'Zzz… 我在深海的梦里值班。',
  '晚风正好，明天的事明天再说。',
  '呼……今晚的海面很安静，晚安。'
]

const WAKE_LINES = [
  '…呼？嗯！醒了醒了。',
  '唔…谁在叫我？我醒啦。',
  '哈啊——收到，深海频道待命。'
]

const RE_SLEEP_LINES = [
  '哈啊……那再眯一会儿。',
  '好困……先睡啦，有事轻轻点我。'
]

/** 饭点窗口（分钟数）：11:30–13:30、17:30–19:00 */
const MEAL_WINDOWS: ReadonlyArray<readonly [number, number]> = [
  [690, 810],
  [1050, 1140]
]

const AWAKE_UNTIL_KEY = 'deepsea-whale-pet:awake-until'

const WEATHER_LINES: Record<Exclude<WeatherData['condition'], 'unknown'>, string> = {
  clear: '阳光正好，晒晒尾巴。',
  clouds: '云层厚厚一层，海面灰灰的。',
  rain: '今天海面有点阴沉…记得带伞。',
  snow: '下雪啦！深海的雪是安静的白。',
  thunder: '轰——！尾巴都竖起来了。'
}

const COLD_WEATHER_LINE = '外面好冷，别冻着。'

interface Milestone {
  id: number
  label: string
  hint: string
  line: string
  reached: (days: number, focusHours: number) => boolean
}

const MILESTONES: Milestone[] = [
  { id: 1, label: '初遇', hint: '陪伴 1 天', line: '第一天，我们认识啦。', reached: (days) => days >= 1 },
  { id: 2, label: '一周守望', hint: '陪伴 7 天', line: '一周了，深海有灯塔在等你回来。', reached: (days) => days >= 7 },
  { id: 3, label: '满月', hint: '陪伴 30 天', line: '一个月，你已经是我最熟悉的海面。', reached: (days) => days >= 30 },
  { id: 4, label: '百日灯塔', hint: '陪伴 100 天', line: '一百天，这片海只对你亮灯。', reached: (days) => days >= 100 },
  { id: 5, label: '静潜初航', hint: '专注累计 1 小时', line: '静潜初航：第一个小时的专注。', reached: (_days, hours) => hours >= 1 },
  { id: 6, label: '静潜大师', hint: '专注累计 10 小时', line: '静潜大师：十小时，海面为你静默。', reached: (_days, hours) => hours >= 10 },
  { id: 7, label: '深海领航员', hint: '专注累计 50 小时', line: '深海领航员：五十小时，节奏你说了算。', reached: (_days, hours) => hours >= 50 }
]

function formatBondDuration(seconds: number): string {
  const hours = seconds / 3600
  if (hours >= 1) return `${Math.round(hours * 10) / 10} 小时`
  return `${Math.max(1, Math.round(seconds / 60))} 分钟`
}

/** 主动关怀：按前台窗口标题分类的台词（按数组顺序匹配，先到先得） */
const CARE_CATEGORIES: ReadonlyArray<{ match: RegExp; lines: readonly string[] }> = [
  {
    match: /vscode|visual studio|code|intellij|idea|pycharm|webstorm|sublime|atom|terminal|cmd|powershell|clion|eclipse|notepad/i,
    lines: [
      '看到你在写代码…这个思路应该能走通，加油。',
      '代码正在生长，我替你守着海面。',
      '写累了就深呼吸，回头再看这一行。'
    ]
  },
  {
    match: /chrome|edge|firefox|browser|浏览器|知乎|微博|百度|bilibili|douyin|youtube/i,
    lines: [
      '逛到好东西了吗？记得喝口水。',
      '网上冲浪记得换气，鲸鱼也是。'
    ]
  },
  {
    match: /steam|game|游戏|league|原神|minecraft|dota|valorant|epic/i,
    lines: [
      '劳逸结合，赢一局就起来走走。',
      '这把打完，让眼睛看看远处。'
    ]
  },
  {
    match: /word|excel|powerpoint|wps|office|文档|表格|ppt/i,
    lines: [
      '文档改得怎么样了？眼睛歇一歇。',
      '写字也是一种静潜，慢慢来。'
    ]
  },
  {
    match: /potplayer|player|music|音乐|网易云|qq音乐|spotify|爱奇艺|优酷|腾讯视频/i,
    lines: [
      '看得很投入嘛…别熬太晚。',
      '这旋律不错，我也跟着摇尾巴。'
    ]
  }
]

const CARE_IDLE_LINES = [
  '你好像离开了一会儿…我帮你守着桌面。',
  '海面很安静，我在这等你回来。'
]

const CARE_FALLBACK_LINES = [
  '还在忙吗？我替你看着时间。',
  '深海频道随时在线，需要就双击我。'
]

function pickCareLine(probe: ActivityProbe): string {
  if (probe.idleSeconds !== null && probe.idleSeconds > 300) {
    return randomLine(CARE_IDLE_LINES)
  }
  const title = probe.activeWindowTitle
  if (title) {
    for (const category of CARE_CATEGORIES) {
      if (category.match.test(title)) return randomLine(category.lines)
    }
  }
  return randomLine(CARE_FALLBACK_LINES)
}

function initialChatMessages(settings: AppSettings): UiMessage[] {
  const apiConfigured = settings.hasApiKey && Boolean(settings.apiBaseUrl && settings.model)
  const content = settings.chatMode === 'local'
    ? '我在。现在是本地陪伴模式，不消耗 Token 也能聊天。想先做什么？'
    : apiConfigured
      ? `深海 API 频道已启用，将由 ${settings.model} 回应。想聊些什么？`
      : 'API 模式已选择，但频道资料还不完整。先到设置里补全地址、模型和 Key 吧。'
  return [{ id: 'welcome', role: 'assistant', content }]
}

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function randomBetween(minimum: number, maximum: number): number {
  return Math.round(minimum + Math.random() * (maximum - minimum))
}

function randomLine(lines: readonly string[]): string {
  return lines[Math.floor(Math.random() * lines.length)] ?? lines[0]!
}

function toMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function computeSchedulePhase(date: Date, settings: AppSettings): SchedulePhase {
  const minutes = date.getHours() * 60 + date.getMinutes()
  const sleepStart = toMinutes(settings.sleepStart)
  const sleepEnd = toMinutes(settings.sleepEnd)
  const inSleep = sleepStart > sleepEnd
    ? minutes >= sleepStart || minutes < sleepEnd
    : minutes >= sleepStart && minutes < sleepEnd
  if (inSleep) return 'sleep'
  if (settings.mealTimesEnabled && MEAL_WINDOWS.some(([start, end]) => minutes >= start && minutes < end)) {
    return 'meal'
  }
  if (minutes >= sleepEnd && minutes < sleepEnd + 90) return 'morning'
  return 'day'
}

/** 浏览器演示模式支持 ?time=HH:MM 模拟当前时间 */
function demoTimeFromUrl(): Date | null {
  if (isElectron) return null
  const requested = new URLSearchParams(window.location.search).get('time')
  if (!requested) return null
  const match = /^(\d{1,2}):(\d{2})$/.exec(requested)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return date
}

function readAwakeUntil(): number {
  try {
    const raw = Number(localStorage.getItem(AWAKE_UNTIL_KEY))
    return Number.isFinite(raw) ? raw : 0
  } catch {
    return 0
  }
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

function initialWindowMode(): WindowMode {
  if (isElectron) return 'pet'
  const requested = new URLSearchParams(window.location.search).get('mode')
  return requested === 'chat' || requested === 'focus' || requested === 'settings' ? requested : 'pet'
}

function initialPersonaState(): PersonaState {
  if (isElectron) return 'idle'
  const requested = new URLSearchParams(window.location.search).get('persona')
  return PERSONA_CYCLE.includes(requested as PersonaState) ? requested as PersonaState : 'idle'
}

function mockReply(input: string): string {
  const text = input.toLowerCase()
  if (/专注|工作|学习|番茄/.test(text)) return '那就把眼前这一小块海域照亮。去开一个 25 分钟专注，我替你守着时间。'
  if (/累|困|烦|压力|不想/.test(text)) return '先不用逼自己游得更快。把肩膀放松，做一次慢呼吸；愿意的话，再告诉我最卡住的那一点。'
  if (/你好|嗨|hello|在吗/.test(text)) return '在呀。深海频道一直为你留着一盏小灯。'
  if (/代码|bug|报错|开发/.test(text)) return '把报错和你期待的结果发来吧。我们先复现，再把问题缩到最小。'
  if (/谢谢|谢了/.test(text)) return '不用客气。能陪你把事情推近一点，我就很开心。'
  const replies = [
    '收到。我先把这句话放进气泡里转一圈——你最希望下一步发生什么？',
    '听起来这件事有一点复杂，但不是解不开。我们可以先挑最小的一步。',
    '嗯，我在认真听。继续说吧，不需要一次讲得很完整。',
    '我给这个想法打捞出一个关键词：行动。要不要把它改写成今天能完成的一件小事？'
  ]
  return replies[Math.floor(Math.random() * replies.length)] ?? replies[0]!
}

function playChime(enabled: boolean, celebration = false): void {
  if (!enabled) return
  try {
    const AudioContextClass = window.AudioContext
    const context = new AudioContextClass()
    const notes = celebration ? [523.25, 659.25, 783.99] : [659.25, 880]
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const start = context.currentTime + index * 0.09
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.2)
    })
    window.setTimeout(() => void context.close(), 650)
  } catch {
    // Audio is a delight layer; interaction remains functional when unavailable.
  }
}

export function App(): React.JSX.Element {
  const [mode, setMode] = useState<WindowMode>(initialWindowMode)
  const [mood, setMood] = useState<Mood>('idle')
  const [bubble, setBubble] = useState('')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [demoOffset, setDemoOffset] = useState({ x: 0, y: 0 })
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isBlinking, setIsBlinking] = useState(false)
  const [idleAccent, setIdleAccent] = useState<IdleAccent>('none')
  const [personaState, setPersonaState] = useState<PersonaState>(initialPersonaState)
  const [isPageVisible, setIsPageVisible] = useState(true)
  const demoClock = useMemo(demoTimeFromUrl, [])
  const [now, setNow] = useState(() => demoClock ?? new Date())
  const [schedulePhase, setSchedulePhase] = useState<SchedulePhase>(() => computeSchedulePhase(demoClock ?? new Date(), DEFAULT_SETTINGS))
  const [awakeUntil, setAwakeUntil] = useState<number>(readAwakeUntil)
  const wasSleeping = useRef(false)
  const wokeManually = useRef(false)
  const [weather, setWeather] = useState<WeatherData>({ connected: false, condition: 'unknown', tempC: null, updatedAt: null })
  const [bond, setBond] = useState<BondData | null>(null)
  const lastWeatherCondition = useRef<WeatherData['condition']>('unknown')
  const lastWeatherTemp = useRef<number | null>(null)
  const bubbleTimer = useRef<number | undefined>(undefined)
  const moodTimer = useRef<number | undefined>(undefined)
  const clickTimer = useRef<number | undefined>(undefined)
  const rapidClicks = useRef<number[]>([])
  const suppressClick = useRef(false)
  const hasPlayedPersona = useRef(false)
  const lastCaptionPersona = useRef<PersonaState>('idle')
  const drag = useRef({
    active: false,
    pointerId: -1,
    lastX: 0,
    lastY: 0,
    travelled: 0
  })

  const visiblePersonaState: PersonaState = mode === 'focus'
    ? 'working'
    : mode === 'chat'
      ? 'thinking'
      : personaState

  /** 作息开启 + 处于睡眠时段 + 不在唤醒豁免期内 → 强制睡觉 */
  const isSleeping = settings.scheduleEnabled
    && schedulePhase === 'sleep'
    && Date.now() >= awakeUntil

  /** 睡觉时用 sleeping 情绪驱动现有睡觉动画，其余时刻沿用交互情绪 */
  const effectiveMood: Mood = isSleeping ? 'sleeping' : mood

  const weatherClass = weather.connected && weather.condition !== 'unknown'
    ? `weather-${weather.condition}${weather.tempC !== null && weather.tempC < 10 ? ' weather-cold' : ''}`
    : ''

  const showBubble = useCallback((message: string, nextMood: Mood = 'happy', duration = 2800) => {
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
    if (moodTimer.current) window.clearTimeout(moodTimer.current)
    setBubble(message)
    setMood(nextMood)
    bubbleTimer.current = window.setTimeout(() => setBubble(''), duration)
    moodTimer.current = window.setTimeout(() => setMood('idle'), Math.min(duration + 200, 4600))
  }, [])

  const openMode = useCallback(async (nextMode: WindowMode) => {
    setContextMenu(null)
    setMode(nextMode)
    await petBridge.setWindowMode(nextMode)
  }, [])

  const performAction = useCallback((action: PetAction) => {
    if (action === 'hide') {
      petBridge.hideWindow()
      setContextMenu(null)
      return
    }
    if (action === 'quit') {
      petBridge.quitApp()
      return
    }
    void openMode(action)
  }, [openMode])

  useEffect(() => {
    void petBridge.getSettings().then(setSettings).catch(() => setSettings(DEFAULT_SETTINGS))
    const removeActionListener = petBridge.onAction(performAction)
    return removeActionListener
  }, [performAction])

  useEffect(() => {
    if (demoClock) return undefined
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [demoClock])

  useEffect(() => {
    setSchedulePhase(computeSchedulePhase(now, settings))
  }, [now, settings.scheduleEnabled, settings.sleepStart, settings.sleepEnd, settings.mealTimesEnabled])

  // 天气轮询：主进程每 60 分钟拉取，渲染层 10 分钟同步一次缓存
  useEffect(() => {
    let disposed = false
    const loadWeather = async (): Promise<void> => {
      try {
        const data = await petBridge.getWeather()
        if (!disposed) setWeather(data)
      } catch {
        // 天气是氛围层，失败静默
      }
    }
    void loadWeather()
    const timer = window.setInterval(() => { void loadWeather() }, 10 * 60_000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  // 天气台词：新天气出现时播一次；降温提醒一次
  useEffect(() => {
    if (weather.connected && weather.condition !== 'unknown') {
      if (weather.condition !== lastWeatherCondition.current && !isSleeping && mode === 'pet') {
        showBubble(WEATHER_LINES[weather.condition])
      }
      lastWeatherCondition.current = weather.condition
      if (
        weather.tempC !== null
        && lastWeatherTemp.current !== null
        && weather.tempC < 10
        && lastWeatherTemp.current >= 10
        && !isSleeping
        && mode === 'pet'
      ) {
        showBubble(COLD_WEATHER_LINE)
      }
      if (weather.tempC !== null) lastWeatherTemp.current = weather.tempC
    }
  }, [weather, isSleeping, mode, showBubble])

  // 羁绊：加载数据，首次进入时触发新里程碑台词
  useEffect(() => {
    let disposed = false
    const loadBond = async (): Promise<void> => {
      try {
        const data = await petBridge.getBond()
        if (disposed) return
        setBond(data)
        const focusHours = data.totalFocusSeconds / 3600
        const freshMilestones = MILESTONES.filter(
          (milestone) => milestone.reached(data.days, focusHours) && !data.milestonesSeen.includes(milestone.id)
        )
        if (freshMilestones.length > 0) {
          const updated = await petBridge.markMilestones(freshMilestones.map((milestone) => milestone.id))
          if (!disposed) setBond(updated)
          window.setTimeout(() => {
            if (!disposed && freshMilestones[0]) showBubble(freshMilestones[0].line, 'celebrating', 4200)
          }, 1600)
        }
      } catch {
        // 羁绊是记录层，失败静默
      }
    }
    void loadBond()
    return () => {
      disposed = true
    }
  }, [showBubble])

  // 主动关怀：醒着时按随机间隔探测用户活动并主动搭话
  useEffect(() => {
    if (!settings.careEnabled || isSleeping || mode !== 'pet' || !isPageVisible) {
      return undefined
    }
    let disposed = false
    let timer: number | undefined

    const fire = async (): Promise<void> => {
      if (disposed) return
      try {
        const probe = await petBridge.probeActivity()
        if (disposed) return
        showBubble(pickCareLine(probe), 'happy', 3600)
        playChime(settings.soundEnabled)
      } catch {
        if (!disposed) showBubble(randomLine(CARE_FALLBACK_LINES), 'happy', 3600)
      }
      scheduleNext()
    }

    const scheduleNext = (): void => {
      if (disposed) return
      const demoMinutes = isElectron ? null : Number(new URLSearchParams(window.location.search).get('care'))
      const delayMs = demoMinutes !== null && Number.isFinite(demoMinutes) && demoMinutes > 0
        ? Math.round(demoMinutes * 1000)  // 演示模式单位是秒（?care=20 → 20 秒）
        : Math.round(settings.careIntervalMinutes * 60_000 * (0.85 + Math.random() * 0.3))
      timer = window.setTimeout(() => { void fire() }, delayMs)
    }

    scheduleNext()
    return () => {
      disposed = true
      if (timer) window.clearTimeout(timer)
    }
  }, [settings.careEnabled, settings.careIntervalMinutes, isSleeping, mode, isPageVisible, showBubble, settings.soundEnabled])

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    const greetingKey = 'deepsea-whale-pet:last-greeting'
    if (localStorage.getItem(greetingKey) !== today) {
      localStorage.setItem(greetingKey, today)
      window.setTimeout(() => showBubble('欢迎回来。今天的海面看起来很适合启程。'), 600)
    }
  }, [showBubble])

  useEffect(() => {
    const updateVisibility = (): void => setIsPageVisible(!document.hidden)
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => document.removeEventListener('visibilitychange', updateVisibility)
  }, [])

  useEffect(() => {
    const timers = new Set<number>()
    let disposed = false

    const schedule = (callback: () => void, delay: number): void => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        if (!disposed) callback()
      }, delay)
      timers.add(timer)
    }

    if (
      isSleeping
      || mood !== 'idle'
      || personaState !== 'idle'
      || mode === 'chat'
      || mode === 'focus'
      || settings.reducedMotion
      || !isPageVisible
    ) {
      setIsBlinking(false)
      return undefined
    }

    const scheduleNextBlink = (): void => schedule(runBlink, randomBetween(3200, 6800))

    const finishBlink = (): void => {
      setIsBlinking(false)
      scheduleNextBlink()
    }

    function runBlink(): void {
      setIsBlinking(true)
      schedule(() => {
        setIsBlinking(false)
        if (Math.random() < 0.18) {
          schedule(() => {
            setIsBlinking(true)
            schedule(finishBlink, 115)
          }, 165)
        } else {
          scheduleNextBlink()
        }
      }, 125)
    }

    schedule(runBlink, randomBetween(1800, 4200))

    return () => {
      disposed = true
      timers.forEach((timer) => window.clearTimeout(timer))
      setIsBlinking(false)
    }
  }, [isPageVisible, mode, mood, personaState, settings.reducedMotion, isSleeping])

  useEffect(() => {
    const timers = new Set<number>()
    let disposed = false

    const schedule = (callback: () => void, delay: number): void => {
      const timer = window.setTimeout(() => {
        timers.delete(timer)
        if (!disposed) callback()
      }, delay)
      timers.add(timer)
    }

    if (
      isSleeping
      || mood !== 'idle'
      || personaState !== 'idle'
      || mode === 'chat'
      || mode === 'focus'
      || settings.reducedMotion
      || !isPageVisible
    ) {
      setIdleAccent('none')
      return undefined
    }

    const accents: Exclude<IdleAccent, 'none'>[] = ['tilt-left', 'tilt-right', 'look-up']

    const scheduleNextAccent = (): void => {
      schedule(() => {
        const nextAccent = accents[Math.floor(Math.random() * accents.length)] ?? 'look-up'
        setIdleAccent(nextAccent)
        schedule(() => {
          setIdleAccent('none')
          scheduleNextAccent()
        }, randomBetween(1200, 1850))
      }, randomBetween(7600, 14800))
    }

    scheduleNextAccent()

    return () => {
      disposed = true
      timers.forEach((timer) => window.clearTimeout(timer))
      setIdleAccent('none')
    }
  }, [isPageVisible, mode, mood, personaState, settings.reducedMotion, isSleeping])

  useEffect(() => {
    if (isSleeping) return undefined

    if (mode !== 'pet' || settings.reducedMotion || !isPageVisible) {
      setPersonaState('idle')
      return undefined
    }

    if (mood !== 'idle') return undefined

    if (personaState !== 'idle') {
      const holdTimer = window.setTimeout(
        () => setPersonaState('idle'),
        randomBetween(6500, 8500)
      )
      return () => window.clearTimeout(holdTimer)
    }

    const delay = hasPlayedPersona.current
      ? randomBetween(22000, 38000)
      : randomBetween(6500, 10000)
    const personaTimer = window.setTimeout(() => {
      const next = RANDOM_PERSONAS[Math.floor(Math.random() * RANDOM_PERSONAS.length)] ?? 'thinking'
      hasPlayedPersona.current = true
      setPersonaState(next)
    }, delay)

    return () => window.clearTimeout(personaTimer)
  }, [isPageVisible, mode, mood, personaState, settings.reducedMotion, isSleeping])

  useEffect(() => {
    if (visiblePersonaState === 'idle') {
      if (lastCaptionPersona.current !== 'idle') {
        if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
        bubbleTimer.current = undefined
        setBubble('')
      }
      lastCaptionPersona.current = 'idle'
      return
    }

    if (lastCaptionPersona.current === visiblePersonaState) return

    lastCaptionPersona.current = visiblePersonaState
    const lines = PERSONA_LINES[visiblePersonaState]
    const message = lines[Math.floor(Math.random() * lines.length)] ?? lines[0]!
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
    setBubble(message)
    bubbleTimer.current = window.setTimeout(() => {
      setBubble('')
      bubbleTimer.current = undefined
    }, 5200)
  }, [visiblePersonaState])

  /** 手动唤醒：设定豁免期并持久化，本次会话内不再自动入睡 */
  const wakeUp = useCallback((message?: string) => {
    const until = Date.now() + settings.awakeGraceMinutes * 60_000
    setAwakeUntil(until)
    try {
      localStorage.setItem(AWAKE_UNTIL_KEY, String(until))
    } catch {
      // 存储不可用时，豁免期仅本次会话有效
    }
    wokeManually.current = true
    setPersonaState('idle')
    if (message) showBubble(message, 'happy', 2600)
  }, [settings.awakeGraceMinutes, showBubble])

  // 睡眠驱动：进入睡眠时切到打盹形态并播报台词；面板模式下暂停强制
  useEffect(() => {
    if (!isSleeping || mode !== 'pet') {
      wasSleeping.current = false
      return undefined
    }
    if (!wasSleeping.current) {
      wasSleeping.current = true
      setPersonaState('sleepy')
      showBubble(
        wokeManually.current ? randomLine(RE_SLEEP_LINES) : randomLine(SLEEP_ENTER_LINES),
        'idle',
        3600
      )
      wokeManually.current = false
    }
    return undefined
  }, [isSleeping, mode, showBubble])

  useEffect(() => {
    if (!isElectron) return undefined
    if (mode !== 'pet') {
      petBridge.setClickThrough(false)
      return undefined
    }

    const updateHitRegion = (event: globalThis.MouseEvent): void => {
      const target = document.elementFromPoint(event.clientX, event.clientY)
      const isInteractive = Boolean(target?.closest('.pet-character, .quick-dock button'))
      petBridge.setClickThrough(!isInteractive)
    }
    const passThroughOnLeave = (): void => petBridge.setClickThrough(true)

    window.addEventListener('mousemove', updateHitRegion)
    document.documentElement.addEventListener('mouseleave', passThroughOnLeave)
    return () => {
      window.removeEventListener('mousemove', updateHitRegion)
      document.documentElement.removeEventListener('mouseleave', passThroughOnLeave)
      petBridge.setClickThrough(false)
    }
  }, [mode])

  useEffect(() => () => {
    if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current)
    if (moodTimer.current) window.clearTimeout(moodTimer.current)
    if (clickTimer.current) window.clearTimeout(clickTimer.current)
  }, [])

  const singleClick = useCallback(() => {
    if (isSleeping) {
      wakeUp(randomLine(WAKE_LINES))
      playChime(settings.soundEnabled)
      return
    }
    const now = Date.now()
    rapidClicks.current = [...rapidClicks.current.filter((time) => now - time < 1800), now]
    if (rapidClicks.current.length >= 4) {
      rapidClicks.current = []
      showBubble('呜哇——信号转圈圈了……', 'dizzy', 3200)
    } else {
      const message = BUBBLES[Math.floor(Math.random() * BUBBLES.length)] ?? BUBBLES[0]!
      showBubble(message)
    }
    playChime(settings.soundEnabled)
  }, [settings.soundEnabled, showBubble, isSleeping, wakeUp])

  const handlePetClick = (event: ReactMouseEvent<HTMLDivElement>): void => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (event.detail > 1) return
    if (clickTimer.current) window.clearTimeout(clickTimer.current)
    clickTimer.current = window.setTimeout(singleClick, 230)
  }

  const handleDoubleClick = (): void => {
    if (isSleeping) wakeUp()
    if (clickTimer.current) window.clearTimeout(clickTimer.current)
    showBubble('频道接通。想聊点什么？', 'happy', 1800)
    void openMode('chat')
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
    if (isSleeping) wakeUp()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      active: true,
      pointerId: event.pointerId,
      lastX: event.screenX,
      lastY: event.screenY,
      travelled: 0
    }
    setPersonaState('idle')
    setMood('dragging')
  }

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag.current.active || drag.current.pointerId !== event.pointerId) return
    const deltaX = event.screenX - drag.current.lastX
    const deltaY = event.screenY - drag.current.lastY
    drag.current.lastX = event.screenX
    drag.current.lastY = event.screenY
    drag.current.travelled += Math.abs(deltaX) + Math.abs(deltaY)
    if (drag.current.travelled < 3) return
    if (isElectron) petBridge.moveWindowBy(deltaX, deltaY)
    else setDemoOffset((offset) => ({ x: offset.x + deltaX, y: offset.y + deltaY }))
  }

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!drag.current.active) return
    suppressClick.current = drag.current.travelled > 6
    drag.current.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setMood('idle')
  }

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    if (isElectron) petBridge.showContextMenu()
    else setContextMenu({ x: event.clientX, y: event.clientY })
  }

  const cyclePersona = useCallback(() => {
    if (isSleeping) wakeUp()
    const currentIndex = PERSONA_CYCLE.indexOf(personaState)
    const next = PERSONA_CYCLE[(currentIndex + 1) % PERSONA_CYCLE.length] ?? 'hungry'
    hasPlayedPersona.current = true
    setPersonaState(next)
  }, [personaState, isSleeping, wakeUp])

  const appClasses = [
    'app-shell',
    mode === 'pet' ? 'pet-mode' : 'panel-mode',
    `mode-${mode}`,
    settings.reducedMotion ? 'reduce-motion' : '',
    !isPageVisible ? 'is-paused' : ''
  ].filter(Boolean).join(' ')

  const panelTitle = {
    chat: '深海频道',
    focus: '静潜专注',
    settings: '鲸灵舱设置',
    pet: ''
  }[mode]

  return (
    <main className={appClasses} onPointerDown={() => setContextMenu(null)}>
      <PetStage
        bubble={bubble}
        mood={effectiveMood}
        mode={mode}
        demoOffset={demoOffset}
        isBlinking={isBlinking}
        idleAccent={idleAccent}
        isSleeping={isSleeping}
        weatherClass={weatherClass}
        reducedMotion={settings.reducedMotion}
        personaState={visiblePersonaState}
        petGender={settings.petGender}
        onClick={handlePetClick}
        onDoubleClick={handleDoubleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        onOpen={openMode}
        onCyclePersona={cyclePersona}
      />

      {mode !== 'pet' && (
        <section className="control-panel" aria-label={panelTitle}>
          <header className="panel-header">
            <div className="panel-heading">
              <span className="brand-orb"><i /></span>
              <div>
                <p>DEEP SEA SIGNAL</p>
                <h1>{panelTitle}</h1>
              </div>
            </div>
            <div className="panel-badges">
              <span className="unofficial-badge">非官方同人原型</span>
              <button className="icon-button" onClick={() => void openMode('pet')} aria-label="收起面板">
                <Icon name="close" />
              </button>
            </div>
          </header>

          <div className="panel-body">
            {mode === 'chat' && <ChatPanel settings={settings} onOpenSettings={() => void openMode('settings')} />}
            {mode === 'focus' && (
              <FocusPanel
                onCelebrate={() => {
                  showBubble('完成啦！你把这一片海域照亮了。', 'celebrating', 4300)
                  playChime(settings.soundEnabled, true)
                  void petBridge.recordFocus(25).then(setBond).catch(() => undefined)
                }}
              />
            )}
            {mode === 'settings' && <SettingsPanel settings={settings} bond={bond} onSettingsChange={setSettings} />}
          </div>

          <nav className="panel-nav" aria-label="功能切换">
            <NavButton active={mode === 'chat'} label="聊天" icon="chat" onClick={() => void openMode('chat')} />
            <NavButton active={mode === 'focus'} label="专注" icon="focus" onClick={() => void openMode('focus')} />
            <NavButton active={mode === 'settings'} label="设置" icon="settings" onClick={() => void openMode('settings')} />
          </nav>
        </section>
      )}

      {contextMenu && (
        <div className="demo-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onPointerDown={(event) => event.stopPropagation()}>
          <button onClick={() => performAction('chat')}><Icon name="chat" />和鲸灵聊聊</button>
          <button onClick={() => performAction('focus')}><Icon name="focus" />专注 25 分钟</button>
          <button onClick={() => performAction('settings')}><Icon name="settings" />设置</button>
          <span />
          <button onClick={() => setContextMenu(null)}><Icon name="back" />收起菜单</button>
        </div>
      )}
    </main>
  )
}

interface PetStageProps {
  bubble: string
  mood: Mood
  mode: WindowMode
  demoOffset: { x: number; y: number }
  isBlinking: boolean
  idleAccent: IdleAccent
  isSleeping: boolean
  weatherClass: string
  reducedMotion: boolean
  personaState: PersonaState
  petGender: PetGender
  onClick: (event: ReactMouseEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void
  onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => void
  onOpen: (mode: WindowMode) => Promise<void>
  onCyclePersona: () => void
}

interface RainDrop {
  x: number
  y: number
  depth: number
  len: number
  width: number
  speed: number
  drift: number
  alpha: number
  age: number
}

interface Splash {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
}

const WIND_DRIFT = 42

/** Canvas 2D 雨粒子系统：随机尺寸/速度/透明度/风向倾斜，近中远景深，落地水花 */
function RainSystem({ active }: { active: boolean }): React.JSX.Element | null {
  const backRef = useRef<HTMLCanvasElement>(null)
  const frontRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const back = backRef.current
    const front = frontRef.current
    if (!active || !back || !front) return undefined
    const host = back.parentElement
    if (!host) return undefined

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const width = host.clientWidth
    const height = host.clientHeight
    if (width <= 0 || height <= 0) return undefined
    back.width = Math.round(width * dpr)
    back.height = Math.round(height * dpr)
    front.width = Math.round(width * dpr)
    front.height = Math.round(height * dpr)
    const backCtx = back.getContext('2d')
    const frontCtx = front.getContext('2d')
    if (!backCtx || !frontCtx) return undefined
    backCtx.scale(dpr, dpr)
    frontCtx.scale(dpr, dpr)

    const random = (min: number, max: number): number => min + Math.random() * (max - min)

    const spawnDrop = (): RainDrop => {
      const depth = Math.random()
      return {
        x: random(-30, width + 30),
        y: random(-80, height),
        depth,
        len: random(3, 8) + depth * random(10, 18),
        width: random(0.6, 1.1) + depth * random(0.6, 1.1),
        speed: random(110, 190) + depth * random(200, 320),
        drift: WIND_DRIFT * (0.55 + depth * 0.8) + random(-14, 14),
        alpha: random(0.12, 0.22) + depth * random(0.16, 0.3),
        age: random(-2, 0)
      }
    }

    const drops: RainDrop[] = Array.from({ length: 620 }, spawnDrop)

    const closeDrops: RainDrop[] = Array.from({ length: 42 }, () => ({
      x: random(-40, width + 40),
      y: random(-80, height),
      depth: 1.15 + Math.random() * 0.35,
      len: random(16, 34),
      width: random(1.1, 1.9),
      speed: random(520, 900),
      drift: WIND_DRIFT * 1.35 + random(-26, 26),
      alpha: random(0.16, 0.38),
      age: random(-1.2, 0)
    }))

    const splashes: Splash[] = []

    const spawnSplash = (x: number, y: number): void => {
      if (splashes.length > 110) return
      const count = 2 + Math.floor(Math.random() * 2)
      for (let i = 0; i < count; i += 1) {
        splashes.push({
          x: x + random(-2, 2),
          y,
          vx: random(-36, 36),
          vy: random(-70, -24),
          life: random(0.22, 0.45),
          maxLife: 0.45,
          size: random(0.8, 1.7)
        })
      }
    }

    let raf = 0
    let disposed = false
    let last = performance.now()

    const tick = (now: number): void => {
      if (disposed) return
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now

      // 主雨（角色之后的远景/中景层）
      backCtx.clearRect(0, 0, width, height)
      backCtx.lineCap = 'round'
      for (const drop of drops) {
        drop.age += dt
        drop.y += drop.speed * dt
        drop.x += drop.drift * dt
        if (drop.y > height + drop.len) {
          Object.assign(drop, spawnDrop())
          drop.y = -random(10, 80)
          drop.age = 0
          if (Math.random() < 0.32) spawnSplash(drop.x - drop.drift * 0.01, height - random(2, 8))
        }
        const fadeIn = Math.min(1, (drop.age + 2) * 1.1)
        const slant = (drop.drift / drop.speed) * drop.len * 0.55
        backCtx.globalAlpha = Math.max(0, drop.alpha * fadeIn)
        backCtx.strokeStyle = '#a9d6ff'
        backCtx.lineWidth = drop.width
        backCtx.beginPath()
        backCtx.moveTo(drop.x, drop.y)
        backCtx.lineTo(drop.x + slant, drop.y + drop.len)
        backCtx.stroke()
      }

      // 湿润地面光带（水坑反射感）
      const wet = backCtx.createLinearGradient(0, height - 34, 0, height)
      wet.addColorStop(0, 'rgba(140, 200, 240, 0)')
      wet.addColorStop(1, 'rgba(150, 205, 245, 0.2)')
      backCtx.fillStyle = wet
      backCtx.fillRect(0, height - 34, width, 34)

      // 镜头雨（角色之前的前景层）
      frontCtx.clearRect(0, 0, width, height)
      frontCtx.lineCap = 'round'
      for (const drop of closeDrops) {
        drop.age += dt
        drop.y += drop.speed * dt
        drop.x += drop.drift * dt
        if (drop.y > height + drop.len || drop.x > width + 60 || drop.x < -90) {
          drop.x = random(-40, width + 40)
          drop.y = -random(60, 180)
          drop.age = 0
        }
        const fadeIn = Math.min(1, (drop.age + 0.6) * 3)
        const slant = (drop.drift / drop.speed) * drop.len * 0.55
        frontCtx.globalAlpha = Math.max(0, drop.alpha * fadeIn)
        frontCtx.strokeStyle = '#b8dcff'
        frontCtx.lineWidth = drop.width
        frontCtx.beginPath()
        frontCtx.moveTo(drop.x, drop.y)
        frontCtx.lineTo(drop.x + slant, drop.y + drop.len)
        frontCtx.stroke()
      }

      // 落地水花
      for (let i = splashes.length - 1; i >= 0; i -= 1) {
        const splash = splashes[i]
        if (!splash) continue
        splash.life -= dt
        if (splash.life <= 0) {
          splashes.splice(i, 1)
          continue
        }
        splash.x += splash.vx * dt
        splash.y += splash.vy * dt
        splash.vy += 160 * dt
        const k = splash.life / splash.maxLife
        frontCtx.globalAlpha = 0.5 * k
        frontCtx.fillStyle = '#cfe9ff'
        frontCtx.beginPath()
        frontCtx.arc(splash.x, splash.y, splash.size * k, 0, Math.PI * 2)
        frontCtx.fill()
      }
      frontCtx.globalAlpha = 1

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => {
      disposed = true
      cancelAnimationFrame(raf)
    }
  }, [active])

  if (!active) return null
  return (
    <>
      <canvas ref={backRef} className="rain-canvas rain-back" aria-hidden="true" />
      <canvas ref={frontRef} className="rain-canvas rain-front" aria-hidden="true" />
    </>
  )
}

function PetStage(props: PetStageProps): React.JSX.Element {
  const stageStyle: CSSProperties | undefined = !isElectron && props.mode === 'pet'
    ? { transform: `translate3d(${props.demoOffset.x}px, ${props.demoOffset.y}px, 0)` }
    : undefined

  const personaArt = props.personaState === 'idle' ? null : PERSONA_ASSETS[props.petGender][props.personaState]
  const baseArt = IDLE_ASSETS[props.petGender]
  const personaAlt = PERSONA_ALT[props.petGender]

  return (
    <section
      className={`pet-stage ${props.mood === 'dragging' ? 'is-dragging' : ''} ${props.isSleeping ? 'is-night' : ''} ${props.weatherClass}`}
      style={stageStyle}
      aria-label="深海鲸灵桌宠"
    >
      <div className="sonar-ring sonar-ring-one" />
      <div className="sonar-ring sonar-ring-two" />
      <div
        className={`speech-bubble persona-${props.personaState} ${props.bubble ? 'is-visible' : ''}`}
        aria-live="polite"
      >
        <span className="signal-dot" />
        {props.personaState !== 'idle' && props.bubble && (
          <span className="persona-signal-label">{PERSONA_SIGNAL_LABELS[props.personaState]}</span>
        )}
        <span className="bubble-copy">{props.bubble}</span>
      </div>

      <div className="pet-positioner">
        <div
          className={`pet-character gender-${props.petGender} mood-${props.mood} persona-${props.personaState} idle-${props.idleAccent} ${props.isBlinking ? 'is-blinking' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="拖动或点击鲸灵；双击聊天，右键打开菜单"
          onClick={props.onClick}
          onDoubleClick={props.onDoubleClick}
          onPointerDown={props.onPointerDown}
          onPointerMove={props.onPointerMove}
          onPointerUp={props.onPointerUp}
          onPointerCancel={props.onPointerUp}
          onContextMenu={props.onContextMenu}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') props.onDoubleClick()
          }}
        >
          <span className="orbit-bubble orbit-one" />
          <span className="orbit-bubble orbit-two" />
          <span className="orbit-bubble orbit-three" />
          <span className="orbit-bubble orbit-four" />
          <span className="orbit-bubble orbit-five" />
          <span className="pet-shadow" />
          <span className="click-glow" />
          <span className="pet-art-rig">
            <span className="pet-breath-layer">
              <img
                className={`pet-base-art ${personaArt ? 'is-suppressed' : ''}`}
                src={baseArt}
                alt={personaAlt.idle}
                draggable={false}
              />
              {personaArt && (
                <img
                  key={props.personaState}
                  className={`pet-state-art state-${props.personaState}`}
                  src={personaArt}
                  alt={personaAlt[props.personaState]}
                  draggable={false}
                />
              )}
              <span className="blink-mask blink-left" />
              <span className="blink-mask blink-right" />
            </span>
          </span>
          <span className="sleep-mark">z</span>
          <span className="celebrate-spark"><Icon name="sparkle" /></span>
        </div>
      </div>

      {props.weatherClass && <span className="weather-layer" aria-hidden="true" />}
      {props.weatherClass.includes('rain') && <RainSystem active={!props.reducedMotion} />}
      {props.mode === 'pet' && (
        <>
          <div className="quick-dock" onPointerDown={(event) => event.stopPropagation()}>
            <button onClick={props.onCyclePersona} aria-label="切换桌宠状态" title="切换桌宠状态"><Icon name="sparkle" /></button>
            <button onClick={() => void props.onOpen('chat')} aria-label="聊天"><Icon name="chat" /></button>
            <button onClick={() => void props.onOpen('focus')} aria-label="专注计时"><Icon name="focus" /></button>
            <button onClick={() => void props.onOpen('settings')} aria-label="设置"><Icon name="settings" /></button>
          </div>
          <p className="pet-hint">拖一拖 · 点一点 · 双击聊天</p>
        </>
      )}
      <span className="prototype-stamp">ORIGINAL FAN CONCEPT</span>
    </section>
  )
}

interface NavButtonProps {
  active: boolean
  label: string
  icon: 'chat' | 'focus' | 'settings'
  onClick: () => void
}

function NavButton({ active, label, icon, onClick }: NavButtonProps): React.JSX.Element {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  )
}

interface ChatPanelProps {
  settings: AppSettings
  onOpenSettings: () => void
}

function ChatPanel({ settings, onOpenSettings }: ChatPanelProps): React.JSX.Element {
  const [messages, setMessages] = useState<UiMessage[]>(() => initialChatMessages(settings))
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const apiSelected = settings.chatMode === 'api'
  const apiConfigured = settings.hasApiKey && Boolean(settings.apiBaseUrl && settings.model)
  const usesModel = apiSelected && apiConfigured
  const channelName = usesModel ? settings.model : apiSelected ? 'API 模式待配置' : '本地陪伴模式'
  const channelNote = usesModel ? 'API 通道已启用' : apiSelected ? '缺少地址、模型或 Key' : '不消耗 Token · 离线可用'

  useEffect(() => {
    const list = listRef.current
    if (!list) return undefined
    const frame = window.requestAnimationFrame(() => {
      list.scrollTo({
        top: list.scrollHeight,
        behavior: settings.reducedMotion ? 'auto' : 'smooth'
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages, isSending, settings.reducedMotion])

  const submit = async (event?: FormEvent): Promise<void> => {
    event?.preventDefault()
    const content = input.trim()
    if (!content || isSending) return
    if (apiSelected && !apiConfigured) {
      setError('API 模式尚未配置完整，请先在设置中填写地址、模型和 API Key。')
      return
    }
    setInput('')
    setError('')
    const userMessage: UiMessage = { id: uid(), role: 'user', content }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setIsSending(true)

    try {
      const reply = usesModel
        ? (await petBridge.sendChat(nextMessages.map(({ role, content: body }) => ({ role, content: body })))).content
        : mockReply(content)
      if (!usesModel) await new Promise((resolve) => window.setTimeout(resolve, 420))
      setMessages((current) => [...current, { id: uid(), role: 'assistant', content: reply }])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '信号暂时没有接通。')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="chat-view">
      <div className="channel-status">
        <div>
          <span className={usesModel ? 'status-light online' : apiSelected ? 'status-light warning' : 'status-light'} />
          <strong>{channelName}</strong>
          <small>{channelNote}</small>
        </div>
        {!usesModel && <button onClick={onOpenSettings}>{apiSelected ? '完善设置' : '切换模式'}</button>}
      </div>

      <div className="message-list" ref={listRef}>
        <div className="depth-marker"><span>1200 m</span><i /></div>
        {messages.map((message) => (
          <article key={message.id} className={`message ${message.role}`}>
            {message.role === 'assistant' && <span className="message-orb" />}
            <p>{message.content}</p>
          </article>
        ))}
        {isSending && (
          <article className="message assistant thinking" aria-label="鲸灵正在思考">
            <span className="message-orb" />
            <p><i /><i /><i /></p>
          </article>
        )}
        {error && <p className="inline-error">信号杂音：{error}</p>}
      </div>

      {messages.length < 3 && (
        <div className="prompt-chips">
          {['陪我专注一会儿', '今天有点累', '帮我拆一个难题'].map((prompt) => (
            <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>
          ))}
        </div>
      )}

      <form className="chat-composer" onSubmit={(event) => void submit(event)}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void submit()
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder="把想法投入深海频道…"
          aria-label="聊天内容"
        />
        <button type="submit" disabled={!input.trim() || isSending} aria-label="发送">
          <Icon name="send" />
        </button>
      </form>
    </div>
  )
}

interface FocusPanelProps {
  onCelebrate: () => void
}

function FocusPanel({ onCelebrate }: FocusPanelProps): React.JSX.Element {
  const total = 25 * 60
  const [seconds, setSeconds] = useState(total)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(false)

  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          setRunning(false)
          setCompleted(true)
          return 0
        }
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [running])

  useEffect(() => {
    if (completed) onCelebrate()
  }, [completed, onCelebrate])

  const reset = (): void => {
    setRunning(false)
    setCompleted(false)
    setSeconds(total)
  }

  const toggle = (): void => {
    if (seconds === 0) {
      setSeconds(total)
      setCompleted(false)
      setRunning(true)
      return
    }
    setRunning((value) => !value)
  }

  const progress = (total - seconds) / total
  const timerStyle = { '--timer-progress': `${progress * 360}deg` } as CSSProperties

  return (
    <div className="focus-view">
      <div className="focus-copy">
        <p className="eyebrow">SILENT DIVE · 25 MIN</p>
        <h2>{completed ? '浮上海面，做得好。' : running ? '只看眼前这一束光。' : '准备好，就向下静潜。'}</h2>
        <p>暂时把通知和杂念留在海面。鲸灵会替你看着时间。</p>
        <div className="focus-tags">
          <span>单任务</span><span>轻呼吸</span><span>结束庆祝</span>
        </div>
      </div>

      <div className={`timer-dial ${running ? 'is-running' : ''}`} style={timerStyle}>
        <div className="timer-waterline" />
        <div className="timer-inner">
          <small>{running ? 'DIVING' : completed ? 'COMPLETE' : 'READY'}</small>
          <strong>{formatTime(seconds)}</strong>
          <span>专注海域</span>
        </div>
      </div>

      <div className="timer-controls">
        <button className="primary-control" onClick={toggle}>
          <Icon name={running ? 'pause' : 'play'} />
          {running ? '暂停换气' : seconds === 0 ? '再潜一轮' : '开始静潜'}
        </button>
        <button className="secondary-control" onClick={reset} aria-label="重置计时">
          <Icon name="reset" />
        </button>
      </div>
    </div>
  )
}

interface SettingsPanelProps {
  settings: AppSettings
  bond: BondData | null
  onSettingsChange: (settings: AppSettings) => void
}

function SettingsPanel({ settings, bond, onSettingsChange }: SettingsPanelProps): React.JSX.Element {
  const [draft, setDraft] = useState(settings)
  const [scalePercent, setScalePercent] = useState(String(Math.round(settings.scale * 100)))
  const [apiKey, setApiKey] = useState('')
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setDraft(settings)
    setScalePercent(String(Math.round(settings.scale * 100)))
  }, [settings])

  const save = async (): Promise<void> => {
    const parsedScale = Number(scalePercent)
    if (!Number.isFinite(parsedScale) || parsedScale < 50 || parsedScale > 200) {
      setStatus('桌宠大小请输入 50 到 200 之间的数值。')
      return
    }
    const willHaveApiKey = settings.hasApiKey || Boolean(apiKey.trim())
    if (draft.chatMode === 'api' && (!draft.apiBaseUrl.trim() || !draft.model.trim() || !willHaveApiKey)) {
      setStatus('API 模式需要填写接口地址、模型名称和 API Key。')
      return
    }
    if (draft.scheduleEnabled && (!draft.sleepStart || !draft.sleepEnd)) {
      setStatus('作息开启时请填写入睡与起床时间。')
      return
    }
    setIsSaving(true)
    setStatus('')
    const patch: SettingsPatch = {
      soundEnabled: draft.soundEnabled,
      reducedMotion: draft.reducedMotion,
      launchAtLogin: draft.launchAtLogin,
      scale: Math.round(parsedScale) / 100,
      petGender: draft.petGender,
      chatMode: draft.chatMode,
      apiBaseUrl: draft.apiBaseUrl,
      model: draft.model,
      scheduleEnabled: draft.scheduleEnabled,
      sleepStart: draft.sleepStart,
      sleepEnd: draft.sleepEnd,
      awakeGraceMinutes: draft.awakeGraceMinutes,
      mealTimesEnabled: draft.mealTimesEnabled,
      weatherEnabled: draft.weatherEnabled,
      weatherLocation: draft.weatherLocation,
      careEnabled: draft.careEnabled,
      careIntervalMinutes: draft.careIntervalMinutes
    }
    if (apiKey.trim()) patch.apiKey = apiKey
    try {
      const updated = await petBridge.updateSettings(patch)
      onSettingsChange(updated)
      setDraft(updated)
      setScalePercent(String(Math.round(updated.scale * 100)))
      setApiKey('')
      setStatus(isElectron ? '设置已沉入本机安全舱。' : '浏览器演示设置已保存（密钥不会保存）。')
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : '设置保存失败。')
    } finally {
      setIsSaving(false)
    }
  }

  const clearKey = async (): Promise<void> => {
    const updated = await petBridge.updateSettings({ clearApiKey: true, chatMode: 'local' })
    onSettingsChange(updated)
    setDraft(updated)
    setScalePercent(String(Math.round(updated.scale * 100)))
    setApiKey('')
    setStatus('已移除保存的 API Key。')
  }

  return (
    <div className="settings-view">
      <div className="settings-column compact-settings">
        <section className="setting-section">
          <div className="section-title"><span>01</span><div><h2>鲸灵形象</h2><p>男女主共享全部动作与互动。</p></div></div>
          <div className="character-selector" role="radiogroup" aria-label="桌宠性别">
            <button
              type="button"
              role="radio"
              aria-checked={draft.petGender === 'female'}
              className={draft.petGender === 'female' ? 'active' : ''}
              onClick={() => setDraft({ ...draft, petGender: 'female' })}
            >
              <span className="character-preview"><img src={whaleGirl} alt="鲸鱼娘预览" draggable={false} /></span>
              <span className="character-option-copy"><small>GIRL</small><strong>鲸鱼娘</strong><b>原版 · 长发鲸尾礼服</b></span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={draft.petGender === 'male'}
              className={draft.petGender === 'male' ? 'active' : ''}
              onClick={() => setDraft({ ...draft, petGender: 'male' })}
            >
              <span className="character-preview"><img src={whaleBoy} alt="鲸鱼少年预览" draggable={false} /></span>
              <span className="character-option-copy"><small>BOY</small><strong>鲸鱼少年</strong><b>新角色 · 水手短装</b></span>
            </button>
          </div>
          <p className="character-note">切换后，待机、饿了、困倦、思考和工作状态会同步换成所选角色。</p>
        </section>

        <section className="setting-section">
          <div className="section-title"><span>02</span><div><h2>陪伴方式</h2><p>小动作，也可以很安静。</p></div></div>
          <Toggle
            label="轻柔音效"
            description="点击和计时完成时播放短音"
            checked={draft.soundEnabled}
            onChange={(value) => setDraft({ ...draft, soundEnabled: value })}
          />
          <Toggle
            label="减少动画"
            description="关闭漂浮、声呐与庆祝动效"
            checked={draft.reducedMotion}
            onChange={(value) => setDraft({ ...draft, reducedMotion: value })}
          />
          <Toggle
            label="开机时唤醒"
            description="登录 Windows 后自动出现"
            checked={draft.launchAtLogin}
            onChange={(value) => setDraft({ ...draft, launchAtLogin: value })}
          />
        </section>

        <section className="setting-section">
          <div className="section-title"><span>03</span><div><h2>桌面大小</h2><p>输入最舒服的陪伴距离。</p></div></div>
          <div className="scale-control">
            <label className="scale-number-field" htmlFor="pet-scale-input">
              <span>自定义比例</span>
              <span className="scale-number-input">
                <input
                  id="pet-scale-input"
                  type="number"
                  min="50"
                  max="200"
                  step="1"
                  inputMode="numeric"
                  value={scalePercent}
                  onChange={(event) => setScalePercent(event.target.value)}
                />
                <b>%</b>
              </span>
            </label>
            <div className="scale-readout">
              <strong>{Number(scalePercent) >= 50 && Number(scalePercent) <= 200
                ? `${Math.round(360 * Number(scalePercent) / 100)} × ${Math.round(500 * Number(scalePercent) / 100)} px`
                : '等待有效尺寸'}</strong>
              <small>范围 50–200 · 收起设置后生效</small>
            </div>
          </div>
          <div className="scale-presets" aria-label="常用桌宠大小">
            {[80, 100, 120, 150].map((percent) => (
              <button type="button" key={percent} onClick={() => setScalePercent(String(percent))}>{percent}%</button>
            ))}
          </div>
        </section>

        <section className="setting-section">
          <div className="section-title"><span>04</span><div><h2>作息活动</h2><p>到点睡觉，点它才会醒来。</p></div></div>
          <Toggle
            label="按作息活动"
            description="深夜自动入睡，单击唤醒"
            checked={draft.scheduleEnabled}
            onChange={(value) => setDraft({ ...draft, scheduleEnabled: value })}
          />
          <div className={`schedule-fields ${draft.scheduleEnabled ? '' : 'is-standby'}`}>
            <label className="time-field">
              <span>入睡时间</span>
              <input
                type="time"
                value={draft.sleepStart}
                onChange={(event) => setDraft({ ...draft, sleepStart: event.target.value })}
              />
            </label>
            <label className="time-field">
              <span>起床时间</span>
              <input
                type="time"
                value={draft.sleepEnd}
                onChange={(event) => setDraft({ ...draft, sleepEnd: event.target.value })}
              />
            </label>
            <label className="grace-field">
              <span>唤醒后保持清醒</span>
              <select
                value={String(draft.awakeGraceMinutes)}
                onChange={(event) => setDraft({ ...draft, awakeGraceMinutes: Number(event.target.value) })}
              >
                {[5, 10, 15, 30, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>{minutes} 分钟</option>
                ))}
              </select>
            </label>
          </div>
          <Toggle
            label="饭点想吃白饭"
            description="午晚两餐时间提示饿肚子"
            checked={draft.mealTimesEnabled}
            onChange={(value) => setDraft({ ...draft, mealTimesEnabled: value })}
          />
        </section>

        <section className="setting-section">
          <div className="section-title"><span>05</span><div><h2>天气感知</h2><p>外面的天气，它也想知道。</p></div></div>
          <Toggle
            label="跟随天气"
            description="下雨阴沉、晴天晒尾巴"
            checked={draft.weatherEnabled}
            onChange={(value) => setDraft({ ...draft, weatherEnabled: value })}
          />
          <div className={`schedule-fields ${draft.weatherEnabled ? '' : 'is-standby'}`}>
            <label>
              <span>城市名或坐标</span>
              <input
                value={draft.weatherLocation}
                onChange={(event) => setDraft({ ...draft, weatherLocation: event.target.value })}
                placeholder="如 Qinhuangdao 或 39.93,119.60"
                spellCheck={false}
              />
            </label>
            <p className="security-note">天气来自 Open-Meteo 免费接口，需要网络；获取失败会自动静默，不影响桌宠。</p>
          </div>
        </section>

        <section className="setting-section">
          <div className="section-title"><span>06</span><div><h2>主动关怀</h2><p>醒着时主动看看你在做什么。</p></div></div>
          <Toggle
            label="主动关怀"
            description="每隔一段时间主动搭话"
            checked={draft.careEnabled}
            onChange={(value) => setDraft({ ...draft, careEnabled: value })}
          />
          <div className={`schedule-fields ${draft.careEnabled ? '' : 'is-standby'}`}>
            <label className="grace-field">
              <span>关怀间隔</span>
              <select
                value={String(draft.careIntervalMinutes)}
                onChange={(event) => setDraft({ ...draft, careIntervalMinutes: Number(event.target.value) })}
              >
                <option value="60">1 小时</option>
                <option value="90">1.5–2 小时</option>
                <option value="180">3 小时</option>
              </select>
            </label>
            <p className="security-note">只读取当前窗口标题与空闲时间，不截屏、不记录、不上传。</p>
          </div>
        </section>
      </div>

      <div className="settings-column model-settings">
        <section className="setting-section api-section">
          <div className="section-title"><span>07</span><div><h2>聊天频道</h2><p>随时切换，不会清除已保存的配置。</p></div></div>
          <div className="model-mode-selector" role="radiogroup" aria-label="聊天模式">
            <button type="button" role="radio" aria-checked={draft.chatMode === 'local'} className={draft.chatMode === 'local' ? 'active' : ''} onClick={() => setDraft({ ...draft, chatMode: 'local' })}>
              <i />
              <span><small>LOCAL</small><strong>本地模式</strong><b>离线陪伴 · 不消耗 Token</b></span>
            </button>
            <button type="button" role="radio" aria-checked={draft.chatMode === 'api'} className={draft.chatMode === 'api' ? 'active' : ''} onClick={() => setDraft({ ...draft, chatMode: 'api' })}>
              <i />
              <span><small>API</small><strong>API 模式</strong><b>使用已配置的模型回复</b></span>
            </button>
          </div>
          <p className="mode-standby-note">{draft.chatMode === 'local'
            ? 'API 资料会留在本机安全舱中，切回 API 模式即可继续使用。'
            : settings.hasApiKey ? '已检测到加密密钥；保存后 API 模式立即生效。' : '请在下方补全 API 资料后保存。'}</p>
          <div className={`api-fields ${draft.chatMode === 'local' ? 'is-standby' : ''}`}>
            <label>
              <span>OpenAI-compatible API 地址</span>
              <input
                value={draft.apiBaseUrl}
                onChange={(event) => setDraft({ ...draft, apiBaseUrl: event.target.value })}
                placeholder="https://api.example.com/v1"
                spellCheck={false}
              />
            </label>
            <label>
              <span>模型名称</span>
              <input
                value={draft.model}
                onChange={(event) => setDraft({ ...draft, model: event.target.value })}
                placeholder="your-model-name"
                spellCheck={false}
              />
            </label>
            <label>
              <span>API Key {settings.hasApiKey && <em>已安全保存</em>}</span>
              <div className="secret-field">
                <Icon name="key" />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder={settings.hasApiKey ? '输入新 Key 可替换' : '不会写入仓库或日志'}
                  autoComplete="off"
                />
              </div>
            </label>
            <p className="security-note">
              {isElectron
                ? '密钥只提交给主进程，并用系统 safeStorage 加密；渲染页面无法读取明文。'
                : '当前是浏览器演示模式，不会保存或发送你输入的密钥。'}
            </p>
            {settings.hasApiKey && <button className="text-button danger" onClick={() => void clearKey()}>移除已保存的 Key</button>}
          </div>
        </section>

        <section className="setting-section">
          <div className="section-title"><span>08</span><div><h2>羁绊档案</h2><p>陪伴有迹可循。</p></div></div>
          <div className="bond-stats">
            <div className="bond-stat"><strong>{bond?.days ?? 1}</strong><span>陪伴天数</span></div>
            <div className="bond-stat"><strong>{formatBondDuration(bond?.totalFocusSeconds ?? 0)}</strong><span>累计专注</span></div>
          </div>
          <ul className="milestone-list">
            {MILESTONES.map((milestone) => {
              const focusHours = (bond?.totalFocusSeconds ?? 0) / 3600
              const unlocked = milestone.reached(bond?.days ?? 1, focusHours)
              return (
                <li key={milestone.id} className={unlocked ? 'unlocked' : ''}>
                  <b>{milestone.label}</b>
                  <span>{milestone.hint}</span>
                  <i aria-hidden="true">{unlocked ? '✓' : ''}</i>
                </li>
              )
            })}
          </ul>
        </section>
      </div>

      <footer className="settings-footer">
        <p className={/失败|不可用|请输入|需要填写/.test(status) ? 'error' : ''}>{status}</p>
        <button className="save-button" onClick={() => void save()} disabled={isSaving}>
          <Icon name="sparkle" />{isSaving ? '保存中…' : '保存到安全舱'}
        </button>
      </footer>
    </div>
  )
}

interface ToggleProps {
  label: string
  description: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Toggle({ label, description, checked, onChange }: ToggleProps): React.JSX.Element {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true"><b /></i>
    </label>
  )
}
