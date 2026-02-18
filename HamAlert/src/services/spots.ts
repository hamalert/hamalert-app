// Spots service for HamAlert
import { Preferences } from '@capacitor/preferences';
import { apiService } from './api';
import type { Spot, SpotsResponse, SpotFilter } from '@/types/spot';

class SpotsService {
  private maxSpots = 100;
  private maxAge = 86400; // 24 hours in seconds
  private seenSpotIds: string[] = [];

  async getSpots(filter?: SpotFilter): Promise<SpotsResponse> {
    const limit = filter?.limit || this.maxSpots;
    const maxAge = filter?.maxAge || this.maxAge;
    
    try {
      const response = await apiService.get<SpotsResponse>('/api/spots2', {
        limit,
        maxAge,
      });
      
      // Cache the spots
      if (response.spots.length > 0) {
        await this.cacheSpots(response.spots);
      }
      
      return response;
    } catch (error) {
      console.error('Error fetching spots:', error);
      // Try to load from cache
      const cachedSpots = await this.getCachedSpots();
      if (cachedSpots) {
        return {
          spots: cachedSpots,
          hasAnyAppTrigger: true,
        };
      }
      throw error;
    }
  }

  async deleteSpot(id: string): Promise<void> {
    await apiService.post('/api/deleteSpot', { id });
    
    // Update cached spots to remove the deleted spot
    const cachedSpots = await this.getCachedSpots();
    if (cachedSpots) {
      const updatedSpots = cachedSpots.filter(spot => spot._id !== id);
      await this.cacheSpots(updatedSpots);
    }
  }

  async deleteAllSpots(): Promise<void> {
    await apiService.post('/api/deleteSpot', { id: '*' });
    
    // Clear cached spots
    await this.cacheSpots([]);
  }

  private async cacheSpots(spots: Spot[]): Promise<void> {
    try {
      await Preferences.set({ key: 'cachedSpots', value: JSON.stringify(spots) });
    } catch (error) {
      console.error('Error caching spots:', error);
    }
  }

  async getCachedSpots(): Promise<Spot[] | null> {
    try {
      const { value: cachedSpotsStr } = await Preferences.get({ key: 'cachedSpots' });
      if (cachedSpotsStr) {
        return JSON.parse(cachedSpotsStr);
      }
    } catch (error) {
      console.error('Error loading cached spots:', error);
    }
    return null;
  }

  markSpotAsSeen(spotId: string): void {
    if (!this.seenSpotIds.includes(spotId)) {
      this.seenSpotIds.push(spotId);
    }
  }

  markAllSpotsAsSeen(spots: Spot[]): void {
    this.seenSpotIds = spots.map(spot => spot._id);
  }

  isSpotSeen(spotId: string): boolean {
    return this.seenSpotIds.includes(spotId);
  }

  formatFrequency(frequency: number): string {
    return frequency.toFixed(6).replace(/^(\d+\.\d{3,}?)0+$/, '$1');
  }

  async formatTime(timeUtc: string): Promise<string> {
    const { value: timeSetting } = await Preferences.get({ key: 'time' });
    if (timeSetting === 'local') {
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
  }

  getSpotTitle(spot: Spot): { callsign: string; location?: string; frequency: string; mode?: string } {
    let location: string | undefined;
    
    if (spot.summitRef) {
      location = `on ${spot.summitRef}`;
    } else if (spot.wwffRef) {
      location = `in ${spot.wwffRef}`;
    } else if (spot.iotaGroupRef) {
      location = `on ${spot.iotaGroupRef}`;
    }
    
    const mode = spot.modeDetail?.toUpperCase() || spot.mode?.toUpperCase();
    
    return {
      callsign: spot.fullCallsign,
      location,
      frequency: this.formatFrequency(spot.frequency),
      mode
    };
  }

  getSpotSubtitle(spot: Spot): string {
    if (spot.source === 'sotawatch' && spot.summitName) {
      let subtitle = `${spot.summitName}, ${spot.summitHeight}m, ${spot.summitPoints}pt`;
      if (spot.comment && spot.comment !== '(null)') {
        subtitle += `: ${spot.comment}`;
      }
      return subtitle;
    } else if ((spot.source === 'pota' || spot.source === 'wwff') && spot.wwffName) {
      let subtitle = spot.wwffName;
      if (spot.comment && spot.comment !== '(null)') {
        subtitle += `: ${spot.comment}`;
      }
      return subtitle;
    } else if (spot.rawText) {
      return spot.rawText;
    }
    return '';
  }

  getSpotTag(spot: Spot): string {
    if (spot.summitRef) return 'sota';
    if (spot.wwffRef) return spot.wwffProgram || 'wwff';
    if (spot.iotaGroupRef) return 'iota';
    if (spot.source === 'sotawatch') return 'sota';
    if (spot.source === 'cluster') return 'dx';
    if (spot.source === 'pskreporter') return 'pskr';
    return spot.source;
  }
}

export const spotsService = new SpotsService();
export default spotsService;
