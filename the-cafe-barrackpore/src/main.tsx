import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { QRCodeGenerator } from './components/QRCodeGenerator'

const isQRRoute = window.location.pathname === '/qr';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isQRRoute ? <QRCodeGenerator /> : <App />}
  </StrictMode>,
)
