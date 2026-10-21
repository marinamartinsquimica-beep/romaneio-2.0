import {parcelaComprovada} from './comprovante-baixa-agrupada.mjs?v=2.0.105';
// Conciliação somente leitura: nunca desconta estoque nem "confirma" uma baixa.
// Marca como concluída uma pendência local apenas com documento efetivamente
// BAIXA_CONCLUIDA no servidor, vinculado por ID estável da expedição.
import {identidadeExpedicaoBaixa} from './baixa-transacional.mjs';

const normalizar=x=>String(x??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
function mesmaExpedicao(local,remoto){
 if(!remoto||remoto.estado!=='BAIXA_CONCLUIDA')return false;
 if(normalizar(local.sku)!==normalizar(remoto.sku))return false;
 if(normalizar(local.loteCompleto||local.lote)!==normalizar(remoto.loteCompleto||remoto.lote))return false;
 if(!Number.isSafeInteger(Number(local.caixas))||Number(local.caixas)<=0||
    (Number(local.caixas)!==Number(remoto.caixas)&&!parcelaComprovada(local,remoto)))return false;
 // Estes campos impedem que paletes distintos do mesmo SKU sejam conciliados.
 for(const campo of ['destino','palete','registroId']){
  if(local[campo]!=null&&remoto[campo]!=null&&
     normalizar(local[campo])!==normalizar(remoto[campo]))return false;
 }
 return true;
}
export async function reconciliarPendenciasJaBaixadas(registros,buscar){
 if(!Array.isArray(registros))throw Error('Arquivo de expedições inválido.');
 if(typeof buscar!=='function')throw Error('Consulta online ao Firebase indisponível.');
 const atualizado=registros.map(x=>({...x}));
 const cache=new Map();
 const consultar=id=>{
  if(!cache.has(id))cache.set(id,Promise.resolve().then(()=>buscar(id)));
  return cache.get(id);
 };
 let concluidas=0;
 for(let inicio=0;inicio<atualizado.length;inicio+=12){
  const lote=atualizado.slice(inicio,inicio+12);
  await Promise.all(lote.map(async x=>{
   if(!x||x.estado==='BAIXA_CONCLUIDA'||x.estado==='ARQUIVADA_APOS_CONFERENCIA'||!x.sku||!(x.loteCompleto||x.lote))return;
   const referencias=[];
   if(x.movimentoExclusaoId)
    referencias.push(identidadeExpedicaoBaixa(x,false));
   if(x.registroId)
    referencias.push(identidadeExpedicaoBaixa({...x,movimentoExclusaoId:''},true));
   if(!referencias.length)return; // Identidade insuficiente: não inventar correspondência.
   for(const ref of referencias){
    const remoto=await consultar(ref.id);
    if(!mesmaExpedicao(x,remoto))continue;
    // ID, dados físicos e estado remoto comprovam a baixa anterior.
    x.estado='BAIXA_CONCLUIDA';
    x.baixaConfirmadaEm=remoto.baixaConfirmadaEm||x.baixaConfirmadaEm||'';
    x.confirmadoPor=remoto.confirmadoPor||x.confirmadoPor||'';
    x.referenciaBaixaConcluida=ref.id;
    concluidas++;
    break;
   }
  }));
 }
 return {registros:atualizado,concluidas,pendentes:atualizado.filter(x=>x?.estado!=='BAIXA_CONCLUIDA'&&x?.estado!=='ARQUIVADA_APOS_CONFERENCIA').length};
}
