import {identidadeExpedicaoBaixa} from './baixa-transacional.mjs';

// Seleção somente leitura: nunca rebaixa uma expedição BAIXA_CONCLUIDA.
// buscar(id) deve consultar o servidor, não o cache local.
export async function filtrarExpedicoesJaBaixadas({registros,destino,buscar}){
 if(!Array.isArray(registros)||!registros.length)throw Error('Nenhum romaneio selecionado.');
 if(typeof buscar!=='function')throw Error('Consulta ao Firebase indisponível.');
 const ativos=destino==='TODOS OS DESTINOS'&&registros.every(x=>!x.movimentoExclusaoId);
 const pendentes=[],concluidos=[];
 for(let inicio=0;inicio<registros.length;inicio+=15){
  const lote=registros.slice(inicio,inicio+15);
  const estados=await Promise.all(lote.map(async registro=>{
   if(!registro||!registro.sku||!(registro.loteCompleto||registro.lote))
    throw Error('Romaneio incompleto para verificar baixas anteriores.');
   const principal=identidadeExpedicaoBaixa(registro,ativos);
   let encontrado=await buscar(principal.id);
   // Um registro baixado antes da exclusão mantém o ID ativo_<registroId>.
   if(registro.movimentoExclusaoId&&registro.registroId&&!encontrado){
    const anterior=identidadeExpedicaoBaixa({...registro,movimentoExclusaoId:''},true);
    const finalizado=await buscar(anterior.id);
    if(finalizado?.estado==='BAIXA_CONCLUIDA')encontrado=finalizado;
   }
   if(encontrado?.estado==='BAIXA_CONCLUIDA'){
    if(String(encontrado.sku||'')!==String(registro.sku||'')||
       String(encontrado.loteCompleto||encontrado.lote||'')!==String(registro.loteCompleto||registro.lote||'')||
       Number(encontrado.caixas)!==Number(registro.caixas))
      throw Error('Registro já baixado com dados divergentes. Confira o histórico antes de continuar.');
    return {registro,concluido:true};
   }
   if(encontrado&&encontrado.estado!=='PENDENTE_BAIXA')
    throw Error('Expedição com estado desconhecido no Firebase. Conferência bloqueada.');
   return {registro,concluido:false};
  }));
  for(const item of estados)(item.concluido?concluidos:pendentes).push(item.registro);
 }
 return {pendentes,concluidos};
}
