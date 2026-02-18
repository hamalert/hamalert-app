// API service for HamAlert
import { Preferences } from '@capacitor/preferences';

const API_BASE_URL = 'https://hamalert.org';

interface Credentials {
  username: string;
  password: string;
}

class ApiService {
  private credentials: Credentials | null = null;
  private initPromise: Promise<boolean> | null = null;
  private initialized = false;

  constructor() {
    // Start loading credentials immediately
    this.initPromise = this.loadCredentials();
  }

  async initialize(): Promise<boolean> {
    // If already initialized, return immediately
    if (this.initialized) {
      return this.credentials !== null;
    }
    
    // If initialization is in progress, wait for it
    if (this.initPromise) {
      await this.initPromise;
      this.initPromise = null;
      this.initialized = true;
    }
    
    return this.credentials !== null;
  }

  private async loadCredentials(): Promise<boolean> {
    const { value: username } = await Preferences.get({ key: 'username' });
    const { value: password } = await Preferences.get({ key: 'password' });
    if (username && password) {
      this.credentials = { username, password };
      return true;
    }
    return false;
  }

  async saveCredentials(username: string, password: string): Promise<void> {
    await Preferences.set({ key: 'username', value: username });
    await Preferences.set({ key: 'password', value: password });
    this.credentials = { username, password };
    this.initialized = true;
  }

  async clearCredentials(): Promise<void> {
    await Preferences.remove({ key: 'username' });
    await Preferences.remove({ key: 'password' });
    await Preferences.remove({ key: 'cachedSpots' });
    this.credentials = null;
    this.initialized = false;
  }

  isLoggedIn(): boolean {
    return this.credentials !== null;
  }

  getUsername(): string | null {
    return this.credentials?.username || null;
  }

  getPassword(): string | null {
    return this.credentials?.password || null;
  }

  private getAuthHeaders(): HeadersInit {
    if (!this.credentials) {
      return {};
    }
    const auth = btoa(`${this.credentials.username}:${this.credentials.password}`);
    return {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    };
  }

  async get<T>(path: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${API_BASE_URL}${path}`);
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] != null) {
          url.searchParams.append(key, params[key].toString());
        }
      });
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed');
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async post<T>(path: string, data?: Record<string, any>): Promise<T> {
    const formData = new URLSearchParams();
    if (data) {
      Object.entries(data).forEach(([key, value]) => {
        if (value != null) {
          formData.append(key, value.toString());
        }
      });
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication failed');
      }
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }

  async checkLogin(username: string, password: string): Promise<boolean> {
    try {
      // Temporarily set credentials for this request
      const tempAuth = btoa(`${username}:${password}`);
      const response = await fetch(`${API_BASE_URL}/api/checkLogin`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${tempAuth}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        await this.saveCredentials(username, password);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    await this.clearCredentials();
  }
}

export const apiService = new ApiService();
export default apiService;
