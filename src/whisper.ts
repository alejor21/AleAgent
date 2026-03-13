import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { config } from './config.js';

/**
 * Transcribe un archivo de audio local usando Groq (Whisper-large-v3-turbo)
 */
export async function transcribeAudio(filePath: string): Promise<string> {
    try {
        const form = new FormData();
        form.append('file', fs.createReadStream(filePath));
        form.append('model', 'whisper-large-v3-turbo');
        form.append('language', 'es'); // Opcional, fuerza el español

        const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
            headers: {
                ...form.getHeaders(),
                'Authorization': `Bearer ${config.groqApiKey}`,
            },
        });

        return response.data.text;
    } catch (error: any) {
        console.error("Error en Groq Whisper API:", error?.response?.data || error.message);
        throw new Error("No pude transcribir el audio, el servicio falló.");
    }
}
