import { getCurrentTime } from './get_current_time.js';
import { getMcpTools, callMcpTool } from '../mcp.js';

export function getAllTools() {
    return [
        {
            type: "function" as const,
            function: {
                name: "get_current_time",
                description: "Obtiene la fecha y hora actual en un formato legible.",
                parameters: {
                    type: "object",
                    properties: {
                        timezone: {
                            type: "string",
                            description: "Opcional. Zona horaria (ej: 'America/New_York'). Por defecto usa la hora local."
                        }
                    }
                }
            }
        },
        ...getMcpTools()
    ];
}

export async function executeTool(name: string, args: any): Promise<any> {
    if (name === 'get_current_time') {
        return getCurrentTime(args.timezone);
    }
    
    // Si no es interna, intentamos ejecutarla como herramienta MCP
    try {
        return await callMcpTool(name, args);
    } catch (e: any) {
        throw new Error(`Tool desconocido o falló la ejecución: ${name}. ${e.message}`);
    }
}
