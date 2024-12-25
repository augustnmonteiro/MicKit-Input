import AudioProcessorWorklet from './audio-processor.blob.js';
import { MicInputManagerEvent, MicKitEventCallback, MicrophoneDevice } from './types.js';

export class MicInputManager {
  private audioContext: AudioContext;
  private workletNode!: AudioWorkletNode;
  private gainNode!: GainNode;
  private micSource!: MediaStreamAudioSourceNode;
  private stream!: MediaStream;
  private eventCallbacks: Map<MicInputManagerEvent, Set<MicKitEventCallback>> = new Map();
  private selectedMicId: string | null = null;
  private autoGainEnabled: boolean = true;
  private gainStep: number = 0.1;
  private minGain: number = 0.1;
  private maxGain: number = 2.0;
  private isListening: boolean = false;
  private deviceChangeListenerAdded: boolean = false;
  private defaultGain: number = 1.0;
  private sliceDurationMs: number = 250;
  private processorThresholds = {
    silentThreshold: 0.005,
    tooQuietThreshold: 0.02,
    tooLoudThreshold: 0.7,
    peakThreshold: 0.9,
    clippingPercentage: 0.05,
  };
  private debugEnabled: boolean = false;

  constructor(sliceDurationMs: number = 250, debug: boolean = false) {
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    this.debugEnabled = debug;
    this.sliceDurationMs = sliceDurationMs;
  }

  async listen() {
    if (this.isListening) {
      this.debugLog('Already listening');
      return;
    }
    try {
      await this.initializeAudioEngine();
      const constraints: MediaStreamConstraints = {
        audio: this.selectedMicId ? { deviceId: this.selectedMicId } : true,
      };
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.micSource = this.audioContext.createMediaStreamSource(this.stream);
      this.micSource.connect(this.gainNode);
      this.gainNode.connect(this.workletNode);

      this.stream.getAudioTracks()[0].addEventListener('mute', () => {
        this.emit(MicInputManagerEvent.MIC_MUTED);
      });
      this.stream.getAudioTracks()[0].addEventListener('unmute', () => {
        this.emit(MicInputManagerEvent.MIC_UNMUTED);
      });
      this.stream.getAudioTracks()[0].addEventListener('ended', () => {
        this.emit(MicInputManagerEvent.STREAM_ENDED);
        this.stop();
      });

      this.isListening = true;
      this.emit(MicInputManagerEvent.LISTENING);
      this.debugLog('Microphone started successfully');
    } catch (error) {
      this.handleError(error);
    }
  }

  stop() {
    if (!this.isListening) {
      this.debugLog('Microphone is not active');
      return;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.debugLog('Microphone tracks stopped');
    }
    this.micSource?.disconnect();
    this.gainNode?.disconnect();
    this.workletNode?.disconnect();

    if (this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }

    this.isListening = false;
    this.emit(MicInputManagerEvent.STOPPED);
  }

  on(event: MicInputManagerEvent, callback: MicKitEventCallback): () => void {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }

    if (!this.eventCallbacks.has(event)) {
        this.eventCallbacks.set(event, new Set());
    }

    const callbacks = this.eventCallbacks.get(event)!;
    callbacks.add(callback);

