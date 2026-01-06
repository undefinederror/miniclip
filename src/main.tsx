import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Preferences from './Preferences.tsx'
import './index.css'

function Root() {
  const hash = window.location.hash;
  if (hash === '#preferences') {
    return <Preferences />;
  }
  return <App />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
)
