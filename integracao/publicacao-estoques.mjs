// Publicação centralizada e transacional de consultas de estoque.
// O chamador deve ser autenticado e autorizado pelas regras Firestore.
// Nenhuma baixa, ajuste ou escrita em planilha é executada aqui.
import {validarEstoqueOficial,podeSubstituirVersao} from './contrato-estoques.mjs';
export async function publicarEstoqueOficial({db,uid,tipo,dados,versaoEsperada,doc,runTransaction,autorizado,ambienteId=null}) {
 if(autorizado!==true)throw Error('Publicação não autorizada.');
 if(typeof uid!=='string'||!uid.trim())throw Error('Sessão obrigatória.');
 if(typeof doc!=='function'||typeof runTransaction!=='function')throw Error('Serviço de transações indisponível.');
 const novo=validarEstoqueOficial(dados,tipo);
 if(typeof versaoEsperada!=='string')throw Error('Informe a versão vigente esperada; use string vazia na primeira importação.');
 const ref=ambienteId ? doc(db,'romaneio_ambientes',ambienteId,'estoques_oficiais',tipo) : doc(db,'rom_v250_contas',uid,'estoques_oficiais',tipo);
 return runTransaction(db,async tx=>{
  const snap=await tx.get(ref);
  const atual=snap.exists()?snap.data():null;
  const atualVersao=atual?.versao||'';
  if(atualVersao!==versaoEsperada)throw Error('Estoque atualizado por outro operador. Recarregue a versão vigente antes de substituir.');
  podeSubstituirVersao(atual,novo);
  const payload={...novo,importadoEm:new Date().toISOString(),autorUid:uid};
  tx.set(ref,payload);
  return {tipo,versao:novo.versao,quantidadeLotes:novo.itens.length};
 });
}
