// Seleção explícita por origem e destino; nunca inferir baixa por falta de saldo.
import {registroCanceladoPorCorrecao} from './correcoes-lancamentos.mjs?v=2.0.121';
export const pendente=r=>!['BAIXA_CONCLUIDA','ARQUIVADA_APOS_CONFERENCIA'].includes(r?.estado);
export const chaveSelecao=(origem,destino)=>JSON.stringify([origem,String(destino)]);
export function fontesOperacionais({entradas,arquivo,fila=[]}){
 return {entradas:entradas.filter(r=>!registroCanceladoPorCorrecao(r,arquivo,fila)),arquivo:arquivo.filter(r=>pendente(r)&&!registroCanceladoPorCorrecao(r,arquivo,fila))};
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
 if(registros.some(r=>!r.registroId))throw Error('Há registros sem identificação. Sincronize antes de excluir.');
 const versoes=new Set(registros.map(chaveVersao));
 const movimentos=registros.map(r=>({id:criarId(),dispositivoId,tipo:'exclusao',registroId:r.registroId,criadoEm:agora,estado:'pendente',
  item:{...r,finalidadeExclusao:'CORRECAO_LANCAMENTO',exclusaoSemBaixaOperador:true}}));
 const porVersao=new Map(movimentos.map(m=>[chaveVersao(m.item),m]));
 const encerrar=r=>({...r,estado:'ARQUIVADA_APOS_CONFERENCIA',arquivadaSemNovaBaixaEm:agora,
  motivoArquivo:'Romaneio excluído explicitamente pelo operador, sem baixa de estoque.',correcaoMovimentoId:porVersao.get(chaveVersao(r)).id});
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
