import { startBot } from './bot.js';
import chalk from 'chalk';
import http from 'http';

// Servidor "Fantasma" para mantener a Render contento (Web Service)
const port = process.env.PORT || 3000;
const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL; // Render nos da esto automáticamente

http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('AleAgent Status: ONLINE 24/7');
    res.end();
}).listen(port, () => {
    console.log(chalk.green(`🌐 Servidor Web escuchando en puerto ${port} (Requerimiento de Render)`));
    
    // Auto-ping cada 14 minutos para evitar el "sleep" de Render (Free Tier)
    if (RENDER_EXTERNAL_URL) {
        console.log(chalk.yellow(`🚀 Keep-alive activado. Ping a: ${RENDER_EXTERNAL_URL}`));
        setInterval(() => {
            http.get(RENDER_EXTERNAL_URL, (res) => {
                console.log(`[Keep-Alive] Ping enviado. Status: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error('[Keep-Alive] Error en ping:', err.message);
            });
        }, 14 * 60 * 1000); // 14 minutos
    }
});


console.log(chalk.blue.bold("\n⚡ Iniciando secuencias de arranque...\n"));

try {
    await startBot();

    // Manejo de apagado seguro (graceful shutdown)
    process.once('SIGINT', () => {
        console.log("Apagando AleAgent...");
        process.exit(0);
    });
    process.once('SIGTERM', () => {
        console.log("Apagando AleAgent...");
        process.exit(0);
    });
} catch (error) {
    console.error("Error fatal al iniciar:", error);
    process.exit(1);
}
