import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

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
