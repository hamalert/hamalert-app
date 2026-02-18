<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <div class="toolbar-logo">
          <img class="app-logo" alt="HamAlert" />
        </div>
        <div slot="end" class="utc-clock">
          <ion-icon :icon="timeOutline"></ion-icon>
          <span>{{ currentUtcTime }}</span>
        </div>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-refresher slot="fixed" @ionRefresh="handleRefresh($event)">
        <ion-refresher-content></ion-refresher-content>
      </ion-refresher>

      <!-- Loading state -->
      <div v-if="isLoading && spots.length === 0" class="ion-padding ion-text-center">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Loading spots...</p>
      </div>

      <!-- No triggers warning -->
      <ion-card v-if="!isLoading && spots.length === 0 && !hasAnyAppTrigger">
        <ion-card-content class="ion-text-center">
          <ion-icon :icon="warningOutline" size="large" color="warning"></ion-icon>
          <p>You don't have any triggers with the "App" action enabled.</p>
        </ion-card-content>
      </ion-card>

      <!-- No spots message -->
      <ion-card v-if="!isLoading && spots.length === 0 && hasAnyAppTrigger">
        <ion-card-content class="ion-text-center">
          <p>No spots in the last 24 hours.</p>
        </ion-card-content>
      </ion-card>

      <!-- Spots list -->
      <SpotsList 
        :spots="spots" 
        @delete="deleteSpot" 
        @toggleDetails="() => {}" 
      />

      <!-- Delete all button -->
      <div v-if="spots.length > 0" class="delete-all-container">
        <ion-button expand="block" fill="clear" color="danger" @click="deleteAllSpots">
          Delete all
        </ion-button>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonContent,
  IonRefresher,
  IonRefresherContent,
  IonButtons,
  IonMenuButton,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonButton,
  alertController,
} from '@ionic/vue';
import { warningOutline, timeOutline } from 'ionicons/icons';
import { apiService } from '@/services/api';
import { spotsService } from '@/services/spots';
import type { Spot } from '@/types/spot';
import SpotsList from '@/components/SpotsList.vue';

const router = useRouter();
const spots = ref<Spot[]>([]);
const isLoading = ref(false);
const hasAnyAppTrigger = ref(true);
const currentUtcTime = ref('');
let clockInterval: number | undefined;

const updateUtcTime = () => {
  const now = new Date();
  currentUtcTime.value = now.toISOString().substring(11, 16) + 'z';
};

onMounted(async () => {
  // Start UTC clock
  updateUtcTime();
  clockInterval = window.setInterval(updateUtcTime, 1000);
  
  // Listen for push notifications
  window.addEventListener('push-notification-received', handlePushNotification);
  window.addEventListener('push-notification-tapped', handlePushNotification);
  
  // Check if user is logged in
  if (!apiService.isLoggedIn()) {
    router.replace('/login');
    return;
  }
  
  // Load cached spots first
  const cachedSpots = await spotsService.getCachedSpots();
  if (cachedSpots) {
    spots.value = cachedSpots;
    spotsService.markAllSpotsAsSeen(cachedSpots);
  }
  
  // Then load fresh spots
  await reloadSpots();
});

onUnmounted(() => {
  // Clear clock interval
  if (clockInterval) {
    clearInterval(clockInterval);
  }
  
  // Remove push notification listeners
  window.removeEventListener('push-notification-received', handlePushNotification);
  window.removeEventListener('push-notification-tapped', handlePushNotification);
});

const reloadSpots = async () => {
  isLoading.value = true;
  
  try {
    const response = await spotsService.getSpots();
    spots.value = response.spots;
    hasAnyAppTrigger.value = response.hasAnyAppTrigger;
  } catch (error) {
    console.error('Error loading spots:', error);
    const alert = await alertController.create({
      header: 'Connection failed',
      message: 'Could not load spots. Make sure you are connected to the Internet.',
      buttons: ['OK'],
    });
    await alert.present();
  } finally {
    isLoading.value = false;
  }
};

const handleRefresh = async (event: CustomEvent) => {
  await reloadSpots();
  event.detail.complete();
};

const deleteSpot = async (spotId: string) => {
  try {
    await spotsService.deleteSpot(spotId);
    spots.value = spots.value.filter(spot => spot._id !== spotId);
  } catch (error) {
    console.error('Error deleting spot:', error);
  }
};

const deleteAllSpots = async () => {
  const alert = await alertController.create({
    header: 'Delete all spots',
    message: 'Are you sure you want to delete all spots?',
    buttons: [
      {
        text: 'Cancel',
        role: 'cancel',
      },
      {
        text: 'Delete all',
        role: 'destructive',
        handler: async () => {
          try {
            await spotsService.deleteAllSpots();
            await reloadSpots();
          } catch (error) {
            console.error('Error deleting all spots:', error);
          }
        },
      },
    ],
  });
  await alert.present();
};

const handlePushNotification = async () => {
  console.log('Push notification received, reloading spots...');
  await reloadSpots();
};
</script>

<style scoped>
ion-toolbar {
  --min-height: 54px;
}

/* Toolbar logo container */
.toolbar-logo {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  pointer-events: none;
}

/* Logo styling with dark mode support */
.app-logo {
  height: 30px;
  width: auto;
  content: url('/hamalert.png');
}

@media (prefers-color-scheme: dark) {
  .app-logo {
    content: url('/hamalert_light.png');
  }
}

/* UTC clock styling */
.utc-clock {
  margin-right: 12px;
  padding: 6px 8px;
  background: var(--ion-color-light);
  border: 1px solid var(--ion-color-medium);
  border-radius: 16px;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--ion-color-medium);
}

.utc-clock ion-icon {
  font-size: 1.1rem;
}

@media (prefers-color-scheme: dark) {
  .utc-clock {
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: #fff;
  }
}

/* Delete all button container */
.delete-all-container {
  text-align: center;
  padding-bottom: 20px;
}
</style>
