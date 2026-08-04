import type { SVGProps } from 'react'

export type IconName =
  | 'back'
  | 'chat'
  | 'close'
  | 'focus'
  | 'key'
  | 'pause'
  | 'play'
  | 'reset'
  | 'send'
  | 'settings'
  | 'sound'
  | 'sparkle'

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
}

export function Icon({ name, ...props }: IconProps): React.JSX.Element {
  const content = (() => {
    switch (name) {
      case 'chat':
        return <path d="M5 6.5h14a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-7l-4.5 3v-3H5a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3Z" />
      case 'focus':
        return <><circle cx="12" cy="13" r="8" /><path d="M9 2h6M12 9v4l3 2M18 5l2 2" /></>
      case 'settings':
        return <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.82 2.82-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.04 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.36a1.7 1.7 0 0 0-1.88.34l-.06.06-2.82-2.82.06-.06A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3.04 14H3v-4h.04A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88L4.2 7.06l2.82-2.82.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.82 2.82-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 20.96 10H21v4h-.04A1.7 1.7 0 0 0 19.4 15Z" /></>
      case 'send':
        return <path d="m3 11 18-8-7.5 18-2.1-7.4L3 11Zm8.4 2.6L21 3" />
      case 'close':
        return <path d="m6 6 12 12M18 6 6 18" />
      case 'back':
        return <path d="m15 18-6-6 6-6" />
      case 'play':
        return <path d="m8 5 11 7-11 7V5Z" />
      case 'pause':
        return <path d="M8 5v14M16 5v14" />
      case 'reset':
        return <><path d="M4 4v6h6" /><path d="M5.4 17a8 8 0 1 0 .6-10l-2 3" /></>
      case 'sound':
        return <><path d="M5 10v4h3l5 4V6l-5 4H5Z" /><path d="M17 9a4 4 0 0 1 0 6M19.5 6.5a8 8 0 0 1 0 11" /></>
      case 'key':
        return <><circle cx="8" cy="12" r="4" /><path d="M12 12h9M17 12v3M20 12v2" /></>
      case 'sparkle':
        return <><path d="M12 2c.7 5.3 2.7 7.3 8 8-5.3.7-7.3 2.7-8 8-.7-5.3-2.7-7.3-8-8 5.3-.7 7.3-2.7 8-8Z" /><path d="M19 17c.3 2.3 1.2 3.2 3.5 3.5-2.3.3-3.2 1.2-3.5 3.5-.3-2.3-1.2-3.2-3.5-3.5 2.3-.3 3.2-1.2 3.5-3.5Z" /></>
    }
  })()

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {content}
    </svg>
  )
}
