import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/sofia-sans-extra-condensed' // lock-screen clock only
import './index.css'
import FoldPhoneHero from './components/foldphone/FoldPhoneHero'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FoldPhoneHero />
  </StrictMode>,
)
