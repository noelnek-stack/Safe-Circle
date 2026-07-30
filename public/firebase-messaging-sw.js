// This file MUST live at the site root (public/firebase-messaging-sw.js) —
// Firebase requires it there so its scope covers the whole site.
//
// Unlike src/firebase.js, this runs in a service worker, which can't read
// Vite's `import.meta.env` variables. Fill in the same config values here
// by hand from Firebase Console -> Project settings -> General -> your web
// app's config object. These values are not secret.

importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/11.0.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: "AIzaSyBk67XNxKv8ZUNNfIZO83_WmU4YNr4dEqk",
  authDomain: "safecircle-63bc7.firebaseapp.com",
  projectId: "safecircle-63bc7",
  storageBucket: "safecircle-63bc7.firebasestorage.app",
  messagingSenderId: "555498278744",
  appId: "1:555498278744:web:e45e9fbce84162d2c45f2d"
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {}
  self.registration.showNotification(title || 'SafeCircle alert', {
    body: body || '',
    icon: '/favicon.svg',
  })
})
