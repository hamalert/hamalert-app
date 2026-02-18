<template>
  <ion-list v-if="spots.length > 0">
    <ion-item-sliding v-for="spot in spots" :key="spot._id">
      <ion-item 
        @click="handleToggleDetails(spot._id)"
        :class="{ 'spot-new': !isSpotSeen(spot._id) }"
      >
        <div slot="start" class="spot-time">
          <div>{{ formatTime(spot.time) }}</div>
          <ion-badge :class="'spot-tag-' + getSpotTag(spot)">
            {{ getSpotTag(spot).toUpperCase() }}
          </ion-badge>
        </div>
        <ion-label>
          <template v-for="title in [getSpotTitle(spot)]" :key="spot._id">
            <strong>{{ title.callsign }}</strong>{{ title.location ? ' ' + title.location : '' }} ({{ title.frequency }}{{ title.mode ? ' ' + title.mode : '' }})
          </template>
          <p>{{ getSpotSubtitle(spot) }}</p>
          
          <!-- Spot details (expandable) -->
          <transition name="spot-expand">
            <div v-if="openSpotIds.has(spot._id)" class="spot-details">
              <ion-grid>
              <ion-row class="detail-row">
                <ion-col size="4" class="detail-label">Callsign</ion-col>
                <ion-col size="8" class="detail-value">
                  <a :href="`https://www.qrz.com/db/${spot.callsign}`" target="_blank" @click.stop>
                    {{ spot.fullCallsign }}
                  </a>
                </ion-col>
              </ion-row>
              <ion-row v-if="spot.summitRef" class="detail-row">
                <ion-col size="4" class="detail-label">Summit</ion-col>
                <ion-col size="8" class="detail-value">
                  <a :href="`https://sotl.as/summits/${spot.summitRef}`" target="_blank" @click.stop>
                    {{ spot.summitRef }}
                    <span v-if="spot.summitName">
                      ({{ spot.summitName }}, {{ spot.summitHeight }}m, {{ spot.summitPoints }}pt)
                    </span>
                  </a>
                </ion-col>
              </ion-row>
              <ion-row v-if="spot.wwffRef" class="detail-row">
                <ion-col size="4" class="detail-label">{{ (spot.wwffProgram || 'wwff').toUpperCase() }}</ion-col>
                <ion-col size="8" class="detail-value">
                  <a v-if="spot.wwffProgram === 'pota'" 
                     :href="`https://pota.app/#/park/${spot.wwffRef}`" 
                     target="_blank" 
                     @click.stop>
                    {{ spot.wwffRef }}
                    <span v-if="spot.wwffName">({{ spot.wwffName }})</span>
                  </a>
                  <a v-else-if="spot.wwffProgram === 'wwff'" 
                     :href="`https://wwff.co/directory/?showRef=${spot.wwffRef}`" 
                     target="_blank" 
                     @click.stop>
                    {{ spot.wwffRef }}
                    <span v-if="spot.wwffName">({{ spot.wwffName }})</span>
                  </a>
                  <span v-else>
                    {{ spot.wwffRef }}
                    <span v-if="spot.wwffName">({{ spot.wwffName }})</span>
                  </span>
                </ion-col>
              </ion-row>
              <ion-row v-if="spot.iotaGroupRef" class="detail-row">
                <ion-col size="4" class="detail-label">IOTA</ion-col>
                <ion-col size="8" class="detail-value">
                  {{ spot.iotaGroupRef }}
                  <span v-if="spot.iotaGroupName">({{ spot.iotaGroupName }})</span>
                </ion-col>
              </ion-row>
              <ion-row v-if="spot.band" class="detail-row">
                <ion-col size="4" class="detail-label">Band</ion-col>
                <ion-col size="8" class="detail-value">{{ spot.band }}</ion-col>
              </ion-row>
              <ion-row class="detail-row">
                <ion-col size="4" class="detail-label">Frequency</ion-col>
                <ion-col size="8" class="detail-value">{{ formatFrequency(spot.frequency) }}</ion-col>
              </ion-row>
              <ion-row v-if="spot.mode || spot.modeDetail" class="detail-row">
                <ion-col size="4" class="detail-label">Mode</ion-col>
                <ion-col size="8" class="detail-value">
                  {{ (spot.modeDetail || spot.mode || '').toUpperCase() }}
                  <span v-if="spot.modeIsGuessed"> (guessed)</span>
                </ion-col>
              </ion-row>
              <ion-row v-if="spot.dxcc" class="detail-row">
                <ion-col size="4" class="detail-label">DXCC</ion-col>
                <ion-col size="8" class="detail-value">{{ spot.dxcc.dxcc }} ({{ spot.dxcc.country }})</ion-col>
              </ion-row>
              <ion-row v-if="spot.dxcc" class="detail-row">
                <ion-col size="4" class="detail-label">CQ Zone</ion-col>
                <ion-col size="8" class="detail-value">{{ spot.dxcc.cq }}</ion-col>
              </ion-row>
              <ion-row v-if="spot.spotter" class="detail-row">
                <ion-col size="4" class="detail-label">Spotter</ion-col>
                <ion-col size="8" class="detail-value">{{ spot.spotter }}</ion-col>
              </ion-row>
              <ion-row v-if="spot.triggerComments && spot.triggerComments.length > 0" class="detail-row">
                <ion-col size="4" class="detail-label">Trigger(s)</ion-col>
                <ion-col size="8" class="detail-value">
                  <div class="triggers-list">
                    <div v-for="(trigger, index) in spot.triggerComments" :key="index">
                      {{ trigger }}
                    </div>
                  </div>
                </ion-col>
              </ion-row>
              <ion-row v-if="spot.qsl" class="detail-row">
                <ion-col size="4" class="detail-label">QSL</ion-col>
                <ion-col size="8" class="detail-value">{{ formatQsl(spot.qsl) }}</ion-col>
              </ion-row>
              <ion-row v-if="spot.state" class="detail-row">
                <ion-col size="4" class="detail-label">State</ion-col>
                <ion-col size="8" class="detail-value">{{ formatState(spot.state) }}</ion-col>
              </ion-row>
            </ion-grid>
          </div>
          </transition>
        </ion-label>
      </ion-item>
      <ion-item-options side="end">
        <ion-item-option color="danger" @click="handleDelete(spot._id)">
          <ion-icon slot="icon-only" :icon="trashOutline"></ion-icon>
        </ion-item-option>
      </ion-item-options>
    </ion-item-sliding>
  </ion-list>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  IonList,
  IonItem,
  IonItemSliding,
  IonItemOptions,
  IonItemOption,
  IonLabel,
  IonIcon,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
} from '@ionic/vue';
import { trashOutline } from 'ionicons/icons';
import { spotsService } from '@/services/spots';
import type { Spot } from '@/types/spot';
import { Preferences } from '@capacitor/preferences';

