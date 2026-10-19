// Recebimento somente de estados finais verificáveis por registroId.
// Eventos incompletos não geram paletes sintéticos e exclusões permanecem arquivadas.
const str=x=>String(x??'').trim();
const identidade=x=>[x?.destino,x?.palete,x?.sku,x?.loteCompleto||x?.lote]
  .map(v=>str(v).toUpperCase()).join('|');
const estado=x=>[x?.data,x?.sku,x?.destino,x?.palete,x?.loteCompleto,x?.lote,x?.postura,x?.caixas,x?.observacoes]
  .map(v=>str(v)).join('|');
export function recuperarPaletesRemotosSeguros(eventos,locais=[]){
 if(!Array.isArray(eventos)||!Array.isArray(locais))throw Error('Histórico inválido.');
 const grupos=new Map(),incertos=[],remotos=[];
 const ordenados=eventos.filter(e=>e&&e.item&&['inclusao','edicao','exclusao'].includes(e.tipo))
  .sort((a,b)=>str(a.criadoEm).localeCompare(str(b.criadoEm))||str(a.id).localeCompare(str(b.id)));
 for(const evento of ordenados){
  const id=str(evento.item?.registroId||evento.antes?.registroId);
  if(!id)continue;
  const g=grupos.get(id)||[];g.push(evento);grupos.set(id,g);
 }
 const idsLocais=new Set(locais.map(x=>str(x.registroId)).filter(Boolean));
 const identidadesLocais=new Set(locais.map(identidade));
 for(const [id,seq] of grupos){
  if(idsLocais.has(id))continue;
  let atual=null,validade=true,excluido=false;
  for(const evento of seq){
   if(evento.tipo==='inclusao'){
    if(atual){validade=false;break;}
    atual=evento.item;excluido=false;
   }else if(evento.tipo==='edicao'){
    if(!atual||!evento.antes||estado(atual)!==estado(evento.antes)){
     validade=false;break;
    }
    atual=evento.item;
   }else if(evento.tipo==='exclusao'){
    // Nunca importar um registro com exclusão final, ainda que o histórico
    // tenha lacunas anteriores; evitar ressuscitar paletes excluídos no celular.
    excluido=true;atual=null;
   }
  }
  if(excluido)continue;
  if(!validade||!atual){incertos.push(id);continue;}
  if(!str(atual.destino)||!str(atual.sku)||!str(atual.loteCompleto||atual.lote)||
     !str(atual.palete)||!Number.isSafeInteger(Number(atual.caixas))||Number(atual.caixas)<=0){
    incertos.push(id);continue;
  }
  if(identidadesLocais.has(identidade(atual))){incertos.push(id);continue;}
  remotos.push({...atual,registroId:id});
 }
 return {remotos,incertos};
}
