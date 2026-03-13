import { startBot } from './bot.js';
import chalk from 'chalk';

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
