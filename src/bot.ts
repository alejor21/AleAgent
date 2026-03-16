import { Bot, Context, InputFile } from 'grammy';
import { hydrateFiles, FileFlavor } from '@grammyjs/files';
import fs from 'fs';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import boxen from 'boxen';
import { config } from './config.js';
import { processUserMessage } from './agent.js';
import { transcribeAudio } from './whisper.js';
import { textToSpeech } from './tts.js';
import { initMcpClient } from './mcp.js';

type MyContext = FileFlavor<Context>;

export async function startBot() {
    if (config.telegramBotToken === 'SUTITUYE POR EL TUYO' || !config.telegramBotToken) {
        console.error(chalk.red.bold("\n⛔ ERROR CRÍTICO: TELEGRAM_BOT_TOKEN no configurado en .env.\n"));
        process.exit(1);
    }

    const bot = new Bot<MyContext>(config.telegramBotToken);

    // Detectar si estamos en la nube (Render) para no usar el filesystem MCP local
    const isCloudEnv = process.env.RENDER || process.env.NODE_ENV === 'production';

    if (isCloudEnv) {
        console.log(chalk.cyan(">> Modo Nube: MCP local deshabilitado (no es necesario en Render)."));
        // Igual inicializamos para que carguen las tools como "web_search", pero pasamos 'cloud'
        await initMcpClient('cloud');
    } else {
        console.log(chalk.cyan(">> Conectando Sistemas MCP..."));
        await initMcpClient(os.homedir());
    }


    // Activar plugin de archivos de Grammy
    bot.api.config.use(hydrateFiles(bot.token));
    // Middleware de seguridad: Whitelist
    bot.use(async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        if (!config.allowedUserIds.includes(userId)) {
            console.log(chalk.yellow(`\n🚨 Intento de acceso bloqueado:\n   - Usuario ID: ${userId}\n   - AleAgent ignoró silenciosamente a este usuario para mantener la seguridad.\n`));
            return;
        }

        await next();
    });

    bot.command("start", (ctx) => {
        ctx.reply("¡Hola! Soy AleAgent, tu agente de IA personal y seguro. ¿En qué puedo ayudarte?");
    });

    // Manejar mensajes de texto
    bot.on("message:text", async (ctx) => {
        const userId = ctx.from.id;
        const text = ctx.message.text;

        try {
            await ctx.replyWithChatAction("typing");
            
            // Mensaje de estado
            const statusMsg = await ctx.reply("⏳ Generando respuesta...");

            const response = await processUserMessage(userId, text);
            
            if (text.toLowerCase().includes("responde con audio") || text.toLowerCase().includes("háblame")) {
                await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "🎙️ Sintetizando voz...");
                await ctx.replyWithChatAction("record_voice");
                const audioPath = await textToSpeech(response);
                
                await ctx.replyWithVoice(new InputFile(audioPath));
                
                // Borrar mensaje de estado y limpiar archivo local
                await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
                if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
            } else {
                // Editar el mensaje de estado con la respuesta final
                await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, response);
            }
        } catch (error: any) {
            console.error("Error procesando el mensaje de texto:", error);
            await ctx.reply("❌ Ocurrió un error interno al procesar tu solicitud.");
        }
    });

    // Manejar audios y notas de voz (voice)
    bot.on(["message:voice", "message:audio"], async (ctx) => {
        const userId = ctx.from.id;
        let tempFilePath = '';
        let statusMsg: any = null;

        try {
            // Primer estado: Transcribiendo
            statusMsg = await ctx.reply("⏳ Transcribiendo audio...");
            await ctx.replyWithChatAction("typing");

            const file = await ctx.getFile().catch(err => {
                if (err.code === 'ETIMEDOUT') throw new Error("TIMEOUT_TELEGRAM");
                throw err;
            });

            tempFilePath = path.join(os.tmpdir(), `audio_${userId}_${Date.now()}.ogg`);
            await file.download(tempFilePath);

            const transcribedText = await transcribeAudio(tempFilePath);

            if (!transcribedText.trim()) {
                await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "⚠️ El audio no contiene voz detectable.");
                return;
            }

            // Segundo estado: Consultando a la IA
            await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "🧠 Analizando...");
            const messageContext = `[Mensaje de voz de Alejandro]: ${transcribedText}`;
            const response = await processUserMessage(userId, messageContext);
            
            // Tercer estado: Generando la voz de JARVIS
            await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "🎙️ Generando respuesta...");
            await ctx.replyWithChatAction("record_voice");
            
            const audioPath = await textToSpeech(response);
            await ctx.replyWithVoice(new InputFile(audioPath));
            
            // Limpieza: Borrar el mensaje de progreso y el archivo temporal
            await ctx.api.deleteMessage(ctx.chat.id, statusMsg.message_id);
            if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

        } catch (error: any) {
            if (error.message === 'TIMEOUT_TELEGRAM') {
                if (statusMsg) await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "⚠️ Error de conexión con los servidores de archivos de Telegram.");
            } else {
                console.error("Error procesando el audio:", error);
                if (statusMsg) await ctx.api.editMessageText(ctx.chat.id, statusMsg.message_id, "❌ Error en el procesamiento del audio.");
            }
        } finally {
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }
        }
    });

    bot.catch((err) => {
        console.error(chalk.red.bold("\n❌ Error crítico en el bot:"), err);
    });

    const successMessage =
        chalk.cyanBright("  [ Sistema funcionando correctamente ]\n") +
        chalk.green("\n  Bienvenido") + chalk.white(" Soy AleAgent, Agente o Asistente personal de Alejandro Rojas .\n") +
        chalk.white("  Estoy listo para ayudarte en lo que necesites.\n") +
        chalk.white("  A la espera de sus instrucciones a través de Telegram.\n\n") +
        chalk.gray("  > Servicio activo y monitoreando canal seguro...");

    console.log(
        boxen(successMessage, {
            padding: 1,
            margin: 1,
            borderStyle: 'round',
            borderColor: 'cyan',
            title: chalk.cyanBright.bold(' ⚡ AleAgent '),
            titleAlignment: 'center'
        })
    );

    bot.start();
}
