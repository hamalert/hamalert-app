import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'org.hamalert.app',
  appName: 'HamAlert',
  webDir: 'dist',
  server: {
    hostname: 'hamalert.org',
    androidScheme: 'https',
  }
};

export default config;
