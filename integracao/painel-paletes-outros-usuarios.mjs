// Projeção somente leitura de paletes de OUTROS usuários do mesmo ambiente.
// Não grava em 'entradas', não mexe no fluxo celular ↔ computador da mesma conta.
import {recuperarPaletesRemotosSeguros} from './recuperar-paletes-remotos.mjs';
import {identidadeExpedicaoBaixa} from './baixa-transacional.mjs';
import {filtrarMovimentosJaFechados} from './marcos-romaneios-fechados.mjs';
const id=x=>String(x??'').trim();
export function paletesOutrosUsuarios({movimentos,uidAtual,entradasLocais=[],fechamentos=[],expedicoes=[],incluirProprios=false}){
 if(!uidAtual||!Array.isArray(movimentos)||!Array.isArray(entradasLocais)||
    !Array.isArray(fechamentos)||!Array.isArray(expedicoes))throw Error('Consulta compartilhada inválida.');
 const autores=new Map();
 for(const m of movimentos){
  if(m?.tipo==='inclusao'&&m?.item?.registroId&&m.autorUid){
   const k=id(m.item.registroId);
   if(!autores.has(k))autores.set(k,id(m.autorUid));
  }
 }
 const validos=filtrarMovimentosJaFechados(movimentos,fechamentos);
 const conferidos=recuperarPaletesRemotosSeguros(validos,entradasLocais);
 const baixadas=new Set(expedicoes.filter(x=>x?.estado==='BAIXA_CONCLUIDA').map(x=>id(x.id)).filter(Boolean));
 const remotos=conferidos.remotos.filter(x=>{
  const autor=autores.get(id(x.registroId));
  if(!autor||(!incluirProprios&&autor===uidAtual))return false;
  if(baixadas.has(identidadeExpedicaoBaixa(x,true).id))return false;
  return true;
 });
 return {remotos,incertos:conferidos.incertos};
}
