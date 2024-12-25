export enum MicInputManagerEvent {
  MIC_DISCONNECTED = 'MIC_DISCONNECTED',
  MIC_NOT_FOUND = 'MIC_NOT_FOUND',
  MIC_PERMISSION_DENIED = 'MIC_PERMISSION_DENIED',
  MIC_MUTED = 'MIC_MUTED',
  MIC_UNMUTED = 'MIC_UNMUTED',
  MIC_LIST_CHANGED = 'MIC_LIST_CHANGED',
  PEAKS = 'PEAKS',
  TOO_LOUD = 'TOO_LOUD',
  TOO_QUIET = 'TOO_QUIET',
  SILIENT = 'SILIENT',
  CLIPPING = 'CLIPPING',
  CHUNK = 'CHUNK',
  STREAM_ENDED = 'STREAM_ENDED',
  AUDIO_PROCESSING_ERROR = 'AUDIO_PROCESSING_ERROR',
  LISTENING = 'LISTENING',
  STOPPED = 'STOPPED',
}

export type MicKitEventCallback = (data?: any) => void;

export type MicrophoneDevice = { 
  label: string,
  kind: string,
  deviceId: string,
  groupId: string,
  isDefault: boolean,
  isSelected: boolean
};