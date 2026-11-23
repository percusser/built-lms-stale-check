import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

export const ADMIN_EMAIL = 'tyler@builtlms.com';

let app;

export function firebaseApp() {
  if (!FIREBASE_CONFIG) return null;
  if (!app) {
    app = initializeApp(FIREBASE_CONFIG.firebase);
    const debugToken = DEBUG_APP_CHECK && FIREBASE_CONFIG.appCheckDebugToken;
    if (debugToken) self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    const siteKey = FIREBASE_CONFIG.recaptchaSiteKey || (debugToken ? 'debug' : '');
    if (siteKey) initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true });
  }
  return app;
}

export function isAdminUser(user) {
  return Boolean(user?.emailVerified && user.email === ADMIN_EMAIL && user.providerData.some((p) => p.providerId === 'google.com'));
}

export function watchUser(app, onChange) {
  return onAuthStateChanged(getAuth(app), onChange);
}

export function signInAdmin(app) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ login_hint: ADMIN_EMAIL, prompt: 'select_account' });
  return signInWithPopup(getAuth(app), provider);
}

export function signOutUser(app) {
  return signOut(getAuth(app));
}