interface Props {
  spots: Spot[];
}

interface Emits {
  (event: 'delete', spotId: string): void;
  (event: 'toggleDetails', spotId: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const openSpotIds = ref(new Set<string>());
const timeSetting = ref<string>('utc');

onMounted(async () => {
  // Load time display preference
  const { value } = await Preferences.get({ key: 'time' });
  timeSetting.value = value || 'utc';
  
  // Listen for time display changes
  window.addEventListener('time-display-changed', handleTimeDisplayChange);
});

onUnmounted(() => {
  window.removeEventListener('time-display-changed', handleTimeDisplayChange);
});

const handleTimeDisplayChange = async () => {
  const { value } = await Preferences.get({ key: 'time' });
  timeSetting.value = value || 'utc';
};

const handleToggleDetails = (spotId: string) => {
  if (openSpotIds.value.has(spotId)) {
    openSpotIds.value.delete(spotId);
  } else {
    openSpotIds.value.add(spotId);
    spotsService.markSpotAsSeen(spotId);
  }
  emit('toggleDetails', spotId);
};

const handleDelete = (spotId: string) => {
  emit('delete', spotId);
};

const isSpotSeen = (spotId: string): boolean => {
  return spotsService.isSpotSeen(spotId);
};

const getSpotTitle = (spot: Spot): { callsign: string; location?: string; frequency: string; mode?: string } => {
  return spotsService.getSpotTitle(spot);
};

const getSpotSubtitle = (spot: Spot): string => {
  return spotsService.getSpotSubtitle(spot);
};

const getSpotTag = (spot: Spot): string => {
  return spotsService.getSpotTag(spot);
};

const formatTime = (timeUtc: string): string => {
  if (timeSetting.value === 'local') {
    // Convert UTC time to local time
    const [hours, minutes] = timeUtc.split(':');
    const date = new Date();
    date.setUTCHours(parseInt(hours), parseInt(minutes), 0, 0);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  }
  return timeUtc + 'z';
};

const formatFrequency = (frequency: number): string => {
  return spotsService.formatFrequency(frequency);
};

const formatState = (state: string): string => {
  const parts = state.split('_');
  return parts.length > 1 ? parts[1] : state;
};

const formatQsl = (qsl: string | string[]): string => {
  const qslMethods: Record<string, string> = {
    lotw: 'LoTW',
    eqsl: 'eQSL AG'
  };
  
  const qslArray = Array.isArray(qsl) ? qsl : [qsl];
  return qslArray.map(method => qslMethods[method.toLowerCase()] || method).join(', ');
};
</script>

<style scoped>
.spot-time {
  text-align: center;
  padding-right: 10px;
  align-self: flex-start;
  margin-top: 12px;
  width: 60px;
}

.spot-time div {
  font-size: 0.9rem;
  margin-bottom: 4px;
}

ion-label {
  align-self: flex-start;
  margin-top: 10px;
}

.spot-new {
  --background: #f0faff;
  font-weight: 500;
}

@media screen and (prefers-color-scheme: dark) {
  .spot-new {
    --background: #1a2b3c;
  }
}

.spot-details {
  margin-top: 12px;
  padding-top: 0;
}

/* Transition animations for spot details */
.spot-expand-enter-active {
  animation: spot-expand-in 0.25s ease-out;
}

.spot-expand-leave-active {
  animation: spot-expand-out 0.25s ease-in;
}

@keyframes spot-expand-in {
  0% {
    opacity: 0;
    max-height: 0;
  }
  100% {
    opacity: 1;
    max-height: 1000px;
  }
}

@keyframes spot-expand-out {
  0% {
    opacity: 1;
    max-height: 1000px;
  }
  100% {
    opacity: 0;
    max-height: 0;
  }
}

.spot-details ion-grid {
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
  background: #f7f7f7;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e7e7e7;
}

@media (prefers-color-scheme: dark) {
  .spot-details ion-grid {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid #777;
  }
}

.spot-details .detail-row {
  margin: 0;
  padding: 0;
  border-bottom: 1px solid #e7e7e7;
}

@media (prefers-color-scheme: dark) {
  .spot-details .detail-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.spot-details .detail-row:last-child {
  border-bottom: none;
}

@media (prefers-color-scheme: dark) {
  .spot-details .detail-row {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
}

.spot-details .detail-label {
  padding: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ion-color-medium);
  border-right: 1px solid var(--ion-color-step-150);
  display: flex;
  align-items: center;
}

@media (prefers-color-scheme: dark) {
  .spot-details .detail-label {
    background: rgba(255, 255, 255, 0.08);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    color: var(--ion-color-medium-tint);
  }
}

.spot-details .detail-value {
  padding: 6px;
  font-size: 0.9rem;
  display: flex;
  align-items: center;
  word-break: break-word;
  background: #fff;
}

@media (prefers-color-scheme: dark) {
  .spot-details .detail-value {
    background: rgba(255, 255, 255, 0.05);
  }
}

.spot-details a {
  color: var(--ion-color-primary);
  text-decoration: none;
  font-weight: 500;
  transition: opacity 0.2s ease;
}

.spot-details a:active {
  opacity: 0.7;
}

ion-badge {
  font-size: 0.7rem;
  padding: 4px 6px;
  border-radius: 12px;
  font-weight: bold;
  color: white;
}

/* Spot tag colors from old app */
ion-badge.spot-tag-sota {
  --background: #9E1F18;
}

ion-badge.spot-tag-rbn {
  --background: #669217;
}

ion-badge.spot-tag-dx {
  --background: #105960;
}

ion-badge.spot-tag-wwff,
ion-badge.spot-tag-pota {
  --background: #724b25;
}

ion-badge.spot-tag-pskr {
  --background: #fffd38;
  color: #000;
}

ion-badge.spot-tag-iota {
  --background: #e2940d;
}

/* Default color for unknown types */
ion-badge[class*='spot-tag-']:not(.spot-tag-sota):not(.spot-tag-rbn):not(.spot-tag-dx):not(.spot-tag-wwff):not(.spot-tag-pota):not(.spot-tag-pskr):not(.spot-tag-iota) {
  --background: #999999;
}

ion-label {

/* Triggers list vertical layout */
.triggers-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}
  font-size: 0.6rem;
}
</style>
