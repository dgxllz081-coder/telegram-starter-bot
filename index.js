import { Bot } from 'grammy';
import { registerCommands } from './src/commands.js';
const token = process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_TOKEN || process.env.TOKEN;
if (!token) { console.error('Configure BOT_TOKEN no FadeHost.'); process.exit(1); }
const bot = new Bot(token);
registerCommands(bot);
bot.catch((err) => console.error('Erro Telegram:', err.error?.message || err.message));
process.on('SIGTERM', () => bot.stop());
process.on('SIGINT', () => bot.stop());
await bot.api.setMyCommands([
  {command:'start',description:'Abrir menu'}, {command:'help',description:'Ajuda'},
  {command:'ajuda',description:'Ajuda em português'}, {command:'cancelar',description:'Cancelar consulta'}
]);
console.log('4KODAX SYSTEM V6 iniciado');
await bot.start({onStart: info => console.log('Online:',info.username)});
