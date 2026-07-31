import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging'

// These values come from Firebase Console -> Project settings -> General ->
// "Your apps" -> the web app's config object. They are NOT secret (they
// identify your project, they don't authenticate anything) so it's fine
// for them to live in the frontend bundle.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

let messagingPromise = null

function getMessagingInstance() {
  if (!messagingPromise) {
    messagingPromise = isSupported().then((supported) => {
      if (!supported || !firebaseConfig.apiKey) return null
      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
      return getMessaging(app)
    })
  }
  return messagingPromise
}

// Asks the browser for notification permission, registers the service
// worker, waits for it to become active, and returns an FCM device token
// for this browser. Throws with a readable message if any step fails.
export async function requestPushToken() {
  const messaging = await getMessagingInstance()
  if (!messaging) {
    throw new Error('Push notifications aren\'t configured (missing Firebase config) or aren\'t supported in this browser.')
  }
  if (!('Notification' in window)) {
    throw new Error('This browser does not support notifications.')
  }
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Workers are not supported in this browser.')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.')
  }

  // Register the service worker and wait for it to be fully active.
  // Firebase's getToken() calls PushManager.subscribe() internally, which
  // requires the SW to be in the "activated" state — not just "installing".
  // Using navigator.serviceWorker.ready guarantees activation before we
  // ask for the FCM token, which prevents the "no active Service Worker" error.
  const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: '/',
  })

  // Wait for the SW to become active (handles the case where it is still
  // installing on the very first page load).
  await navigator.serviceWorker.ready

  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY

  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration })
  if (!token) {
    throw new Error('Could not get a push token from Firebase. Make sure your VAPID key is correct and the site is served over HTTPS.')
  }
  return token
}

// Subscribes to messages that arrive while the tab is open and focused.
// Returns an unsubscribe function.
export async function listenForForegroundMessages(callback) {
  const messaging = await getMessagingInstance()
  if (!messaging) return () => {}
  return onMessage(messaging, callback)
}
