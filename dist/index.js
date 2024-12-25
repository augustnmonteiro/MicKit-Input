const blob = new Blob(["class AudioProcessor extends AudioWorkletProcessor {\n\n  constructor(options) {\n    super();\n    const { \n      sliceDurationMs,\n      silentThreshold,\n      tooQuietThreshold,\n      tooLoudThreshold,\n      peakThreshold,\n      clippingPercentage\n     } = options?.processorOptions ?? {};\n    const sliceDuration = sliceDurationMs ?? 200;\n    this.sliceDurationMs = Math.max(sliceDuration, 200);\n    this.sliceSamplesNeeded = Math.round(sampleRate * (this.sliceDurationMs / 1000));\n    this.audioBuffer = [];\n    this.thresholds = {\n      silentThreshold: silentThreshold ?? 0.005,\n      tooQuietThreshold: tooQuietThreshold ?? 0.02,\n      tooLoudThreshold: tooLoudThreshold ?? 0.7,\n      peakThreshold: peakThreshold ?? 0.9,\n      clippingPercentage: clippingPercentage ?? 0.05,\n    };\n    this.thresholdMessage = {\n      SILENT: 0,\n      TOO_QUIET: 0,\n      TOO_LOUD: 0,\n      PEAKS: 0,\n      CLIPPING: 0\n    }\n    this.THRESHOLD_MESSAGE_RESET = 20;\n    this.outputSample = new Int16Array(this.sliceSamplesNeeded);\n    this.port.onmessage = this.handleMessage.bind(this);\n  }\n\n  handleMessage(event) {\n    if (event.data.type === 'updateThresholds' && event.data.options) {\n      this.thresholds = {\n        ...this.thresholds,\n        ...event.data.options,\n      };\n      console.log('Processor thresholds updated:', this.thresholds);\n    }\n  }\n\n  /**\n   * Calculate RMS (Root Mean Square) of audio samples\n   */\n  calculateRMS(samples) {\n    const sum = samples.reduce((acc, sample) => acc + sample * sample, 0);\n    return Math.sqrt(sum / samples.length);\n  }\n  /**\n   * Check for peaks in the audio samples\n   */\n  hasPeaks(samples) {\n    return samples.some(sample => Math.abs(sample) > this.thresholds.peakThreshold);\n  }\n\n  /**\n   * Check for clipping in audio samples\n   */\n  hasClipping(samples) {\n    const clippedSamples = samples.filter(sample => Math.abs(sample) === 1.0);\n    return (clippedSamples.length / samples.length) > this.thresholds.clippingPercentage;\n  }\n\n  checkThreshold(condition, type, data) {\n    if (condition) {\n      this.thresholdMessage[type]++;\n      if (this.thresholdMessage[type] >= this.THRESHOLD_MESSAGE_RESET) {\n        this.port.postMessage({ type, ...data });\n        this.thresholdMessage[type] = 0;\n      }\n    }\n  }\n\n  process(inputs, outputs, parameters) {\n    const input = inputs[0];\n\n    if (!input || input.length === 0 || !input[0] || input[0].length === 0) {\n      return true;\n    }\n\n    this.audioBuffer.push(...input[0]);\n\n    while (this.audioBuffer.length >= this.sliceSamplesNeeded) {\n      const audioSamples = new Float32Array(this.audioBuffer.splice(0, this.sliceSamplesNeeded));\n\n      // Calculate RMS\n      const rms = this.calculateRMS(audioSamples);\n\n      this.checkThreshold(rms < this.thresholds.silentThreshold, 'SILENT', { rms });\n      this.checkThreshold(rms < this.thresholds.tooQuietThreshold, 'TOO_QUIET', { rms });\n      this.checkThreshold(rms > this.thresholds.tooLoudThreshold, 'TOO_LOUD', { rms });\n      this.checkThreshold(this.hasPeaks(audioSamples), 'PEAKS', { rms });\n      this.checkThreshold(this.hasClipping(audioSamples), 'CLIPPING', { rms });\n\n      // Convert to Int16 and send as a chunk\n      for (let i = 0; i < audioSamples.length; i++) {\n        this.outputSample[i] = Math.max(-1, Math.min(1, audioSamples[i])) * 0x7FFF;\n      }\n\n      this.port.postMessage({\n        type: 'CHUNK',\n        data: this.outputSample,\n        rms\n      });\n    }\n\n    return true;\n  }\n}\n\nregisterProcessor('audio-processor', AudioProcessor);"], { type: 'application/javascript' });
        var AudioProcessorWorklet = URL.createObjectURL(blob);

