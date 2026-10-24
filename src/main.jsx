import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/global.css'
import './styles/prizm.css'
import { NETWORK_PUBLIC_URL } from './services/team'

// L'ancienne adresse du Comp Builder renvoie vers sa nouvelle place,
// dans le site du PRIZM Competitive Network (même connexion Discord).
if (window.location.hostname === 'frosefox.github.io') {
  window.location.replace(NETWORK_PUBLIC_URL + 'compo/' + window.location.hash)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