    return () => {
        callbacks.delete(callback);
    };
  }

  setMaxGain(maxGain: number): void {
    this.maxGain = maxGain;
  }

  setMinGain(minGain: number): void {
    this.minGain = minGain;
  }  

  setGain(gain: number): void {
    this.gainNode.gain.value = gain;
  }

  setAutoGain(enabled: boolean): void {
    this.autoGainEnabled = enabled;
  }

  setGainStep(step: number): void {
    if (step <= 0) {
      this.debugLog('Gain step must be a positive number');
      return;
    }
    this.gainStep = step;
    this.debugLog(`Gain step set to: ${step}`);
  }

  setProcessorThresholds(options: {
    silentThreshold?: number;
    tooQuietThreshold?: number;
    tooLoudThreshold?: number;
    peakThreshold?: number;
    clippingPercentage?: number;
  }): void {
    this.processorThresholds = {
      ...this.processorThresholds,
      ...options,
    };
    if (this.workletNode) {
      this.workletNode.port.postMessage({
        type: 'updateThresholds',
        options,
      });
    }
  }

  setSelectedMic(micId: string): void {
    this.selectedMicId = micId;
    this.debugLog(`Selected microphone device ID: ${micId}`);
  }

  setDefaultGain(gain: number): void {
    this.defaultGain = gain;
    if (this.gainNode) {
      this.gainNode.gain.value = gain;
    }
    this.debugLog(`Default gain set to: ${gain}`);
  }

  async getAvailableMicrophones(): Promise<MicrophoneDevice[]> {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();

      const audioInputs = devices.filter((device) => device.kind === 'audioinput');

      return audioInputs.map((mic) => ({
        label: mic.label,
        kind: mic.kind,
        deviceId: mic.deviceId,
        groupId: mic.groupId,
        isDefault: mic.deviceId === 'default',
        isSelected: mic.deviceId === this.selectedMicId,
      }));
    } catch (error) {
      this.debugLog('Error getting available microphones:', error);
      this.handleError(error);
      return [];
    }
  }

  private async initializeAudioEngine() {
    try {
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioContext({ sampleRate: 16000 });
      } else if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
  
      if (!this.workletNode) {
        await this.audioContext.audioWorklet.addModule(AudioProcessorWorklet);
        this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-processor', {
          processorOptions: {
            sliceDurationMs: this.sliceDurationMs,
            ...this.processorThresholds
          },
        });
        this.workletNode.port.onmessage = (event) => this.handleWorkletMessage(event.data);
      }
  
      if (!this.gainNode) {
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = this.defaultGain;
      }
  
      if (!this.deviceChangeListenerAdded) {
        navigator.mediaDevices.addEventListener('devicechange', () => this.handleDeviceChange());
        this.deviceChangeListenerAdded = true;
      }
  
      this.debugLog('Audio worklet initialized successfully');
    } catch (error) {
      this.debugLog('Failed to initialize audio worklet:', error);
      this.handleError(error);
    }
  }

  private emit(event: MicInputManagerEvent, data?: any) {
    const callbacks = this.eventCallbacks.get(event);
    callbacks?.forEach((cb) => cb(data));
  }

  private async handleDeviceChange() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter((device) => device.kind === 'audioinput');
        this.emit(MicInputManagerEvent.MIC_LIST_CHANGED, audioInputs);

        if (audioInputs.length === 0) {
            this.debugLog('No microphones available');
            this.emit(MicInputManagerEvent.MIC_DISCONNECTED, { reason: 'No microphones available' });
            this.stop();
            return;
        }

        const currentMicStillAvailable = this.selectedMicId
            ? audioInputs.some((device) => device.deviceId === this.selectedMicId)
            : audioInputs.some((device) => this.stream?.getAudioTracks()[0]?.getSettings()?.deviceId === device.deviceId);

        if (!currentMicStillAvailable) {
            this.debugLog('Current microphone disconnected');
            this.emit(MicInputManagerEvent.MIC_DISCONNECTED, { reason: 'Currently used microphone was disconnected' });
            this.stop();
        }
    } catch (error) {
        this.debugLog('Error handling device change:', error);
        this.handleError(error);
    }
  }

  private adjustGain(change: number) {
    if (this.autoGainEnabled) {
      this.gainNode.gain.value = Math.max(this.minGain, Math.min(this.maxGain, this.gainNode.gain.value + change));
      this.debugLog(`Adjusting Gain: ${this.gainNode.gain.value}`);
    }
  }  

  private handleWorkletMessage(data: any) {
    switch (data.type) {
      case MicInputManagerEvent.CHUNK:
        this.emit(MicInputManagerEvent.CHUNK, data);
        break;
      case MicInputManagerEvent.TOO_LOUD:
      case MicInputManagerEvent.PEAKS:
        this.adjustGain(-this.gainStep);
        this.emit(data.type, { rms: data.rms });
        break;
      case MicInputManagerEvent.TOO_QUIET:
        this.adjustGain(this.gainStep);
        this.emit(MicInputManagerEvent.TOO_QUIET, { rms: data.rms });
        break;
      case MicInputManagerEvent.SILIENT:
        this.emit(MicInputManagerEvent.SILIENT, { rms: data.rms });
        break;
      case MicInputManagerEvent.CLIPPING:
        this.emit(MicInputManagerEvent.CLIPPING, { rms: data.rms });
        break;
      default:
        this.debugLog('Unhandled audio worklet message:', data);
    }
  }

  private handleError(error: any) {
    this.isListening = false;
    switch (error?.name) {
      case 'NotFoundError':
        this.emit(MicInputManagerEvent.MIC_NOT_FOUND);
        break;
      case 'NotAllowedError':
        this.emit(MicInputManagerEvent.MIC_PERMISSION_DENIED);
        break;
      default:
        this.emit(MicInputManagerEvent.AUDIO_PROCESSING_ERROR, error);
    }
    this.stop();
    this.debugLog('Microphone Error:', error);
  }

  private debugLog(...messages: any[]): void {
    if (this.debugEnabled) {
      console.debug(`[DEBUG] MicAudioInput: `, ...messages);
    }
  }

}