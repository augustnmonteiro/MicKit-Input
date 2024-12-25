# @mickit/input

## 📚 **Overview**
`@mickit/input` is a simple and lightweight library for capturing audio input from the microphone.
It provides a simple API to listen to audio chunks, detect silence, and adjust the gain automatically.

The Audio Chunk is encoded is a simple .
- Audio Chunk: `Int16Array` (PCM 16-bit signed integer)

## 🚀 **Installation**
To install MicInputManager, use npm or yarn:

```sh
npm install @mickit/input
```

or

```sh
yarn add @mickit/input
```

## 🛠️ **Setup and Initialization**

### **Basic Usage Example**
```typescript
import { MicInputManager, MicInputManagerEvent } from '@mickit/input';

const micManager = new MicInputManager(250, true);

// Start listening to microphone
micManager.listen();

// Event listeners
micManager.on(MicInputManagerEvent.LISTENING, () => {
  console.log('Microphone is listening');
});

micManager.on(MicInputManagerEvent.STOPPED, () => {
  console.log('Microphone has stopped');
});

micManager.on(MicInputManagerEvent.MIC_MUTED, () => {
  console.log('Microphone muted');
});

micManager.on(MicInputManagerEvent.CHUNK, (event) => {
  // event.data is a Int16Array
  console.log('Audio chunk:', event.data);
});

```

## 🎧 **API Reference**

### **Constructor**
```typescript
constructor(silenceDurationMs?: number, debug?: boolean)
```
- `sliceDurationMs`: Duration of audio chunks in milliseconds (default: `250`).
- `debug`: Enable debug logs (default: `false`).

### **Methods**

#### **listen()**
Starts listening to the microphone input.
```typescript
micManager.listen();
```

#### **stop()**
Stops the microphone input.
```typescript
micManager.stop();
```

#### **on(event: MicInputManagerEvent, callback: MicKitEventCallback)**
Adds an event listener.
```typescript
micManager.on(MicInputManagerEvent.LISTENING, () => console.log('Listening'));
```

#### **setMaxGain(maxGain: number)**
Sets the maximum gain value.
```typescript
micManager.setMaxGain(2.0);
```

#### **setMinGain(minGain: number)**
Sets the minimum gain value.
```typescript
micManager.setMinGain(0.1);
```

#### **setGain(gain: number)**
Manually sets the gain. (if auto gain is enabled this will be changed automatically)
If you want to set the gain manually, you should disable auto gain.
```typescript
micManager.setGain(1.0);
```

#### **setAutoGain(enabled: boolean)**
Enables or disables automatic gain adjustment.
```typescript
micManager.setAutoGain(true);
```

#### **setDefaultGain(gain: number)**
Sets the default gain value.
```typescript
micManager.setDefaultGain(1.0);
```

#### **setSelectedMic(deviceId: string)**
Sets the microphone device to use.
```typescript
micManager.setSelectedMic('default');
```

#### **getAvailableMicrophones()**
Fetches available microphone devices.
Returns a promise with an array of `MicrophoneDevice`.
```typescript
const mics = await micManager.getAvailableMicrophones();
console.log(mics);
```

#### **setProcessorThresholds(thresholds: ProcessorThresholds)**
Sets the processor thresholds.
```typescript
micManager.setProcessorThresholds({
  silentThreshold: 0.01,
  tooQuietThreshold: 0.1,
  tooLoudThreshold: 0.9,
  peakThreshold: 0.9,
  clippingPercentage: 0.1, // 10%
});
```

## 📊 **Events**

| **Event**               | **Description** | hasRMS |
|--------------------------|-----------------|-------------|
| `LISTENING`             | Microphone has started listening. | false |
| `STOPPED`               | Microphone has stopped. | false |
| `MIC_MUTED`             | Microphone was muted. | false |
| `MIC_UNMUTED`           | Microphone was unmuted. | false |
| `MIC_NOT_FOUND`         | No microphone was found. | false |
| `MIC_PERMISSION_DENIED` | Microphone access was denied. | false |
| `MIC_DISCONNECTED`      | Currently used microphone was disconnected. | false |
| `MIC_LIST_CHANGED`      | List of available microphones changed. | false |
| `STREAM_ENDED`          | Audio stream has ended. | false |
| `CHUNK`                | Audio chunk data is available. | true |
| `TOO_LOUD`             | Audio input is too loud. | true |
| `TOO_QUIET`            | Audio input is too quiet. | true |
| `SILIENT`              | Silence detected. | true |
| `PEAKS`                | Audio peaks detected. | true |
| `CLIPPING`             | Audio clipping detected. | true |
| `AUDIO_PROCESSING_ERROR` | Error during audio processing. | false |

RMS: Root Mean Square
Some events have RMS data available in the event object.
It can be accessed using `event.rms`.
The RMS value is a number between 0 and 1. It represents the volume level of the audio input.

## 🐞 **Debugging**
Enable debug mode
```typescript
const micManager = new MicInputManager(250, true);
```
Debug logs will appear in the console prefixed with `[DEBUG]`.

## Future Improvements
- [ ] Other sample rates (Currently fixed at 16000 Hz)
- [ ] Other Audio encodings (Currently fixed at PCM 16-bit signed integer)
- [ ] VAD (Voice Activity Detection)
- [ ] Audio Processing (Noise Reduction, Echo Cancellation, etc.)
- [ ] Noise Level Detection

## 📄 **License**
This project is licensed under the MIT License.

## 🤝 **Contributing**
Contributions are welcome! Please open an issue or submit a pull request.