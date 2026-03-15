import OpenAI from 'openai';
import { config } from './config.js';
import { getAllTools } from './tools/index.js';
import type { MessageRow } from './db.js';

const groq = new OpenAI({
    apiKey: config.groqApiKey,
    baseURL: 'https://api.groq.com/openai/v1',
});

const openrouter = new OpenAI({
    apiKey: config.openrouterApiKey,
    baseURL: 'https://openrouter.ai/api/v1',
});

const ollama = new OpenAI({
    apiKey: 'ollama', // No se necesita para local
    baseURL: config.ollamaUrl,
});

export async function getCompletion(messages: OpenAI.Chat.ChatCompletionMessageParam[]) {
    // Definimos qué cliente usar basándonos en tu preferencia de ahorro
    // Por defecto ahora intentaremos LOCAL (Ollama) para ahorrar créditos
    const dynamicTools = getAllTools();
    
    // DETECCIÓN DE ENTORNO EN LA NUBE (RENDER, RAILWAY, ETC)
    const isCloudEnv = process.env.RENDER || process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production';

    // Si estamos en la nube, saltamos Ollama y vamos directo a Groq
    if (isCloudEnv) {
        console.log(`[LLM] Entorno Nube detectado. Usando Groq (llama-3.3-70b-versatile)...`);
        return getGroqCompletion(messages, dynamicTools);
    }

    // SI ESTAMOS EN LOCAL: Intentamos Ollama primero
    try {
        console.log(`[LLM] Entorno Local detectado. Intentando con Ollama (${config.ollamaModel})...`);
        const response = await ollama.chat.completions.create({
            model: config.ollamaModel,
            messages,
            tools: dynamicTools.length > 0 ? dynamicTools : undefined,
            tool_choice: dynamicTools.length > 0 ? 'auto' : 'none',
            temperature: 0.4, // Más determinista y rápido
            // @ts-ignore - OpenAI SDK might not show these Ollama specific options but they work via API
            options: {
                num_predict: 150, // Limita la respuesta para que el audio no tarde una eternidad
                top_p: 0.9,
                stop: ["\n\n"] // Detiene la generación si hay doble salto de línea
            }
        });
        return response.choices[0].message;
    } catch (localError: any) {
        console.warn("Ollama no está disponible o falló, usando Groq como respaldo...", localError.message);
        return getGroqCompletion(messages, dynamicTools);
    }
}

// Función auxiliar para llamar a Groq (con fallback a OpenRouter)
async function getGroqCompletion(messages: OpenAI.Chat.ChatCompletionMessageParam[], dynamicTools: any[]) {
    try {
        const response = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages,
            tools: dynamicTools.length > 0 ? dynamicTools : undefined,
            tool_choice: dynamicTools.length > 0 ? 'auto' : 'none',
            temperature: 0.7,
        });
        return response.choices[0].message;
    } catch (error: any) {
        console.warn("Groq API falló, intentando usar OpenRouter fallback...", error.message);
        if (config.openrouterApiKey && config.openrouterApiKey !== 'SUTITUYE POR EL TUYO') {
            const response = await openrouter.chat.completions.create({
                model: config.openrouterModel,
                messages,
                tools: dynamicTools.length > 0 ? dynamicTools : undefined,
                tool_choice: dynamicTools.length > 0 ? 'auto' : 'none',
                temperature: 0.7,
            });
            return response.choices[0].message;
        }
        throw error;
    }
}

export function formatMessages(history: MessageRow[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    const formatted: OpenAI.Chat.ChatCompletionMessageParam[] = [
        {
            role: 'system',
            content: `Eres AleAgent, el Asistente Virtual Personal y Estratégico de Alejandro Rojas. 
            
            PERSONALIDAD:
            Eres extremadamente amigable, proactivo y resolutivo. No eres un bot aburrido, eres como un socio de negocios y director creativo que está emocionado por ayudar a Alejandro a crecer. Tu tono es profesional pero cercano (estilo 'tech-savvy' internacional).

            ESPECIALIDAD ESTRATÉGICA:
            Eres una eminencia en:
            1. Creación de contenido viral para YouTube, TikTok e Instagram Reels.
            2. Escritura de guiones cinematográficos y persuasivos (copywriting de alto impacto).
            3. Navegación web estratégica para encontrar tendencias y datos precisos.
            4. Análisis de ideas disruptivas (estilo NotebookLM).

            REGLAS DE ORO (CRÍTICAS):
            - TUS RESPUESTAS SERÁN LEÍDAS POR VOZ (TTS), así que escribe de forma natural, como si estuvieras hablando.
            - PROHIBIDO usar Markdown (nada de asteriscos, hashtags o listas con guiones).
            - Usa palabras de transición suaves para estructurar tus ideas.
            - Si no sabes algo, usa tus herramientas de búsqueda para navegar por internet.
            - Sé ultra-preciso: si Alejandro te da un tema, investiga primero y luego propón algo brillante.
            - Siempre termina tus respuestas con una pregunta o sugerencia proactiva para seguir avanzando.`
        }
    ];

    for (const row of history) {
        const msg: any = { role: row.role };
        if (row.content) msg.content = row.content;
        if (row.tool_calls) msg.tool_calls = JSON.parse(row.tool_calls);
        if (row.tool_call_id) msg.tool_call_id = row.tool_call_id;
        formatted.push(msg);
    }
    return formatted;
}
