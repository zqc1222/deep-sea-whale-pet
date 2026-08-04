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
  AppSettings,
  ChatMessage,
  PetAction,
  PetGender,
  SettingsPatch,
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
  hasApiKey: false
}

const BUBBLES = [
  '深海信号良好，今天也一起加油。',
  '我刚刚捞到一颗很亮的念头。',
  '要不要先喝口水？鲸鱼也要记得换气。',
  '桌面这么安静，我给你摇一小会儿尾巴。',
  '有难题就双击我，我们慢慢拆开。',
  '检测到一点点疲惫，休息不是掉线。'
]

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
      mood !== 'idle'
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
  }, [isPageVisible, mode, mood, personaState, settings.reducedMotion])

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
      mood !== 'idle'
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
  }, [isPageVisible, mode, mood, personaState, settings.reducedMotion])

  useEffect(() => {
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
  }, [isPageVisible, mode, mood, personaState, settings.reducedMotion])

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
  }, [settings.soundEnabled, showBubble])

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
    if (clickTimer.current) window.clearTimeout(clickTimer.current)
    showBubble('频道接通。想聊点什么？', 'happy', 1800)
    void openMode('chat')
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (event.button !== 0) return
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
    const currentIndex = PERSONA_CYCLE.indexOf(personaState)
    const next = PERSONA_CYCLE[(currentIndex + 1) % PERSONA_CYCLE.length] ?? 'hungry'
    hasPlayedPersona.current = true
    setPersonaState(next)
  }, [personaState])

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
        mood={mood}
        mode={mode}
        demoOffset={demoOffset}
        isBlinking={isBlinking}
        idleAccent={idleAccent}
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
                }}
              />
            )}
            {mode === 'settings' && <SettingsPanel settings={settings} onSettingsChange={setSettings} />}
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

function PetStage(props: PetStageProps): React.JSX.Element {
  const stageStyle: CSSProperties | undefined = !isElectron && props.mode === 'pet'
    ? { transform: `translate3d(${props.demoOffset.x}px, ${props.demoOffset.y}px, 0)` }
    : undefined

  const personaArt = props.personaState === 'idle' ? null : PERSONA_ASSETS[props.petGender][props.personaState]
  const baseArt = IDLE_ASSETS[props.petGender]
  const personaAlt = PERSONA_ALT[props.petGender]

  return (
    <section
      className={`pet-stage ${props.mood === 'dragging' ? 'is-dragging' : ''}`}
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
  onSettingsChange: (settings: AppSettings) => void
}

function SettingsPanel({ settings, onSettingsChange }: SettingsPanelProps): React.JSX.Element {
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
      model: draft.model
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
      </div>

      <div className="settings-column model-settings">
        <section className="setting-section api-section">
          <div className="section-title"><span>04</span><div><h2>聊天频道</h2><p>随时切换，不会清除已保存的配置。</p></div></div>
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
