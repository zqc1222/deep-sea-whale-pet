import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { isElectron } from './bridge'
import './styles.css'

document.documentElement.classList.toggle('browser-demo', !isElectron)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
