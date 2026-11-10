// Seleção explícita por origem e destino; nunca inferir baixa por falta de saldo.
import {criarIndiceCancelamentos} from './correcoes-lancamentos.mjs?v=2.0.123';
export const pendente=r=>!['BAIXA_CONCLUIDA','ARQUIVADA_APOS_CONFERENCIA'].includes(r?.estado);
export const chaveSelecao=(origem,destino)=>JSON.stringify([origem,String(destino)]);
export function fontesOperacionais({entradas,arquivo,fila=[]}){
 const cancelado=criarIndiceCancelamentos(arquivo,fila);
 const legadosEncerrados=new Set(arquivo.filter(r=>r.exclusaoLegadaLocal===true&&!r.registroId&&!pendente(r)).map(chaveVersao));
 const encerrado=r=>!r.registroId&&legadosEncerrados.has(chaveVersao(r));
 return {entradas:entradas.filter(r=>!cancelado(r)&&!encerrado(r)),arquivo:arquivo.filter(r=>pendente(r)&&!cancelado(r)&&!encerrado(r))};
}
export function selecionarRomaneios({entradas,arquivo,selecao,fila=[]}){
 ({entradas,arquivo}=fontesOperacionais({entradas,arquivo,fila}));
 const chaves=new Set(selecao);
 const ativos=entradas.filter(r=>chaves.has(chaveSelecao('ativo',r.destino)));
 const versoes=new Set(ativos.map(chaveVersao));
 // Uma cópia removida não soma novamente a mesma identidade ativa.
 const removidos=arquivo.filter(r=>pendente(r)&&chaves.has(chaveSelecao('arquivo',r.destino))&&!versoes.has(chaveVersao(r)));
 return [...ativos.map(r=>({...r,origemBaixa:'ativo'})),...removidos.map(r=>({...r,origemBaixa:'arquivo'}))];
}
export const chaveVersao=r=>JSON.stringify([r.registroId,...['data','destino','palete','sku'].map(k=>String(r[k]??'').trim()),String(r.loteCompleto||r.lote||'').trim(),String(r.postura??'').trim(),Number(r.caixas)]);
export const assinaturaRegistros=registros=>JSON.stringify(registros.map(r=>JSON.stringify([
 r.registroId,r.movimentoExclusaoId,r.estado,r.destino,r.palete,r.sku,
 r.loteCompleto||r.lote,r.postura,Number(r.caixas),r.data
])).sort());
export function planejarExclusao({entradas,arquivo,selecao,agora,criarId,dispositivoId,fila=[]}){
 const registros=selecionarRomaneios({entradas,arquivo,selecao,fila});
 if(!registros.length)throw Error('Selecione pelo menos um romaneio.');
 const versoes=new Set(registros.map(chaveVersao));
 // Legados sem ID são encerrados localmente, com auditoria; não inventar
 // identidade remota nem exigir sincronizar um registro que já foi utilizado.
 const movimentos=registros.filter(r=>r.registroId).map(r=>({id:criarId(),dispositivoId,tipo:'exclusao',registroId:r.registroId,criadoEm:agora,estado:'pendente',
  item:{...r,finalidadeExclusao:'CORRECAO_LANCAMENTO',exclusaoSemBaixaOperador:true}}));
 const porVersao=new Map(movimentos.map(m=>[chaveVersao(m.item),m]));
 for(const r of registros)if(!r.registroId)porVersao.set(chaveVersao(r),{id:'local_'+criarId()});
 const encerrar=r=>({...r,estado:'ARQUIVADA_APOS_CONFERENCIA',arquivadaSemNovaBaixaEm:agora,
  motivoArquivo:'Romaneio excluído explicitamente pelo operador, sem baixa de estoque.',correcaoMovimentoId:porVersao.get(chaveVersao(r)).id,...(!r.registroId?{exclusaoLegadaLocal:true}:{})});
 const novoArquivo=arquivo.map(r=>versoes.has(chaveVersao(r))&&pendente(r)?encerrar(r):r);
 for(const r of registros)if(!novoArquivo.some(x=>chaveVersao(x)===chaveVersao(r)&&x.estado==='ARQUIVADA_APOS_CONFERENCIA'&&x.correcaoMovimentoId))novoArquivo.push(encerrar(r));
 return {registros,movimentos,arquivo:novoArquivo,entradas:entradas.filter(r=>!versoes.has(chaveVersao(r)))};
}
export function gravarExclusaoLocal(storage,plano,{filaKey,baseKey,arquivoKey,auditoriaKey,agora,extras={}}){
 const ler=(k,padrao)=>JSON.parse(storage.getItem(k)||JSON.stringify(padrao));
 const auditoria=ler(auditoriaKey,[]);
 auditoria.push({data:agora,tipo:'EXCLUSAO_ROMANEIOS_SEM_BAIXA',registros:plano.registros,movimentos:plano.movimentos.map(m=>m.id)});
 const valores={
  ...extras,[auditoriaKey]:auditoria,[filaKey]:[...ler(filaKey,[]),...plano.movimentos],
  [arquivoKey]:plano.arquivo,entradas:plano.entradas,[baseKey]:plano.entradas
 };
 const anteriores=Object.fromEntries(Object.keys(valores).map(k=>[k,storage.getItem(k)]));
 try{for(const [k,v] of Object.entries(valores))storage.setItem(k,JSON.stringify(v));}
 catch(e){for(const [k,v] of Object.entries(anteriores)){if(v===null)storage.removeItem(k);else storage.setItem(k,v);}throw e;}
}

