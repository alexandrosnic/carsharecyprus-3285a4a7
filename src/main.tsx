import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Service Worker Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

// PWA Manifest Link
const manifestLink = document.createElement('link');
manifestLink.rel = 'manifest';
manifestLink.href = '/manifest.json';
document.head.appendChild(manifestLink);

// Viewport Meta Tag for Mobile
const viewportMeta = document.createElement('meta');
viewportMeta.name = 'viewport';
viewportMeta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
document.head.appendChild(viewportMeta);

// Theme Color Meta Tags
const themeColorMeta = document.createElement('meta');
themeColorMeta.name = 'theme-color';
themeColorMeta.content = '#282d33';
document.head.appendChild(themeColorMeta);

const appleStatusBarMeta = document.createElement('meta');
appleStatusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
appleStatusBarMeta.content = 'black-translucent';
document.head.appendChild(appleStatusBarMeta);

const appleCapableMeta = document.createElement('meta');
appleCapableMeta.name = 'apple-mobile-web-app-capable';
appleCapableMeta.content = 'yes';
document.head.appendChild(appleCapableMeta);

document.documentElement.style.backgroundColor = '#282d33';
document.documentElement.style.colorScheme = 'dark';
document.body.style.backgroundColor = '#282d33';
document.body.style.minHeight = '100vh';

createRoot(document.getElementById("root")!).render(<App />);
