import { saveMessage, getHistory } from './db.js';
import { getCompletion, formatMessages } from './llm.js';
import { executeTool } from './tools/index.js';

const MAX_ITERATIONS = 5;

export async function processUserMessage(userId: number, text: string): Promise<string> {
    // Guarda el mensaje del usuario en la base de datos
    await saveMessage(userId, {
        role: 'user',
        content: text,
        tool_calls: null,
        tool_call_id: null
    });

    let iterations = 0;

    while (iterations < MAX_ITERATIONS) {
        iterations++;

        const history = await getHistory(userId, 10);
        const messages = formatMessages(history);

        console.log(`[Agente] Iteración ${iterations}, consultando al LLM...`);
        const responseMessage = await getCompletion(messages);

        // Guarda la respuesta del asistente (ya sea un mensaje o invocación de herramientas)
        await saveMessage(userId, {
            role: 'assistant',
            content: responseMessage.content || null,
            tool_calls: responseMessage.tool_calls ? JSON.stringify(responseMessage.tool_calls) : null,
            tool_call_id: null
        });

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            // El agente decidió usar una herramienta, las ejecutamos
            for (const toolCall of responseMessage.tool_calls) {
                console.log(`[Agente] Ejecutando herramienta: ${toolCall.function.name}`);
                let resultText = '';

                try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const result = await executeTool(toolCall.function.name, args);
                    resultText = typeof result === 'object' ? JSON.stringify(result) : String(result);
                } catch (error: any) {
                    resultText = `Error al ejecutar la herramienta: ${error.message}`;
                    console.error(`[Agente] Error de herramienta:`, error);
                }

                // Guardar el resultado de la herramienta en el historial
                await saveMessage(userId, {
                    role: 'tool',
                    content: resultText,
                    tool_calls: null,
                    tool_call_id: toolCall.id
                });
            }
            // Continúa en el loop para que el modelo lea el resultado de la herramienta y tome otra decisión
        } else if (responseMessage.content) {
            // No hay herramientas por llamar, retornamos la respuesta final al usuario
            return responseMessage.content;
        } else {
            // Fallback en caso de que todo falle
            return "Lo siento, hubo un error procesando tu respuesta (contenido vacío).";
        }
    }

    return "Se ha alcanzado el límite interno de pensamientos del agente. Por favor formula tu solicitud nuevamente.";
}

