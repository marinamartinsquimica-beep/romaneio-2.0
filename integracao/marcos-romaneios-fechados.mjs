// Marcador local de fechamento: evita reimportar movimentos antigos após
// "APAGAR TODO O ROMANEIO", sem impedir novas entradas com outro registroId.
export const CHAVE_FECHAMENTOS='romaneio2_registros_fechados_sync_v1';
const valor=x=>String(x??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
export const identidadeFisica=x=>JSON.stringify([
 valor(x?.data),valor(x?.palete),valor(x?.destino),valor(x?.sku),
 valor(x?.loteCompleto||x?.lote),valor(x?.postura),Number(x?.caixas)
]);
export function registrarFechamento(registros,anteriores=[],instante=new Date().toISOString(),{porVersao=false}={}){
 if(!Array.isArray(registros)||!Array.isArray(anteriores))throw Error('Fechamentos inválidos.');
 const referencia=Date.parse(instante);
 if(!Number.isFinite(referencia))throw Error('Horário de fechamento inválido.');
 const mapa=new Map(anteriores.filter(x=>x&&x.chave).map(x=>[x.chave,x]));
 for(const item of registros){
  const id=valor(item?.registroId);
  if(!id&&!item?.sku)continue;
  const chave=porVersao?'versao:'+id+':'+identidadeFisica(item):id?'id:'+id:'fisico:'+identidadeFisica(item);
  mapa.set(chave,{chave,registroId:id,fisica:identidadeFisica(item),fechadoEm:instante,...(porVersao?{porVersao:true}:{})});
 }
 return [...mapa.values()];
}
export function filtrarMovimentosJaFechados(eventos,fechamentos=[]){
 if(!Array.isArray(eventos)||!Array.isArray(fechamentos))throw Error('Dados de sincronização inválidos.');
 const ids=new Map(),fisicos=new Map(),versoes=new Map();
 for(const x of fechamentos){
  if(!x?.fechadoEm||!Number.isFinite(Date.parse(x.fechadoEm)))continue;
  const d=Date.parse(x.fechadoEm);
  if(x.porVersao){const k=valor(x.registroId)+'|'+x.fisica;versoes.set(k,Math.max(versoes.get(k)||0,d));continue;}
  if(x.registroId)ids.set(valor(x.registroId),Math.max(ids.get(valor(x.registroId))||0,d));
  if(x.fisica)fisicos.set(x.fisica,Math.max(fisicos.get(x.fisica)||0,d));
 }
 return eventos.filter(m=>{
  const horario=Date.parse(m?.criadoEm||'');
  if(!Number.isFinite(horario))return true; // Não presumir que evento sem horário é antigo.
  const id=valor(m?.item?.registroId||m?.antes?.registroId);
  const versao=id+'|'+identidadeFisica(m?.item);
  if(versoes.has(versao)&&horario<=versoes.get(versao))return false;
  if(id)return !(ids.has(id)&&horario<=ids.get(id));
  const fisica=identidadeFisica(m?.item);
  return !(fisicos.has(fisica)&&horario<=fisicos.get(fisica));
 });
}

