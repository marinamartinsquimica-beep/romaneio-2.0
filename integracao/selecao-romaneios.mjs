// Seleção explícita por origem e destino; nunca inferir baixa por falta de saldo.
export const pendente=r=>!['BAIXA_CONCLUIDA','ARQUIVADA_APOS_CONFERENCIA'].includes(r?.estado);
export const chaveSelecao=(origem,destino)=>JSON.stringify([origem,String(destino)]);
export function selecionarRomaneios({entradas,arquivo,selecao}){
 const chaves=new Set(selecao);
 const ativos=entradas.filter(r=>chaves.has(chaveSelecao('ativo',r.destino)));
 const ids=new Set(ativos.map(r=>r.registroId).filter(Boolean));
 // Uma cópia removida não soma novamente a mesma identidade ativa.
 const removidos=arquivo.filter(r=>pendente(r)&&chaves.has(chaveSelecao('arquivo',r.destino))&&!ids.has(r.registroId));
 return [...ativos.map(r=>({...r,origemBaixa:'ativo'})),...removidos.map(r=>({...r,origemBaixa:'arquivo'}))];
}
export const assinaturaRegistros=registros=>JSON.stringify(registros.map(r=>JSON.stringify([
 r.registroId,r.movimentoExclusaoId,r.estado,r.destino,r.palete,r.sku,
 r.loteCompleto||r.lote,r.postura,Number(r.caixas),r.data
])).sort());
export function planejarExclusao({entradas,arquivo,selecao,agora,criarId,dispositivoId}){
 const registros=selecionarRomaneios({entradas,arquivo,selecao});
 if(!registros.length)throw Error('Selecione pelo menos um romaneio.');
 if(registros.some(r=>!r.registroId))throw Error('Há registros sem identificação. Sincronize antes de excluir.');
 const ids=new Set(registros.map(r=>r.registroId));
 if(ids.size!==registros.length)throw Error('Identificação repetida na seleção. Confira as linhas antes de excluir.');
 const fora=entradas.filter(r=>!new Set(selecao).has(chaveSelecao('ativo',r.destino)));
 if(fora.some(r=>ids.has(r.registroId)))throw Error('Uma identidade também aparece em romaneio não selecionado. Dados preservados.');
 const movimentos=registros.map(r=>({id:criarId(),dispositivoId,tipo:'exclusao',registroId:r.registroId,criadoEm:agora,estado:'pendente',
  item:{...r,finalidadeExclusao:'CORRECAO_LANCAMENTO'}}));
 const porId=new Map(movimentos.map(m=>[m.registroId,m]));
 const encerrar=r=>({...r,estado:'ARQUIVADA_APOS_CONFERENCIA',arquivadaSemNovaBaixaEm:agora,
  motivoArquivo:'Romaneio excluído explicitamente pelo operador, sem baixa de estoque.',correcaoMovimentoId:porId.get(r.registroId).id});
 const novoArquivo=arquivo.map(r=>ids.has(r.registroId)&&pendente(r)?encerrar(r):r);
 for(const r of registros)if(!novoArquivo.some(x=>x.registroId===r.registroId))novoArquivo.push(encerrar(r));
 return {registros,movimentos,arquivo:novoArquivo,entradas:entradas.filter(r=>!ids.has(r.registroId))};
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
