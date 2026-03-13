import dotenv from 'dotenv';
dotenv.config();

function getEnv(key: string, required = false): string {
    const value = process.env[key];
    if (required && !value) {
        throw new Error(`Environment variable ${key} is required`);
    }
    return value || '';
}

export const config = {
    telegramBotToken: getEnv('TELEGRAM_BOT_TOKEN', true),
    allowedUserIds: getEnv('TELEGRAM_ALLOWED_USER_IDS', true)
        .split(',')
        .map(id => parseInt(id.trim(), 10))
        .filter(id => !isNaN(id)),
    groqApiKey: getEnv('GROQ_API_KEY', true),
    openrouterApiKey: getEnv('OPENROUTER_API_KEY'),
    openrouterModel: getEnv('OPENROUTER_MODEL') || 'openrouter/free',
    dbPath: getEnv('DB_PATH') || './memory.db',
    googleCredentials: getEnv('GOOGLE_APPLICATION_CREDENTIALS'),
    ollamaUrl: getEnv('OLLAMA_URL') || 'http://localhost:11434/v1',
    ollamaModel: getEnv('OLLAMA_MODEL') || 'qwen2.5:7b'
};
