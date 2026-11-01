import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Jotspring native shells (iOS + Android). The app ships its built `dist/`
 * inside the binary (so it opens offline and isn't a thin remote-URL wrapper,
 * which Apple's guideline 4.2 rejects); data still comes from Supabase.
 */
const config: CapacitorConfig = {
  appId: 'com.nvexis.jotspring',
  appName: 'Jotspring',
  webDir: 'dist',
  ios: { contentInset: 'always', backgroundColor: '#ECE4D6' },
  android: { backgroundColor: '#ECE4D6', allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 800, backgroundColor: '#A03A33', showSpinner: false },
    FirebaseMessaging: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
