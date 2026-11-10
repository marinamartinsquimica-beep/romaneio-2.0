import {escopoCompartilhado} from './bases-compartilhadas.mjs?v=2.0.117';
export const erroTemporario=e=>/resource-exhausted|quota|unavailable|deadline-exceeded|network|permission-denied/i.test(String(e?.code||e?.codigo||'')+' '+String(e?.message||e?.mensagem||e||''));
const CONTROLES_KEY='__romaneioControleEnvios144';
function storageSeguro(){try{return globalThis.localStorage||null;}catch{return null;}}
export function criarControleTentativas({agora=()=>Date.now(),prazoTravaMs=30000,storage=null,chaveQuota=null}={}){
 let tentativas=0,proxima=0,ocupado=false,iniciadoEm=0,geracao=0,quotaAte=0;
 const metricas={tentativasIniciadas:0,falhas:0,tentativasAdiada:0,travasRecuperadas:0};
 const lerQuota=()=>{try{const n=Number(storage?.getItem(chaveQuota)||0);return Number.isFinite(n)&&n>agora()?n:0;}catch{return 0;}};
 const salvarQuota=()=>{try{if(!storage||!chaveQuota)return;if(quotaAte>agora())storage.setItem(chaveQuota,String(quotaAte));else storage.removeItem(chaveQuota);}catch{}};
 quotaAte=lerQuota();
 const limparQuotaExpirada=()=>{const salvo=lerQuota();if(salvo>quotaAte)quotaAte=salvo;if(quotaAte&&agora()>=quotaAte){quotaAte=0;salvarQuota();}};
 const fimEspera=()=>Math.max(proxima,quotaAte);
 const travaExpirada=()=>ocupado&&agora()-iniciadoEm>=prazoTravaMs;
 return {
  podeTentar(){limparQuotaExpirada();return (!ocupado||travaExpirada())&&agora()>=fimEspera();},
  iniciar(){limparQuotaExpirada();if(travaExpirada()){ocupado=false;metricas.travasRecuperadas++;}if(ocupado||agora()<fimEspera()){metricas.tentativasAdiadas++;return false;}ocupado=true;iniciadoEm=agora();geracao++;metricas.tentativasIniciadas++;return true;},
  encerrar(id=geracao){if(id!==geracao)return;ocupado=false;iniciadoEm=0;},
  get geracao(){return geracao;},
  get restanteBloqueioMs(){return ocupado?Math.max(0,prazoTravaMs-(agora()-iniciadoEm)):0;},
  liberarEspera(){limparQuotaExpirada();if(!ocupado)proxima=quotaAte>agora()?Math.max(proxima,quotaAte):0;},
  falhou(e){tentativas++;metricas.falhas++;const quota=/resource-exhausted|quota/i.test(String(e?.code||e?.codigo||'')+' '+String(e?.message||e?.mensagem||e||''));const agoraMs=agora();const espera=quota?900000:Math.min(300000,5000*2**Math.min(tentativas-1,6));proxima=agoraMs+espera;if(quota){quotaAte=proxima;salvarQuota();}},
  sucesso(){tentativas=0;proxima=0;limparQuotaExpirada();},
  get metricas(){return {...metricas};},
  get restanteMs(){limparQuotaExpirada();return Math.max(0,fimEspera()-agora());}
 };
}
export function controleEnviosCompartilhado(uid,escopo=escopoCompartilhado()){
 const controles=escopo[CONTROLES_KEY]||(escopo[CONTROLES_KEY]=new Map());
 if(!controles.has(uid))controles.set(uid,criarControleTentativas({storage:storageSeguro(),chaveQuota:'romaneio2_cooldown_quota_v1:'+uid}));return controles.get(uid);
}
export function metricasEnviosCompartilhados(escopo=escopoCompartilhado()){
 return [...(escopo[CONTROLES_KEY]||new Map())].map(([conta,c])=>({conta,...c.metricas,esperaRestanteMs:c.restanteMs}));
}
