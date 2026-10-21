// Retenção SOMENTE das cópias locais de romaneios encerrados.
// Movimentos, comprovantes de baixa, fila, ativos e marcadores não são excluídos.
export const RETENCAO_HISTORICOS_MS=5*24*60*60*1000;
export const CHAVE_INDICE_HISTORICOS='romaneio2_historico_fechamentos_v1';
const terminal=x=>['BAIXA_CONCLUIDA','ARQUIVADA_APOS_CONFERENCIA'].includes(x?.estado);
export function podeExpirarHistorico(item,{agora=Date.now(),ativos=[],fila=[]}={}){
 const data=Date.parse(item?.data||'');
 if(!item?.id||!Number.isFinite(data)||agora-data<=RETENCAO_HISTORICOS_MS)return false;
 if(!Array.isArray(item.entradas)||!Array.isArray(item.pendencias))return false;
 if(item.pendencias.some(x=>!terminal(x)))return false;
 const ids=new Set(item.entradas.map(x=>String(x.registroId||'')).filter(Boolean));
 // Sem identidade não é seguro relacionar a cópia às movimentações pendentes.
 if(item.entradas.some(x=>!x.registroId))return false;
 return !ativos.some(x=>ids.has(String(x.registroId||'')))&&!fila.some(x=>ids.has(String(x.item?.registroId||x.antes?.registroId||'')));
}
export async function expirarHistoricosLocais({storage=localStorage,idb=indexedDB,agora=Date.now()}={}){
 const ler=(k)=>{const v=JSON.parse(storage.getItem(k)||'[]');if(!Array.isArray(v))throw Error('Retenção suspensa: armazenamento inválido.');return v;};
 const indice=ler(CHAVE_INDICE_HISTORICOS);
 const candidatos=indice.filter(x=>x?.id&&Number.isFinite(Date.parse(x.data))&&agora-Date.parse(x.data)>RETENCAO_HISTORICOS_MS);
 if(!candidatos.length)return 0;
 const ativosBrutos=storage.getItem('entradas'),filaBruta=storage.getItem('romaneio2_movimentos_pendentes_v1');
 const ativos=ler('entradas'),fila=ler('romaneio2_movimentos_pendentes_v1');
 const db=await new Promise((resolve,reject)=>{const r=idb.open('romaneio-2-backup-local',1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('copias'))r.result.createObjectStore('copias');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const removidos=new Set();
 try{
  await new Promise((resolve,reject)=>{
   const tx=db.transaction('copias','readwrite'),copias=tx.objectStore('copias');
   for(const ref of candidatos){
    const r=copias.get('fechamento-'+ref.id);
    r.onsuccess=()=>{
     if(storage.getItem('entradas')!==ativosBrutos||storage.getItem('romaneio2_movimentos_pendentes_v1')!==filaBruta){tx.abort();return;}
     const item=r.result;
     if(item?.id===ref.id&&item.data===ref.data&&podeExpirarHistorico(item,{agora,ativos,fila})){
      copias.delete('fechamento-'+ref.id);removidos.add(ref.id);
     }
    };
   }
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Dados mudaram durante a retenção; cópias preservadas.'));
  });
 }finally{db.close();}
 if(removidos.size){
  // Releitura preserva arquivos criados por outra aba durante a operação.
  const atuais=ler(CHAVE_INDICE_HISTORICOS);
  storage.setItem(CHAVE_INDICE_HISTORICOS,JSON.stringify(atuais.filter(x=>!removidos.has(x.id)||!candidatos.some(c=>c.id===x.id&&c.data===x.data))));
 }
 return removidos.size;
}
