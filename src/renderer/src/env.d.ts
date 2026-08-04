import type { PetBridge } from '../../shared/types'

declare global {
  interface Window {
    petAPI?: PetBridge
  }
}

export {}
