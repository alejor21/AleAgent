import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

let mcpClient: Client | null = null;
let mcpToolsCache: any[] = [];

export async function initMcpClient(allowedDirectory: string) {
    if (mcpClient) return;

    try {
        const transport = new StdioClientTransport({
            // Usando npx para crear el server de filesystem oficial
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
        console.log(`[MCP] Conectado a server-filesystem en: ${allowedDirectory}`);

        const toolsList = await mcpClient.listTools();
        // Convertir formato MCP a formato OpenAI Tools
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
    return mcpToolsCache;
}

export async function callMcpTool(name: string, args: any): Promise<string> {
    if (!mcpClient) {
        throw new Error("MCP Client no está inicializado.");
    }
    
    try {
        const result = await mcpClient.callTool({
            name: name,
            arguments: args
        });
        
        // Retornamos el resultado en formato texto para que el modelo lo lea
        if (result.content && Array.isArray(result.content)) {
            return result.content.map((c: any) => c.text || '').join('\n');
        }
        return JSON.stringify(result);
    } catch (error: any) {
        console.error(`[MCP] Error al ejecutar herramienta ${name}:`, error);
        return `Error: ${error.message}`;
    }
}
