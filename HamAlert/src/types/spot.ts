// Types for HamAlert spots

export interface Spot {
  _id: string;
  fullCallsign: string;
  callsign: string;
  frequency: number;
  band?: string;
  mode?: string;
  modeDetail?: string;
  modeIsGuessed?: boolean;
  time: string;
  receivedDate: string;
  source: string;
  spotter?: string;
  rawText?: string;
  comment?: string;
  
  // SOTA fields
  summitRef?: string;
  summitName?: string;
  summitHeight?: number;
  summitPoints?: number;
  
  // WWFF/POTA fields
  wwffRef?: string;
  wwffName?: string;
  wwffProgram?: string;
  
  // IOTA fields
  iotaGroupRef?: string;
  iotaGroupName?: string;
  
  // DXCC fields
  dxcc?: {
    dxcc: number;
    country: string;
    cq: number;
  };
  cq?: number;
  
  // State
  state?: string;
  
  // QSL
  qsl?: string | string[];
  
  // Trigger information
  triggerComments?: string[];
}

export interface SpotsResponse {
  spots: Spot[];
  hasAnyAppTrigger: boolean;
}

export interface SpotFilter {
  limit?: number;
  maxAge?: number;
}
