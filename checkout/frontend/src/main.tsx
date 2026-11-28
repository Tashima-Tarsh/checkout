import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

async function start() {
  const root = ReactDOM.createRoot(document.getElementById('root')!)
  // The S3 website uses a dedicated public landing build. Existing public
  // content pages are independently hosted and financial prototypes must
  // not become public SPA routes.
  if (import.meta.env.VITE_PUBLIC_LANDING_ONLY === 'true') {
    const [{ Home }, { Navbar }, { Footer }] = await Promise.all([
      import('./pages/Home'),
      import('./components/navigation/Navbar'),
      import('./components/layout/Footer'),
    ])
    root.render(<React.StrictMode><div className="disha-body"><Navbar/><Home/><Footer/></div></React.StrictMode>)
  } else {
    const { default: App } = await import('./App')
    root.render(<React.StrictMode><App/></React.StrictMode>)
  }
}

void start()
