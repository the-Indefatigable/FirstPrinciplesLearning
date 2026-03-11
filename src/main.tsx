import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch {
  // React 19 crashes in browsers with MetaMask / SES-lockdown extensions installed.
  // Show a recoverable fallback instead of a blank page.
  const root = document.getElementById('root')!
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;background:#faf8f5;color:#1a1612;padding:24px;text-align:center;">
      <div style="max-width:480px;">
        <h2 style="margin:0 0 12px;font-size:1.25rem;">Browser Extension Conflict</h2>
        <p style="margin:0 0 20px;color:#6b6358;line-height:1.6;">
          A browser extension (MetaMask, Coinbase Wallet, or similar) is preventing this page from loading.
        </p>
        <a href="." onclick="location.reload()" style="display:inline-block;padding:10px 24px;background:#d97706;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
          Try reloading
        </a>
        &nbsp;
        <a href="." style="display:inline-block;padding:10px 24px;border:1px solid #d97706;color:#d97706;border-radius:8px;text-decoration:none;font-weight:600;">
          Open in Incognito
        </a>
        <p style="margin:20px 0 0;font-size:0.8rem;color:#9c9488;">
          Tip: open an Incognito / Private window with extensions disabled.
        </p>
      </div>
    </div>
  `
}
