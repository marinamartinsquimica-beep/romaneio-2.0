import {erroTemporario} from './controle-tentativas.mjs?v=2.0.117';
/* Lotes atômicos e idempotentes; envia apenas movimentos para a coleção compartilhada. */
import {prepararLoteMovimentos,reconciliarConfirmacoes} from './protocolo-movimentos.js?v=2.0.97';
const canonico=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function criarPublicadorMovimentos({transacionar,referencia,registrarErro,obterUsuario}){
 if([transacionar,referencia,registrarErro,obterUsuario].some(fn=>typeof fn!=='function'))throw new TypeError('Dependências ausentes');
 async function publicar(fila,{limite=50}={}){
  const usuario=obterUsuario();
  if(!usuario?.uid)throw new Error('Autenticação necessária; fila preservada');
  const {lote,rejeitados}=prepararLoteMovimentos(fila,{limite});
  const confirmacoes=[];
  if(lote.length){
   try{
    const estados=await transacionar(async tx=>{
     // Firestore exige concluir todas as leituras antes de iniciar as gravações.
     const snapshots=[];
     for(const op of lote)snapshots.push(await tx.get(referencia(op.id)));
     const saida=lote.map((op,i)=>{
      const conteudo={id:op.id,autorUid:usuario.uid,dispositivoId:String(op.dispositivoId||''),tipo:op.tipo,item:op.item,antes:op.antes||null,criadoEm:String(op.criadoEm||'')};
      const anterior=snapshots[i];
      if(anterior.exists()){
       if(canonico(anterior.data())!==canonico(conteudo))return {id:op.id,confirmado:false,mensagem:'Conflito: mesmo ID com conteúdo diferente',codigo:'romaneio/conflito'};
       return {id:op.id,confirmado:true,estado:'ja_existia'};
      }
      return {id:op.id,confirmado:true,estado:'gravado',ref:referencia(op.id),conteudo};
     });
     for(const estado of saida)if(estado.ref)tx.set(estado.ref,estado.conteudo);
     return saida.map(({id,confirmado,estado,mensagem,codigo})=>({id,confirmado,estado,mensagem,codigo}));
    });
    confirmacoes.push(...estados);
   }catch(erroLote){
    if(erroTemporario(erroLote)){
     for(const op of lote){
      const falha={id:op.id,mensagem:String(erroLote?.message||erroLote),codigo:String(erroLote?.code||'')};
      registrarErro(falha);confirmacoes.push({...falha,confirmado:false});
     }
    }else{
     // Isole falhas permanentes para que um item problemático não bloqueie os demais.
     for(const op of lote){
      try{
       const estado=await transacionar(async tx=>{
        const ref=referencia(op.id),anterior=await tx.get(ref);
        const conteudo={id:op.id,autorUid:usuario.uid,dispositivoId:String(op.dispositivoId||''),tipo:op.tipo,item:op.item,antes:op.antes||null,criadoEm:String(op.criadoEm||'')};
        if(anterior.exists()){
         if(canonico(anterior.data())!==canonico(conteudo))throw new Error('Conflito: mesmo ID com conteúdo diferente');
         return 'ja_existia';
        }
        tx.set(ref,conteudo);return 'gravado';
       });
       confirmacoes.push({id:op.id,confirmado:true,estado});
      }catch(e){
       const falha={id:op.id,mensagem:String(e?.message||e),codigo:String(e?.code||'')};
       registrarErro(falha);confirmacoes.push({...falha,confirmado:false});
       if(erroTemporario(e))break;
      }
     }
    }
   }
  }
  const reconciliado=reconciliarConfirmacoes(fila,confirmacoes);
  return {...reconciliado,confirmacoes,rejeitados};
 }
 return {publicar};
}
