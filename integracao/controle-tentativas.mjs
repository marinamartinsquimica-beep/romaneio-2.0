import {escopoCompartilhado} from './bases-compartilhadas.mjs?v=2.0.117';
export const erroTemporario=e=>/resource-exhausted|quota|unavailable|deadline-exceeded|network|permission-denied/i.test(String(e?.code||e?.codigo||'')+' '+String(e?.message||e?.mensagem||e||''));
export function criarControleTentativas({agora=()=>Date.now()}={}){
 let tentativas=0,proxima=0,ocupado=false;const metricas={tentativasIniciadas:0,falhas:0,tentativasAdiada:0};
 return {
  podeTentar:()=>!ocupado&&agora()>=proxima,
  iniciar(){if(ocupado||agora()<proxima){metricas.tentativasAdiada++;return false;}ocupado=true;metricas.tentativasIniciadas++;return true;},
  encerrar(){ocupado=false;},
  falhou(e){tentativas++;metricas.falhas++;const quota=/resource-exhausted|quota/i.test(String(e?.code||e?.codigo||'')+' '+String(e?.message||e?.mensagem||e||''));const espera=quota?900000:Math.min(300000,5000*2**Math.min(tentativas-1,6));proxima=agora()+espera;},
  sucesso(){tentativas=0;proxima=0;},
  get metricas(){return {...metricas};},
  get restanteMs(){return Math.max(0,proxima-agora());}
 };
}
export function controleEnviosCompartilhado(uid,escopo=escopoCompartilhado()){
 const chave='__romaneioControleEnvios117';const controles=escopo[chave]||(escopo[chave]=new Map());
 if(!controles.has(uid))controles.set(uid,criarControleTentativas());return controles.get(uid);
}

export function metricasEnviosCompartilhados(escopo=escopoCompartilhado()){
 return [...(escopo.__romaneioControleEnvios117||new Map())].map(([conta,c])=>({conta,...c.metricas,esperaRestanteMs:c.restanteMs}));
}
