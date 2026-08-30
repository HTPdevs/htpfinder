import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from '@/App'
import '@/styles/index.css'
// Per-demo palette. Loaded after the base tokens so it wins the cascade.
import '@demo/theme.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
