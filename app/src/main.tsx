import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { PrintView } from './routes/PrintView.tsx'

// Plain path check rather than a router library — there's only one real route
// (the editor) and one export-only route (print) until Milestone 6 introduces
// multiple saved documents and auth, at which point a router earns its keep.
const isPrintRoute = window.location.pathname.startsWith('/print')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPrintRoute ? <PrintView /> : <App />}
  </StrictMode>,
)
