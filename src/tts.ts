import { Communicate } from 'edge-tts-universal';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Genera un archivo de audio a partir de texto usando Microsoft Edge TTS (Gratuito)
 */
export async function textToSpeech(text: string): Promise<string> {
    try {
        const voice = 'es-ES-AlvaroNeural'; 
        
        // Limpieza rápida para acelerar el TTS
        const cleanText = text
            .replace(/[*_#]/g, '') // Quitar Markdown
            .replace(/[^\w\s.,?!áéíóúÁÉÍÓÚñÑ]/g, '') // Quitar emojis y símbolos raros
            .trim();

        const communicate = new Communicate(cleanText, { voice });
        
        const chunks: Buffer[] = [];
        for await (const chunk of communicate.stream()) {
            if (chunk.type === 'audio' && chunk.data) {
                chunks.push(Buffer.from(chunk.data));
            }
        }
        
        const buffer = Buffer.concat(chunks);
        const tempPath = path.join(os.tmpdir(), `tts_${Date.now()}.mp3`);
        await fs.promises.writeFile(tempPath, buffer);
        
        return tempPath;
    } catch (error: any) {
        console.error("Error en TTS:", error.message);
        throw new Error("No pude generar el audio de respuesta.");
    }
}
