import {escopoCompartilhado} from './bases-compartilhadas.mjs?v=2.0.117';
export const erroTemporario=e=>/resource-exhausted|quota|unavailable|deadline-exceeded|network|permission-denied/i.test(String(e?.code||e?.codigo||'')+' '+String(e?.message||e?.mensagem||e||''));
export function criarControleTentativas({agora=()=>Date.now(),prazoTravaMs=120000}={}){
 let tentativas=0,proxima=0,ocupado=false,iniciadoEm=0,geracao=0;const metricas={tentativasIniciadas:0,falhas:0,tentativasAdiada:0,travasRecuperadas:0};
 const travaExpirada=()=>ocupado&&agora()-iniciadoEm>=prazoTravaMs;
 return {
  podeTentar:()=>(!ocupado||travaExpirada())&&agora()>=proxima,
  iniciar(){if(travaExpirada()){ocupado=false;metricas.travasRecuperadas++;}if(ocupado||agora()<proxima){metricas.tentativasAdiada++;return false;}ocupado=true;iniciadoEm=agora();geracao++;metricas.tentativasIniciadas++;return true;},
  encerrar(id=geracao){if(id!==geracao)return;ocupado=false;iniciadoEm=0;},
  get geracao(){return geracao;},
  get restanteBloqueioMs(){return ocupado?Math.max(0,prazoTravaMs-(agora()-iniciadoEm)):0;},
  liberarEspera(){if(!ocupado)proxima=0;},
  falhou(e){tentativas++;metricas.falhas++;const quota=/resource-exhausted|quota/i.test(String(e?.code||e?.codigo||'')+' '+String(e?.message||e?.mensagem||e||''));const espera=quota?900000:Math.min(300000,5000*2**Math.min(tentativas-1,6));proxima=agora()+espera;},
  sucesso(){tentativas=0;proxima=0;},
  get metricas(){return {...metricas};},
  get restanteMs(){return Math.max(0,proxima-agora());}
 };
}
export function controleEnviosCompartilhado(uid,escopo=escopoCompartilhado()){
 const chave='__romaneioControleEnvios134';const controles=escopo[chave]||(escopo[chave]=new Map());
 if(!controles.has(uid))controles.set(uid,criarControleTentativas());return controles.get(uid);
}

export function metricasEnviosCompartilhados(escopo=escopoCompartilhado()){
 return [...(escopo.__romaneioControleEnvios134||new Map())].map(([conta,c])=>({conta,...c.metricas,esperaRestanteMs:c.restanteMs}));
}
