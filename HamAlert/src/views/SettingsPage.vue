<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-back-button default-href="/home"></ion-back-button>
        </ion-buttons>
        <ion-title>Settings</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <!-- Loading state -->
      <div v-if="isLoading" class="ion-padding ion-text-center">
        <ion-spinner name="crescent"></ion-spinner>
        <p>Loading settings...</p>
      </div>

      <div v-else>
        <!-- Push Notifications -->
        <ion-list>
          <ion-item button :detail="false" @click="onPushItemClick">
            <ion-label>Push Notifications</ion-label>
            <ion-toggle
              slot="end"
              v-model="pushEnabled"
              @click.stop
              @ionChange="handlePushToggle($event)"
            ></ion-toggle>
          </ion-item>
        </ion-list>

        <!-- Sound Settings (shown when push is enabled) -->
        <ion-list v-if="pushEnabled">
          <ion-list-header>Sound</ion-list-header>
          <ion-radio-group v-model="selectedSound">
            <ion-item
              v-for="option in soundOptions"
              :key="option.value"
              button
              :detail="false"
              @click="setSound(option.value)"
            >
              <ion-label>{{ option.label }}</ion-label>
              <ion-radio slot="end" :value="option.value"></ion-radio>
            </ion-item>
          </ion-radio-group>
        </ion-list>

        <!-- Time Display -->
        <ion-list class="ion-margin-top">
          <ion-list-header>Time Display</ion-list-header>
          <ion-radio-group v-model="timeDisplay">
            <ion-item
              v-for="option in timeDisplayOptions"
              :key="option.value"
              button
              :detail="false"
              @click="setTimeDisplay(option.value)"
            >
              <ion-label>{{ option.label }}</ion-label>
              <ion-radio slot="end" :value="option.value"></ion-radio>
            </ion-item>
          </ion-radio-group>
        </ion-list>

        <!-- Mute Duration -->
        <ion-list class="ion-margin-top">
          <ion-list-header>Mute Duration</ion-list-header>
          <ion-radio-group v-model="muteDuration">
            <ion-item
              v-for="option in muteDurationOptions"
              :key="option.value"
              button
              :detail="false"
              @click="setMuteDuration(option.value)"
            >
              <ion-label>{{ option.label }}</ion-label>
              <ion-radio slot="end" :value="option.value"></ion-radio>
            </ion-item>
          </ion-radio-group>
        </ion-list>

        <div class="ion-padding ion-text-center attribution">
          <ion-text color="medium">
            <small>Blip sound attribution: Marianne Gagnon</small>
          </ion-text>
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonListHeader,
  IonItem,
  IonLabel,
  IonToggle,
  IonRadio,
  IonRadioGroup,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonText,
  alertController,
} from '@ionic/vue';
import { pushService } from '@/services/push';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const isLoading = ref(true);
const pushEnabled = ref(true);
const selectedSound = ref('default');
const timeDisplay = ref('utc');
const muteDuration = ref('3600');

type Option = {
  label: string;
  value: string;
};

const soundOptions: Option[] = [
  { label: 'Default', value: 'default' },
  { label: 'Blip (short)', value: 'blip' },
  { label: 'Morse', value: 'morse' },
];

const timeDisplayOptions: Option[] = [
  { label: 'UTC', value: 'utc' },
  { label: 'Local', value: 'local' },
];

const muteDurationOptions: Option[] = [
  { label: '10 minutes', value: '600' },
  { label: '30 minutes', value: '1800' },
  { label: '1 hour', value: '3600' },
  { label: '2 hours', value: '7200' },
  { label: '6 hours', value: '21600' },
  { label: '12 hours', value: '43200' },
  { label: '24 hours', value: '86400' },
];

onMounted(async () => {
  await loadSettings();
});

const loadSettings = async () => {
  isLoading.value = true;

  try {
    // Load push settings if available
    if (Capacitor.isNativePlatform()) {
      const pushSettings = await pushService.loadPushSettings();
      if (pushSettings) {
        pushEnabled.value = !pushSettings.disable;
        selectedSound.value = pushSettings.sound || 'default';
      }
    }

    // Load time display preference
    const { value: timeSetting } = await Preferences.get({ key: 'time' });
    timeDisplay.value = timeSetting || 'utc';

    // Load mute duration preference
    const { value: muteTtl } = await Preferences.get({ key: 'muteTtl' });
    muteDuration.value = muteTtl || '3600';
  } catch (error) {
    console.error('Error loading settings:', error);
  } finally {
    isLoading.value = false;
  }
};

const setPushEnabled = async (newValue: boolean) => {
  if (pushEnabled.value === newValue) {
    return;
  }

  pushEnabled.value = newValue;

  if (!Capacitor.isNativePlatform()) {
    const alert = await alertController.create({
      header: 'Not Available',
      message: 'Push notifications are only available on mobile devices.',
      buttons: ['OK'],
    });
    await alert.present();
    pushEnabled.value = false;
    return;
  }

  try {
    // Send the inverse because API expects 'disable' flag (1 = disabled, 0 = enabled)
    await pushService.updatePushSettings(!newValue, selectedSound.value);
  } catch (error) {
    console.error('Error updating push settings:', error);
    // Revert the toggle on error
    pushEnabled.value = !newValue;
    const alert = await alertController.create({
      header: 'Error',
      message: 'Failed to update push notification settings.',
      buttons: ['OK'],
    });
    await alert.present();
  }
};

const onPushItemClick = async () => {
  await setPushEnabled(!pushEnabled.value);
};

const handlePushToggle = async (event: CustomEvent) => {
  await setPushEnabled(event.detail.checked);
};

const setSound = async (newValue: string) => {
  if (selectedSound.value === newValue) {
    return;
  }

  selectedSound.value = newValue;

  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await pushService.updatePushSettings(!pushEnabled.value, newValue);
  } catch (error) {
    console.error('Error updating sound:', error);
  }
};

const setTimeDisplay = async (newValue: string) => {
  if (timeDisplay.value === newValue) {
    return;
  }

  timeDisplay.value = newValue;
  await Preferences.set({ key: 'time', value: newValue });
  window.dispatchEvent(new CustomEvent('time-display-changed'));
};

const setMuteDuration = async (newValue: string) => {
  if (muteDuration.value === newValue) {
    return;
  }

  muteDuration.value = newValue;
  await Preferences.set({ key: 'muteTtl', value: newValue });
};

</script>

<style scoped>
.attribution {
  margin-top: 20px;
}
</style>
