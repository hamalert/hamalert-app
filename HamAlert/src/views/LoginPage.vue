<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Login</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content :fullscreen="true" class="ion-padding">
      <div class="login-container">
        <div class="logo-container">
          <img class="app-logo" alt="HamAlert" />
        </div>

        <form @submit.prevent="handleLogin">
          <ion-list>
            <ion-item>
              <ion-input
                v-model="username"
                name="username"
                placeholder="Username (Callsign)"
                type="text"
                autocomplete="username"
                autocapitalize="characters"
                autocorrect="off"
                enterkeyhint="next"
                required
              ></ion-input>
            </ion-item>

            <ion-item>
              <ion-input
                v-model="password"
                name="password"
                placeholder="Password"
                type="password"
                autocomplete="current-password"
                enterkeyhint="done"
                required
              ></ion-input>
            </ion-item>
          </ion-list>

          <div class="ion-padding-top">
            <ion-button
              expand="block"
              type="submit"
              :disabled="isLoading || !username || !password"
            >
              <ion-spinner v-if="isLoading" name="crescent"></ion-spinner>
              <span v-else>Log In</span>
            </ion-button>
          </div>
        </form>

        <div class="links ion-padding-top">
          <ion-button fill="clear" @click="openRegister">
            Register
          </ion-button>
          <ion-button fill="clear" @click="openForgotPassword">
            Forgot Password?
          </ion-button>
        </div>

        <div class="privacy-link ion-padding-top">
          <ion-button fill="clear" size="small" @click="openPrivacy">
            Privacy Policy
          </ion-button>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonSpinner,
  alertController,
} from '@ionic/vue';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { apiService } from '@/services/api';
import { pushService } from '@/services/push';

const router = useRouter();
const username = ref('');
const password = ref('');
const isLoading = ref(false);

const handleLogin = async () => {
  if (!username.value || !password.value) {
    return;
  }

  isLoading.value = true;

  try {
    const success = await apiService.checkLogin(
      username.value.toUpperCase(),
      password.value
    );

    if (success) {
      // Initialize push notifications on native platforms
      if (Capacitor.isNativePlatform()) {
        await pushService.initialize();
        await pushService.updatePushToken();
      }
      
      // Navigate to home page
      router.replace('/home');
    } else {
      await showErrorAlert('Login failed', 'Please check your username and password.');
    }
  } catch (error) {
    console.error('Login error:', error);
    await showErrorAlert(
      'Connection failed',
      'Could not connect to HamAlert server. Please check your internet connection.'
    );
  } finally {
    isLoading.value = false;
  }
};

const showErrorAlert = async (header: string, message: string) => {
  const alert = await alertController.create({
    header,
    message,
    buttons: ['OK'],
  });
  await alert.present();
};

const openRegister = async () => {
  await Browser.open({ url: 'https://hamalert.org/register' });
};

const openForgotPassword = async () => {
  await Browser.open({ url: 'https://hamalert.org/forgotpass' });
};

const openPrivacy = async () => {
  await Browser.open({ url: 'https://hamalert.org/privacy' });
};
</script>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 0 auto;
  padding-top: 40px;
}

.logo-container {
  text-align: center;
  margin-bottom: 30px;
}

.logo-container .app-logo {
  max-width: 80%;
  max-height: 80px;
  content: url('/hamalert.png');
}

@media (prefers-color-scheme: dark) {
  .logo-container .app-logo {
    content: url('/hamalert_light.png');
  }
}

.links {
  display: flex;
  justify-content: space-around;
}

.privacy-link {
  text-align: center;
}
</style>
