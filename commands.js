import { InlineKeyboard } from 'grammy';
import { randomBytes } from 'node:crypto';
import { resolve4, resolveMx, resolveNs } from 'node:dns/promises';

const pending = new Map();
const lastCall = new Map();
const labels = {cep:'📍 CEP',cnpj:'🏢 CNPJ',telefone:'📱 Telefone / DDD',operadora:'📡 Operadora',cpf:'🪪 Validar CPF',ip:'🌍 IP',dominio:'🌐 Domínio',email:'📧 E-mail',dns:'🛠️ DNS',senha:'🔐 Gerar senha'};
const instructions = {cep:'Digite um CEP com 8 números.',cnpj:'Digite um CNPJ com 14 números.',telefone:'Digite um telefone brasileiro com DDD.',operadora:'Digite um número com DDD. Atenção: portabilidade impede determinar a operadora apenas pelo prefixo.',cpf:'Digite um CPF para validar apenas os dígitos.',ip:'Digite um IPv4 público.',dominio:'Digite um domínio, exemplo: exemplo.com',email:'Digite um endereço de e-mail.',dns:'Digite um domínio para consultar registros DNS.'};
const menu = () => {const kb=new InlineKeyboard(); for(const [id,label] of Object.entries(labels)) kb.text(label,'do:'+id).row();return kb;};
const back = () => new InlineKeyboard().text('🏠 Menu principal','menu').text('❌ Cancelar','cancel');
const digits=s=>s.replace(/\D/g,'');
const domainValid=s=>s.length<=253&&/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(s);
const cpfValid=s=>{const d=digits(s);if(!/^\d{11}$/.test(d)||/^(\d)\1+$/.test(d))return false;for(let n=9;n<11;n++){let sum=0;for(let i=0;i<n;i++)sum+=Number(d[i])*(n+1-i);const check=(sum*10)%11%10;if(check!==Number(d[n]))return false;}return true;};
const cnpjValid=s=>{const d=digits(s);if(!/^\d{14}$/.test(d)||/^(\d)\1+$/.test(d))return false;for(const weights of [[5,4,3,2,9,8,7,6,5,4,3,2],[6,5,4,3,2,9,8,7,6,5,4,3,2]]){const n=weights.length;const sum=weights.reduce((a,w,i)=>a+w*Number(d[i]),0);const r=sum%11;const check=r<2?0:11-r;if(check!==Number(d[n]))return false;}return true;};
async function getJson(url){const ctl=new AbortController();const t=setTimeout(()=>ctl.abort(),9000);try{const res=await fetch(url,{signal:ctl.signal,headers:{'User-Agent':'4KODAX-System/6'}});if(!res.ok)throw Error('Serviço indisponível ('+res.status+').');return await res.json();}finally{clearTimeout(t);}}
const clean=s=>String(s??'Não informado').slice(0,180);
async function lookup(type,input){
  const d=digits(input), s=input.trim().toLowerCase();
  switch(type){
  case 'cep':{if(d.length!==8)throw Error('CEP deve ter 8 dígitos.');const x=await getJson('https://viacep.com.br/ws/'+d+'/json/');if(x.erro)throw Error('CEP não encontrado.');return `📍 CEP ${d}\nLogradouro: ${clean(x.logradouro)}\nBairro: ${clean(x.bairro)}\nCidade: ${clean(x.localidade)}\nUF: ${clean(x.uf)}`;}
  case 'cnpj':{if(!cnpjValid(d))throw Error('CNPJ inválido.');const x=await getJson('https://brasilapi.com.br/api/cnpj/v1/'+d);return `🏢 CNPJ ${d}\nRazão social: ${clean(x.razao_social)}\nFantasia: ${clean(x.nome_fantasia)}\nSituação: ${clean(x.descricao_situacao_cadastral)}\nMunicípio: ${clean(x.municipio)} / ${clean(x.uf)}`;}
  case 'telefone':case 'operadora':{if(!/^\d{10,11}$/.test(d))throw Error('Informe telefone com DDD (10 ou 11 dígitos).');const ddd=Number(d.slice(0,2));if(ddd<11||ddd>99)throw Error('DDD inválido.');return `📱 Número informado: (${d.slice(0,2)}) ${d.slice(2)}\nDDD: ${ddd}\nFormato: válido em comprimento.\nOperadora atual: não é possível confirmar apenas pelo número devido à portabilidade.`;}
  case 'cpf':return `🪪 CPF: ${cpfValid(d)?'Dígitos verificadores válidos':'Inválido'}\nIsso não confirma cadastro, titularidade ou situação na Receita Federal.`;
  case 'ip':{const a=s.split('.');if(a.length!==4||a.some(p=>!/^(0|[1-9]\d{0,2})$/.test(p)||Number(p)>255))throw Error('Digite um IPv4 válido.');const n=a.map(Number);if(n[0]===10||n[0]===127||n[0]===0||n[0]>=224||(n[0]===172&&n[1]>=16&&n[1]<=31)||(n[0]===192&&n[1]===168)||(n[0]===169&&n[1]===254)||(n[0]===100&&n[1]>=64&&n[1]<=127))throw Error('Digite um IP público.');const x=await getJson('https://ipwho.is/'+encodeURIComponent(s));if(!x.success)throw Error('IP não encontrado.');return `🌍 IP: ${s}\nPaís: ${clean(x.country)}\nRegião: ${clean(x.region)}\nCidade aproximada: ${clean(x.city)}\nProvedor: ${clean(x.connection?.isp)}\nASN: ${clean(x.connection?.asn)}`;}
  case 'dominio':case 'dns':{if(!domainValid(s))throw Error('Domínio inválido.');const results=await Promise.allSettled([resolve4(s),resolveMx(s),resolveNs(s)]);const value=i=>results[i].status==='fulfilled'?results[i].value:[];const ips=value(0),mx=value(1),ns=value(2);return `🌐 ${s}\nIPv4: ${ips.join(', ')||'Nenhum encontrado'}\nMX: ${mx.map(x=>x.exchange).join(', ')||'Nenhum encontrado'}\nNS: ${ns.join(', ')||'Nenhum encontrado'}`;}
  case 'email':{if(s.length>254||!/^[^\s@]+@[^\s@]+$/.test(s))throw Error('E-mail inválido.');const dom=s.split('@')[1];if(!domainValid(dom))throw Error('Domínio do e-mail inválido.');const mx=await resolveMx(dom).catch(()=>[]);return `📧 Formato: válido\nDomínio: ${dom}\nMX: ${mx.length?'Encontrado':'Não encontrado'}\nIsso não confirma que a caixa de e-mail existe.`;}
  default:throw Error('Consulta desconhecida.');
  }
}
function safeError(e){const m=String(e?.message||'Erro desconhecido');if(/fetch failed|abort|timeout|ENOTFOUND|ENODATA|ECONN|EAI_AGAIN/i.test(m))return 'Serviço temporariamente indisponível. Tente novamente.';return m.slice(0,240);}
export function registerCommands(bot){
 const home=async ctx=>{pending.delete(ctx.from.id);await ctx.reply('🚀 4KODAX SYSTEM V6\nEscolha uma consulta ou ferramenta:',{reply_markup:menu()});};
 bot.command('start',home);bot.command(['help','ajuda'],async ctx=>ctx.reply('Selecione uma opção no menu, informe o dado solicitado e aguarde a resposta. Consultas usam apenas fontes públicas.\nUse /cancelar para cancelar.',{reply_markup:menu()}));bot.command('cancelar',home);
 bot.callbackQuery('menu',async ctx=>{await ctx.answerCallbackQuery();await home(ctx);});
 bot.callbackQuery('cancel',async ctx=>{await ctx.answerCallbackQuery();pending.delete(ctx.from.id);await ctx.reply('Consulta cancelada.',{reply_markup:menu()});});
 bot.callbackQuery(/^do:(.+)$/,async ctx=>{await ctx.answerCallbackQuery();const type=ctx.match[1];if(!labels[type])return;if(type==='senha'){const password=randomBytes(18).toString('base64url');await ctx.reply('🔐 Senha aleatória:\n'+password+'\nGuarde em local seguro.',{reply_markup:back()});return;}pending.set(ctx.from.id,type);await ctx.reply(`${labels[type]}\n${instructions[type]}`,{reply_markup:back()});});
 bot.on('message:text',async ctx=>{const type=pending.get(ctx.from.id);if(!type)return ctx.reply('Use /start para abrir o menu.');const key=ctx.from.id,now=Date.now();if(now-(lastCall.get(key)||0)<3000)return ctx.reply('Aguarde alguns segundos antes de consultar novamente.');lastCall.set(key,now);pending.delete(key);try{await ctx.reply('🔎 Consultando...');const result=await lookup(type,ctx.message.text.slice(0,300));await ctx.reply(result,{reply_markup:back()});}catch(e){await ctx.reply('⚠️ '+safeError(e),{reply_markup:menu()});}});
}
