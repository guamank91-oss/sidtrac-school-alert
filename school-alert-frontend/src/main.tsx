import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './index.css'

// Apply saved theme immediately before React renders (prevents flash)
;(function initTheme() {
  const stored = localStorage.getItem('sidtrac-theme') ?? 'dark'
  const resolved =
    stored === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : stored
  document.documentElement.classList.add(resolved)
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
