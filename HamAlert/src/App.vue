<template>
  <ion-app>
    <ion-split-pane content-id="main-content">
      <ion-menu content-id="main-content" type="overlay">
        <ion-content>
          <ion-list id="menu-list">
            <ion-list-header>{{ username || 'Not logged in' }}</ion-list-header>
            
            <ion-menu-toggle :auto-hide="false" v-if="isLoggedIn">
              <ion-item button @click="openTriggers">
                <ion-icon slot="start" :icon="notificationsOutline"></ion-icon>
                <ion-label>Triggers</ion-label>
              </ion-item>
              <ion-item button @click="openLimits">
                <ion-icon slot="start" :icon="statsChartOutline"></ion-icon>
                <ion-label>Limits</ion-label>
              </ion-item>
              <ion-item button @click="openDestinations">
                <ion-icon slot="start" :icon="mailOutline"></ion-icon>
                <ion-label>Destinations</ion-label>
              </ion-item>
              <ion-item router-link="/settings" router-direction="forward">
                <ion-icon slot="start" :icon="settingsOutline"></ion-icon>
                <ion-label>Settings</ion-label>
              </ion-item>
              <ion-item button @click="handleLogout">
                <ion-icon slot="start" :icon="logOutOutline"></ion-icon>
                <ion-label>Logout</ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>

          <ion-list id="support-list">
            <ion-list-header>Support</ion-list-header>
            <ion-menu-toggle :auto-hide="false">
              <ion-item button @click="openSupport">
                <ion-icon slot="start" :icon="chatbubblesOutline"></ion-icon>
                <ion-label>Forum</ion-label>
              </ion-item>
              <ion-item button @click="openGitHub">
                <ion-icon slot="start" :icon="logoGithub"></ion-icon>
                <ion-label>
                  GitHub
                  <p>for bugs/feature requests</p>
                </ion-label>
              </ion-item>
            </ion-menu-toggle>
          </ion-list>
        </ion-content>
      </ion-menu>
      <ion-router-outlet id="main-content"></ion-router-outlet>
    </ion-split-pane>
  </ion-app>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  IonApp,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonMenu,
  IonMenuToggle,
  IonRouterOutlet,
  IonSplitPane,
  alertController,
} from '@ionic/vue';
import {
  notificationsOutline,
  statsChartOutline,
  mailOutline,
  settingsOutline,
  logOutOutline,
  chatbubblesOutline,
  logoGithub,
} from 'ionicons/icons';
import { apiService } from '@/services/api';
import { pushService } from '@/services/push';
import { Browser } from '@capacitor/browser';

const router = useRouter();
const route = useRoute();
const isLoggedIn = ref(apiService.isLoggedIn());
const username = ref(apiService.getUsername());

// Update login state when component mounts or route changes
const updateLoginState = () => {
  isLoggedIn.value = apiService.isLoggedIn();
  username.value = apiService.getUsername();
};

onMounted(async () => {
  // Wait for credentials to load from storage
  await apiService.initialize();
  
  updateLoginState();
  
  // Initialize push notifications if logged in
  if (apiService.isLoggedIn()) {
    await pushService.initialize();
    // Send token to server if we have one (in case registration happened before login)
    await pushService.updatePushToken();
  }
});

// Watch for route changes to update login state
watch(() => route.path, () => {
  updateLoginState();
});

const openInAppBrowserWithLogin = async (path: string) => {
  const username = apiService.getUsername();
  const password = apiService.getPassword();
  
  if (!username || !password) {
    return;
  }

  const url = `https://hamalert.org/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}&goto=${encodeURIComponent(path + '?hidenav=1')}`;
  await Browser.open({ url });
};

const openTriggers = async () => {
  await openInAppBrowserWithLogin('/triggers');
};

const openLimits = async () => {
  await openInAppBrowserWithLogin('/limits');
};

const openDestinations = async () => {
  await openInAppBrowserWithLogin('/destinations');
};

const handleLogout = async () => {
  const alert = await alertController.create({
    header: 'Confirm Logout',
    message: 'Are you sure you want to logout?',
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel',
      },
      {
        text: 'Logout',
        role: 'confirm',
        handler: async () => {
          // Delete push token before logout
          await pushService.deletePushToken();
          apiService.logout();
          router.replace('/login');
        },
      },
    ],
  });

  await alert.present();
};

const openSupport = async () => {
  await Browser.open({ url: 'https://forum.hamalert.org/' });
};

const openGitHub = async () => {
  await Browser.open({ url: 'https://github.com/hamalert' });
};
</script>

<style scoped>
#menu-list,
#support-list {
  padding-top: 20px;
}

#menu-list {
  padding-top: calc(env(safe-area-inset-top) + 20px);
}

ion-menu ion-content {
  --background: var(--ion-item-background, var(--ion-background-color, #fff));
  --padding-top: 0;
}

ion-menu ion-list {
  background: transparent;
}

ion-menu ion-item {
  --padding-start: 16px;
  --min-height: 50px;
}

ion-menu ion-icon {
  margin-right: 16px;
}

ion-menu ion-list-header {
  font-size: 1rem;
  font-weight: 600;
  padding-left: 16px;
}
</style>
