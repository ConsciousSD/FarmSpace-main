import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourname.farmspace',
  appName: 'FarmSpace',
  webDir: 'www',
  server: {
    androidScheme: 'https'
  }
};

export default config;
