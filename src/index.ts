import { startBot } from './bot.js';
import chalk from 'chalk';
import http from 'http';

// Servidor "Fantasma" para mantener a Render contento (Web Service)
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.write('AleAgent Status: ONLINE 24/7');
    res.end();
}).listen(port, () => {
    console.log(chalk.green(`🌐 Servidor Web escuchando en puerto ${port} (Requerimiento de Render)`));
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
