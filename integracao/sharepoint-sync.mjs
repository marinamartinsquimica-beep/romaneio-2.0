import {readAllSharePointRecords,writeSharePointRecord} from './sharepoint-client.mjs';
const QUEUE='romaneio2_movimentos_pendentes_v1';
const ARCHIVE='romaneio2_expedicoes_excluidas_pendentes_v1';
const canonical=x=>JSON.stringify(x,(k,v)=>k==='syncSeq'?undefined:v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
function queue(){const value=JSON.parse(localStorage.getItem(QUEUE)||'[]');if(!Array.isArray(value))throw Error('Fila local inválida.');return value;}
function itemOf(x){return x?.payload?.item||x?.item||null;}
export async function sendPendingSharePoint(){
 const pending=queue();if(!pending.length)return {sent:0,pending:0,message:'Nenhuma movimentação aguardando envio.'};
 const remote=await readAllSharePointRecords(),byId=new Map(remote.filter(x=>x.recordType==='movement').map(x=>[x.title,x]));
 const confirmed=new Set(),conflicts=[];
 for(const op of pending){
  const id=String(op?.id||'');if(!id){conflicts.push('Operação sem identificador estável.');continue;}
  const payload={id,autor:op.autor||'',dispositivoId:String(op.dispositivoId||''),tipo:op.tipo,item:op.item||null,antes:op.antes||null,criadoEm:String(op.criadoEm||new Date().toISOString())};
  const old=byId.get(id);
  if(old){if(canonical(old.payload)===canonical(payload))confirmed.add(id);else conflicts.push(id+': identificador já existe com conteúdo diferente.');continue;}
  try{await writeSharePointRecord({id,type:'movement',payload});confirmed.add(id);}
  catch(error){
   if(/409|412|unique|duplic/i.test(String(error?.message||error))){
    const check=(await readAllSharePointRecords()).find(x=>x.recordType==='movement'&&x.title===id);
    if(check&&canonical(check.payload)===canonical(payload))confirmed.add(id);else conflicts.push(id+': '+String(error?.message||error));
   }else conflicts.push(id+': '+String(error?.message||error));
  }
 }
 const left=pending.filter(x=>!confirmed.has(String(x?.id||'')));
 localStorage.setItem(QUEUE,JSON.stringify(left));
 return {sent:confirmed.size,pending:left.length,conflicts,message:'Enviadas: '+confirmed.size+' | Pendentes: '+left.length+(conflicts.length?' | Revisar: '+conflicts.slice(0,2).join('; '):'')};
}
function sameRecord(a,b){return canonical(a)===canonical(b);}
function stableState(x){return JSON.stringify([x?.data,x?.sku,x?.destino,x?.palete,x?.loteCompleto,x?.lote,x?.postura,x?.caixas,x?.observacoes]);}
export async function receiveSharePointMovements(){
 const remote=(await readAllSharePointRecords()).filter(x=>x.recordType==='movement').sort((a,b)=>String(a.payload?.criadoEm||'').localeCompare(String(b.payload?.criadoEm||'')));
 const original=JSON.parse(localStorage.getItem('entradas')||'[]');
 if(!Array.isArray(original))throw Error('Entradas locais inválidas; nada foi alterado.');
 const result=[...original],conflicts=[],archive=JSON.parse(localStorage.getItem(ARCHIVE)||'[]');
 if(!Array.isArray(archive))throw Error('Histórico local inválido; nada foi alterado.');
 const archived=new Set(archive.map(x=>String(x.movimentoExclusaoId||'')));
 let added=0,edited=0,excluded=0;
 for(const record of remote){
  const mov=record.payload||{},id=String(mov.id||record.title||''),event=String(mov.tipo||''),item=mov.item||null,antes=mov.antes||null;
  if(!id||!item&&event!=='exclusao')continue;
  const regId=String(item?.registroId||antes?.registroId||'');
  const byReg=result.map((x,i)=>({x,i})).filter(x=>regId&&String(x.x?.registroId||'')===regId);
  if(event==='inclusao'){
   if(byReg.length===0&&item){result.push(item);added++;continue;}
   if(byReg.length===1&&sameRecord(byReg[0].x,item))continue;
   conflicts.push(id+': inclusão já existe localmente com divergência; preservada.');
   continue;
  }
  if(event==='edicao'){
   if(byReg.length!==1||!antes){conflicts.push(id+': edição sem correspondência local única; preservada.');continue;}
   if(stableState(byReg[0].x)===stableState(item)){continue;}
   if(stableState(byReg[0].x)!==stableState(antes)){conflicts.push(id+': estado local diferente; edição preservada para conferência.');continue;}
   result[byReg[0].i]={...item};edited++;continue;
  }
  if(event==='exclusao'){
   if(!archived.has(id)&&item){archive.push({...item,excluidoEm:mov.criadoEm||'',movimentoExclusaoId:id,estado:'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA'});archived.add(id);excluded++;}
  }
 }
 if(JSON.stringify(result)!==JSON.stringify(original)){
  localStorage.setItem('entradas',JSON.stringify(result));
  localStorage.setItem('romaneio2_ultimo_estado_movimentos_v1',JSON.stringify(result));
 }
 if(excluded)localStorage.setItem(ARCHIVE,JSON.stringify(archive));
 return {added,edited,excluded,conflicts,message:'Recebidos: '+added+' | Atualizados: '+edited+' | Exclusões para conferência: '+excluded+(conflicts.length?' | Conflitos: '+conflicts.slice(0,2).join('; '):'')};
}
export async function sincronizarMovimentos250(){return sendPendingSharePoint();}
export async function iniciarEnvioFilaMovimentos(){return sendPendingSharePoint();}
