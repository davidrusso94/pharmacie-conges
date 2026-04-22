import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Polyfill window.storage to use localStorage
window.storage = {
  get: async (key) => {
    const value = localStorage.getItem(key);
    if (value === null) throw new Error('Key not found');
    return { key, value };
  },
  set: async (key, value) => {
    localStorage.setItem(key, value);
    return { key, value };
  },
  delete: async (key) => {
    localStorage.removeItem(key);
    return { key, deleted: true };
  },
  list: async (prefix) => {
    const keys = Object.keys(localStorage).filter(k => !prefix || k.startsWith(prefix));
    return { keys };
  }
};

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
