import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import axios from 'axios';

let mcpClient: Client | null = null;
let mcpToolsCache: any[] = [];

// Herramientas internas adicionales
const internalTools = [
    {
        type: "function" as const,
        function: {
            name: "web_search",
            description: "Busca en internet información actualizada (noticias, tendencias, datos).",
            parameters: {
                type: "object",
                properties: {
                    query: { type: "string", description: "Lo que quieres buscar." }
                },
                required: ["query"]
            }
        }
    },
    {
        type: "function" as const,
        function: {
            name: "web_browse",
            description: "Lee el contenido de una URL específica para analizarlo a fondo.",
            parameters: {
                type: "object",
                properties: {
                    url: { type: "string", description: "La URL que quieres leer." }
                },
                required: ["url"]
            }
        }
    }
];

export async function initMcpClient(allowedDirectory: string) {
    if (mcpClient) return;

    try {
        // Por ahora mantenemos el filesystem como MCP principal
        const transport = new StdioClientTransport({
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", allowedDirectory]
        });

        mcpClient = new Client({
            name: "aleagent-mcp",
            version: "1.0.0"
        }, {
            capabilities: {}
        });

        await mcpClient.connect(transport);
        console.log(`[MCP] Conectado a server-filesystem.`);

        const toolsList = await mcpClient.listTools();
        mcpToolsCache = toolsList.tools.map((tool: any) => ({
            type: "function" as const,
            function: {
                name: tool.name,
                description: tool.description || `Ejecuta la acción ${tool.name}`,
                parameters: tool.inputSchema
            }
        }));

        console.log(`[MCP] ${mcpToolsCache.length} herramientas locales cargadas.`);
    } catch (error) {
        console.error("[MCP] Error al inicializar cliente:", error);
    }
}

export function getMcpTools() {
    return [...internalTools, ...mcpToolsCache];
}

// Implementación simple de búsqueda web usando una API pública o similar
async function simpleWebSearch(query: string): Promise<string> {
    try {
        // Usamos una API de búsqueda rápida (DuckDuckGo Lite o similar vía proxy/scrapper si no hay API Key)
        // Para este ejemplo, usaremos un mock potente o recomendaremos una API Key.
        // Pero para dar funcionalidad inmediata, usaremos 'google-this' o similar si estuviera instalado.
        // Como no queremos fallar, haremos una búsqueda vía axios a un buscador abierto.
        const response = await axios.get(`https://ddg-api.herokuapp.com/search`, {
            params: { query, limit: 5 }
        });
        
        if (Array.isArray(response.data)) {
            return response.data.map((r: any) => `Título: ${r.title}\nLink: ${r.link}\nResumen: ${r.snippet}`).join('\n\n');
        }
        return "No se encontraron resultados relevantes.";
    } catch (error) {
        return "Error al conectar con el motor de búsqueda. Inténtalo más tarde.";
    }
}

export async function callMcpTool(name: string, args: any): Promise<string> {
    if (name === 'web_search') {
        return simpleWebSearch(args.query);
    }
    
    if (name === 'web_browse') {
        try {
            const response = await axios.get(args.url);
            // Retornamos una versión simplificada del HTML (texto plano)
            const text = response.data.toString()
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '')
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '')
                .replace(/<[^>]+>/g, ' ')
                .slice(0, 5000); // Límite de caracteres para el LLM
            return text;
        } catch (error) {
            return `Error al navegar: ${args.url}`;
        }
    }

    if (!mcpClient) {
        throw new Error("MCP Client no está inicializado.");
    }
    
    try {
        const result = await mcpClient.callTool({
            name: name,
            arguments: args
        });

        
        if (result.content && Array.isArray(result.content)) {
            return result.content.map((c: any) => c.text || '').join('\n');
        }
        return JSON.stringify(result);
    } catch (error: any) {
        console.error(`[MCP] Error al ejecutar herramienta ${name}:`, error);
        return `Error: ${error.message}`;
    }
}

