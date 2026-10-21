import {identidadeExpedicaoBaixa} from './baixa-transacional.mjs';
import {identidadeFisica,filtrarMovimentosJaFechados} from './marcos-romaneios-fechados.mjs';
const id=x=>String(x??'').trim();
export function romaneioBaixado(registro,expedicoes){
 const rid=id(registro?.registroId);
 return expedicoes.some(e=>{
  if(e?.estado!=='BAIXA_CONCLUIDA')return false;
  const eid=id(e.registroId),origem=id(e.origemId);
  if(rid){
   if(eid)return rid===eid;
   if(origem)return origem==='ativo_'+rid;
   return id(e.id)===identidadeExpedicaoBaixa(registro,true).id;
  }
  // Legado sem ID: exigir identidade completa com data, nunca só destino/palete.
  return !eid&&!origem.startsWith('ativo_')&&Boolean(registro?.data&&e.data)&&identidadeFisica(registro)===identidadeFisica(e);
 });
}
export function filtrarEventosBaixados(movimentos,expedicoes){
 if(!Array.isArray(movimentos)||!Array.isArray(expedicoes))throw Error('Histórico de recebimento inválido.');
 return movimentos.filter(m=>!romaneioBaixado(m.item||m.antes,expedicoes));
}
export function separarEncerradosLocais({registros,movimentos,expedicoes,fechamentos=[]}){
 if(![registros,movimentos,expedicoes,fechamentos].every(Array.isArray))throw Error('Conferência de encerramento inválida.');
 const atuais=[],encerrados=[];
 for(const registro of registros){
  const marcador=filtrarMovimentosJaFechados([{item:registro,criadoEm:'1970-01-01T00:00:00.001Z'}],fechamentos).length===0;
  // Exclusão no celular não encerra a cópia de conferência do computador.
  (romaneioBaixado(registro,expedicoes)&&marcador?encerrados:atuais).push(registro);
 }
 return {atuais,encerrados};
}
// ID estável: repetir a sincronização não cria cópias duplicadas no histórico.
export function identidadeHistoricoEncerrados(registros){
 const texto=JSON.stringify(registros.map(x=>JSON.stringify(x)).sort());let h=2166136261;
 for(const c of texto)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
 return 'sync-encerrados-'+h.toString(16);
}