var MicInputManagerEvent;
(function (MicInputManagerEvent) {
    MicInputManagerEvent["MIC_DISCONNECTED"] = "MIC_DISCONNECTED";
    MicInputManagerEvent["MIC_NOT_FOUND"] = "MIC_NOT_FOUND";
    MicInputManagerEvent["MIC_PERMISSION_DENIED"] = "MIC_PERMISSION_DENIED";
    MicInputManagerEvent["MIC_MUTED"] = "MIC_MUTED";
    MicInputManagerEvent["MIC_UNMUTED"] = "MIC_UNMUTED";
    MicInputManagerEvent["MIC_LIST_CHANGED"] = "MIC_LIST_CHANGED";
    MicInputManagerEvent["PEAKS"] = "PEAKS";
    MicInputManagerEvent["TOO_LOUD"] = "TOO_LOUD";
    MicInputManagerEvent["TOO_QUIET"] = "TOO_QUIET";
    MicInputManagerEvent["SILIENT"] = "SILIENT";
    MicInputManagerEvent["CLIPPING"] = "CLIPPING";
    MicInputManagerEvent["CHUNK"] = "CHUNK";
    MicInputManagerEvent["STREAM_ENDED"] = "STREAM_ENDED";
    MicInputManagerEvent["AUDIO_PROCESSING_ERROR"] = "AUDIO_PROCESSING_ERROR";
    MicInputManagerEvent["LISTENING"] = "LISTENING";
    MicInputManagerEvent["STOPPED"] = "STOPPED";
})(MicInputManagerEvent || (MicInputManagerEvent = {}));

class MicInputManager {
    constructor(sliceDurationMs = 250, debug = false) {
        this.eventCallbacks = new Map();
        this.selectedMicId = null;
        this.autoGainEnabled = true;
        this.gainStep = 0.1;
        this.minGain = 0.1;
        this.maxGain = 2.0;
        this.isListening = false;
        this.deviceChangeListenerAdded = false;
        this.defaultGain = 1.0;
        this.sliceDurationMs = 250;
        this.processorThresholds = {
            silentThreshold: 0.005,
            tooQuietThreshold: 0.02,
            tooLoudThreshold: 0.7,
            peakThreshold: 0.9,
            clippingPercentage: 0.05,
        };
        this.debugEnabled = false;
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
            const constraints = {
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
        }
        catch (error) {
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
    on(event, callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        if (!this.eventCallbacks.has(event)) {
            this.eventCallbacks.set(event, new Set());
        }
        const callbacks = this.eventCallbacks.get(event);
        callbacks.add(callback);
        return () => {
            callbacks.delete(callback);
        };
    }
    setMaxGain(maxGain) {
        this.maxGain = maxGain;
    }
    setMinGain(minGain) {
        this.minGain = minGain;
    }
    setGain(gain) {
        this.gainNode.gain.value = gain;
    }
    setAutoGain(enabled) {
        this.autoGainEnabled = enabled;
    }
    setGainStep(step) {
        if (step <= 0) {
            this.debugLog('Gain step must be a positive number');
            return;
        }
        this.gainStep = step;
        this.debugLog(`Gain step set to: ${step}`);
    }
    setProcessorThresholds(options) {
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
    setSelectedMic(micId) {
        this.selectedMicId = micId;
        this.debugLog(`Selected microphone device ID: ${micId}`);
    }
    setDefaultGain(gain) {
        this.defaultGain = gain;
        if (this.gainNode) {
            this.gainNode.gain.value = gain;
        }
        this.debugLog(`Default gain set to: ${gain}`);
    }
    async getAvailableMicrophones() {
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
        }
        catch (error) {
            this.debugLog('Error getting available microphones:', error);
            this.handleError(error);
            return [];
        }
    }
    async initializeAudioEngine() {
        try {
            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new AudioContext({ sampleRate: 16000 });
            }
            else if (this.audioContext.state === 'suspended') {
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
        }
        catch (error) {
            this.debugLog('Failed to initialize audio worklet:', error);
            this.handleError(error);
        }
    }
    emit(event, data) {
        const callbacks = this.eventCallbacks.get(event);
        callbacks?.forEach((cb) => cb(data));
    }
    async handleDeviceChange() {
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
        }
        catch (error) {
            this.debugLog('Error handling device change:', error);
            this.handleError(error);
        }
    }
    adjustGain(change) {
        if (this.autoGainEnabled) {
            this.gainNode.gain.value = Math.max(this.minGain, Math.min(this.maxGain, this.gainNode.gain.value + change));
            this.debugLog(`Adjusting Gain: ${this.gainNode.gain.value}`);
        }
    }
    handleWorkletMessage(data) {
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
    handleError(error) {
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
    debugLog(...messages) {
        if (this.debugEnabled) {
            console.debug(`[DEBUG] MicAudioInput: `, ...messages);
        }
    }
}

export { MicInputManager };
//# sourceMappingURL=index.js.map
