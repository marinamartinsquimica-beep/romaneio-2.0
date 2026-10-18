// Gestão de cópias oficiais do Excel: vigente + anterior, sem excluir histórico operacional.
// A troca usa arquivos imutáveis por versão; somente após upload completo um documento
// Firestore transacional altera o ponteiro oficial. Versões antigas podem ser expurgadas
// posteriormente por rotina administrativa após prazo de recuperação.
import {ref,uploadBytes,getBlob} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';
import {doc,runTransaction} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const tipos=new Set(['embalado','paripassu']);
export function caminhoExcel({ambienteId,tipo,versao}){
 if(!/^[a-zA-Z0-9_-]{6,128}$/.test(String(ambienteId)))throw Error('Ambiente inválido.');
 if(!tipos.has(tipo))throw Error('Tipo inválido.');
 if(!/^[a-zA-Z0-9_-]{8,128}$/.test(String(versao)))throw Error('Versão inválida.');
 return 'romaneio_ambientes/'+ambienteId+'/excel/'+tipo+'/'+versao+'.xlsx';
}
export async function publicarExcelOficial({storage,db,ambienteId,tipo,arquivo,versaoEsperada='',autorUid}){
 if(!arquivo||!(/\.xlsx$/i).test(arquivo.name))throw Error('Arquivo .xlsx obrigatório.');
 if(arquivo.size<=0||arquivo.size>20*1024*1024)throw Error('Arquivo fora do limite de 20 MB.');
 if(!autorUid)throw Error('Autenticação obrigatória.');
 const versao=crypto.randomUUID(),local=caminhoExcel({ambienteId,tipo,versao});
 const referencia=ref(storage,local);
 // Regra Storage deve autorizar escrita uma única vez para a versão criada.
 await uploadBytes(referencia,arquivo,{contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',customMetadata:{autorUid,ambienteId,tipo,versao}});
 const documento=doc(db,'romaneio_ambientes',ambienteId,'excel_oficiais',tipo);
 try{
  return await runTransaction(db,async tx=>{
   const snap=await tx.get(documento),atual=snap.exists()?snap.data():null;
   if((atual?.vigente?.versao||'')!==versaoEsperada)throw Error('Outro operador substituiu o Excel. Atualize a versão antes de publicar.');
   const novo={versao,caminho:local,nome:arquivo.name,tamanho:arquivo.size,autorUid,publicadoEm:new Date().toISOString()};
   tx.set(documento,{tipo,vigente:novo,anterior:atual?.vigente||null,alteradoEm:novo.publicadoEm});
   return {vigente:novo,anterior:atual?.vigente||null};
  });
 }catch(e){
  // O arquivo recém-enviado permanece órfão e inacessível como oficial;
  // limpeza posterior é mais segura que apagar algo usado por outra operação.
  throw e;
 }
}
export async function recuperarExcelOficial({storage,caminho}){
 if(!/^romaneio_ambientes\/[a-zA-Z0-9_-]+\/excel\/(embalado|paripassu)\/[a-zA-Z0-9_-]+\.xlsx$/.test(caminho))throw Error('Arquivo oficial inválido.');
 return getBlob(ref(storage,caminho));
}
