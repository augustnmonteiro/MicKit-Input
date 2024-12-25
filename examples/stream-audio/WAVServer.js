const WebSocket = require('ws');
const wav = require('wav');

// Server configuration
const PORT = 8080;
const FILE_PATH = 'audio_output.wav';

// Create a WebSocket server
const wss = new WebSocket.Server({ port: PORT }, () => {
    console.log(`WebSocket server started on ws://localhost:${PORT}`);
});

// Create a WAV file writer with 16kHz sample rate
const fileWriter = new wav.FileWriter(FILE_PATH, {
    sampleRate: 16000,
    channels: 1,
    bitDepth: 16,
    
});

wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        if (Buffer.isBuffer(message)) {
            console.log('Received binary data');
            try {
              fileWriter.write(message);
            } catch (error) {
              console.error('Error writing to WAV file:', error);
            }
        } else {
            console.log('Received non-binary data');
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        fileWriter.end();
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    fileWriter.end();
    wss.close();
    process.exit();
});