// Push notification service for HamAlert
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { apiService } from './api';

interface PushSettings {
  disable: boolean;
  sound: string;
}

class PushService {
  private registrationId: string | null = null;

  async initialize(): Promise<void> {
    // Push notifications only work on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications not available on web');
      return;
    }

    try {
      // Setup listeners
      this.setupListeners();

      // Request permission
      const permStatus = await PushNotifications.requestPermissions();
      
      if (permStatus.receive === 'granted') {
        // Register with Apple / Google to receive push via APNS/FCM
        await PushNotifications.register();
      } else {
        console.log('Push notification permission denied');
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  }

  private setupListeners(): void {
    // On success, get the registration token
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push registration success, token: ' + token.value);
      this.registrationId = token.value;
      
      // Ensure API service is initialized before updating token
      await apiService.initialize();
      
      if (apiService.isLoggedIn()) {
        console.log('API service is logged in, updating push token...');
        await this.updatePushToken();
      } else {
        console.log('API service not logged in yet, token will be sent on next app launch');
      }
    });

    // Registration error
    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push registration error:', error);
    });

    // Notification received (app in foreground)
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      // Trigger spots reload - handled by the consuming page
      window.dispatchEvent(new CustomEvent('push-notification-received', { detail: notification }));
    });

    // Notification action performed (user tapped on notification)
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification action performed:', action);
      // Trigger spots reload
      window.dispatchEvent(new CustomEvent('push-notification-tapped', { detail: action }));
    });
  }

  async updatePushToken(): Promise<void> {
    if (!this.registrationId) {
      console.log('No push token available yet');
      return;
    }
    
    if (!apiService.isLoggedIn()) {
      console.log('Not logged in, cannot update push token');
      return;
    }

    const pushToken = this.registrationId;

    try {
      const platform = Capacitor.getPlatform();
      const type = platform === 'ios' ? 'apns' : 'fcm';
      const deviceName = await this.getDeviceName();
      
      console.log(`Updating push token: type=${type}, deviceName=${deviceName}`);
      
      await apiService.post('/api/updatePushToken', {
        type,
        token: pushToken,
        deviceName,
      });
      console.log('Push token updated successfully');
    } catch (error) {
      console.error('Error updating push token:', error);
    }
  }

  async loadPushSettings(): Promise<PushSettings | null> {
    if (!this.registrationId || !apiService.isLoggedIn()) {
      return null;
    }

    const pushToken = this.registrationId;

    try {
      const response = await apiService.get<PushSettings>('/api/pushSettings', { token: pushToken });
      return response;
    } catch (error) {
      console.error('Error loading push settings:', error);
      return null;
    }
  }

  async updatePushSettings(disable: boolean, sound: string): Promise<void> {
    if (!this.registrationId || !apiService.isLoggedIn()) {
      return;
    }

    const pushToken = this.registrationId;

    try {
      await apiService.post('/api/updatePushSettings', {
        token: pushToken,
        disable: disable ? 1 : 0,
        sound,
      });
      console.log('Push settings updated successfully');
    } catch (error) {
      console.error('Error updating push settings:', error);
      throw error;
    }
  }

  async deletePushToken(): Promise<void> {
    if (this.registrationId) {
      try {
        await apiService.post('/api/deletePushToken', { token: this.registrationId });
        this.registrationId = null;
      } catch (error) {
        console.error('Error deleting push token:', error);
      }
    }
  }

  private async getDeviceName(): Promise<string> {
    try {
      const info = await Device.getInfo();
      // Use device name if available (e.g., "John's iPhone"), otherwise construct from platform
      if (info.name) {
        return info.name;
      }
      const platform = info.platform;
      return platform.charAt(0).toUpperCase() + platform.slice(1) + ' Device';
    } catch {
      return 'Unknown Device';
    }
  }

  async getRegistrationId(): Promise<string | null> {
    return this.registrationId;
  }
}

export const pushService = new PushService();
export default pushService;
