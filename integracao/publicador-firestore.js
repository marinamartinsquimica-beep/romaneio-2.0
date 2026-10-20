/* Adaptador Firestore 2.0.50. Injeção de dependências permite teste sem rede.
 * Coleção dedicada a movimentos; nenhuma escrita no estoque oficial.
 * Não habilitar em produção sem regras de segurança e testes ponta a ponta.
 */
import {prepararLoteMovimentos,reconciliarConfirmacoes} from './protocolo-movimentos.js?v=2.0.95';
const canonico=x=>JSON.stringify(x,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export function criarPublicadorMovimentos({transacionar,referencia,registrarErro,obterUsuario}){
 if([transacionar,referencia,registrarErro,obterUsuario].some(fn=>typeof fn!=='function'))throw new TypeError('Dependências ausentes');
 async function publicar(fila,{limite=50}={}){
  const usuario=obterUsuario();
  if(!usuario?.uid)throw new Error('Autenticação necessária; fila preservada');
  const {lote,rejeitados}=prepararLoteMovimentos(fila,{limite});
  const confirmacoes=[];
  for(const op of lote){
   try{
    // Cada ID tem documento imutável. Reenvio do mesmo ID é confirmação,
    // nunca uma segunda movimentação. Conteúdo divergente é conflito.
    const estado=await transacionar(async tx=>{
     const ref=referencia(op.id);
     const anterior=await tx.get(ref);
     const conteudo={id:op.id,autorUid:usuario.uid,dispositivoId:String(op.dispositivoId||''),tipo:op.tipo,item:op.item,antes:op.antes||null,criadoEm:String(op.criadoEm||'')};
     if(anterior.exists()){
      const remoto=anterior.data();
      if(canonico(remoto)!==canonico(conteudo))throw new Error('Conflito: mesmo ID com conteúdo diferente');
      return 'ja_existia';
     }
     tx.set(ref,conteudo);
     return 'gravado';
    });
    confirmacoes.push({id:op.id,confirmado:true,estado});
   }catch(e){
    const falha={id:op.id,mensagem:String(e?.message||e),codigo:String(e?.code||'')};
    registrarErro(falha);
    confirmacoes.push({...falha,confirmado:false});
   }
  }
  const reconciliado=reconciliarConfirmacoes(fila,confirmacoes);
  return {...reconciliado,confirmacoes,rejeitados};
 }
 return {publicar};
}
