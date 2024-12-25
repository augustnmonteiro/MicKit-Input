class AudioProcessor extends AudioWorkletProcessor {

  constructor(options) {
    super();
    const { 
      sliceDurationMs,
      silentThreshold,
      tooQuietThreshold,
      tooLoudThreshold,
      peakThreshold,
      clippingPercentage
     } = options?.processorOptions ?? {};
    const sliceDuration = sliceDurationMs ?? 200;
    this.sliceDurationMs = Math.max(sliceDuration, 200);
    this.sliceSamplesNeeded = Math.round(sampleRate * (this.sliceDurationMs / 1000));
    this.audioBuffer = [];
    this.thresholds = {
      silentThreshold: silentThreshold ?? 0.005,
      tooQuietThreshold: tooQuietThreshold ?? 0.02,
      tooLoudThreshold: tooLoudThreshold ?? 0.7,
      peakThreshold: peakThreshold ?? 0.9,
      clippingPercentage: clippingPercentage ?? 0.05,
    };
    this.thresholdMessage = {
      SILENT: 0,
      TOO_QUIET: 0,
      TOO_LOUD: 0,
      PEAKS: 0,
      CLIPPING: 0
    }
    this.THRESHOLD_MESSAGE_RESET = 20;
    this.outputSample = new Int16Array(this.sliceSamplesNeeded);
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    if (event.data.type === 'updateThresholds' && event.data.options) {
      this.thresholds = {
        ...this.thresholds,
        ...event.data.options,
      };
      console.log('Processor thresholds updated:', this.thresholds);
    }
  }

  /**
   * Calculate RMS (Root Mean Square) of audio samples
   */
  calculateRMS(samples) {
    const sum = samples.reduce((acc, sample) => acc + sample * sample, 0);
    return Math.sqrt(sum / samples.length);
  }
  /**
   * Check for peaks in the audio samples
   */
  hasPeaks(samples) {
    return samples.some(sample => Math.abs(sample) > this.thresholds.peakThreshold);
  }

  /**
   * Check for clipping in audio samples
   */
  hasClipping(samples) {
    const clippedSamples = samples.filter(sample => Math.abs(sample) === 1.0);
    return (clippedSamples.length / samples.length) > this.thresholds.clippingPercentage;
  }

  checkThreshold(condition, type, data) {
    if (condition) {
      this.thresholdMessage[type]++;
      if (this.thresholdMessage[type] >= this.THRESHOLD_MESSAGE_RESET) {
        this.port.postMessage({ type, ...data });
        this.thresholdMessage[type] = 0;
      }
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];

    if (!input || input.length === 0 || !input[0] || input[0].length === 0) {
      return true;
    }

    this.audioBuffer.push(...input[0]);

    while (this.audioBuffer.length >= this.sliceSamplesNeeded) {
      const audioSamples = new Float32Array(this.audioBuffer.splice(0, this.sliceSamplesNeeded));

      // Calculate RMS
      const rms = this.calculateRMS(audioSamples);

      this.checkThreshold(rms < this.thresholds.silentThreshold, 'SILENT', { rms });
      this.checkThreshold(rms < this.thresholds.tooQuietThreshold, 'TOO_QUIET', { rms });
      this.checkThreshold(rms > this.thresholds.tooLoudThreshold, 'TOO_LOUD', { rms });
      this.checkThreshold(this.hasPeaks(audioSamples), 'PEAKS', { rms });
      this.checkThreshold(this.hasClipping(audioSamples), 'CLIPPING', { rms });

      // Convert to Int16 and send as a chunk
      for (let i = 0; i < audioSamples.length; i++) {
        this.outputSample[i] = Math.max(-1, Math.min(1, audioSamples[i])) * 0x7FFF;
      }

      this.port.postMessage({
        type: 'CHUNK',
        data: this.outputSample,
        rms
      });
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);