/* Guarda a cópia exata do XLSX importado para baixa posterior, inclusive após reiniciar o navegador. */
const DB='romaneio2-arquivos-oficiais', STORE='arquivos', KEY='estoque-embalado';
function abrir(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function operar(mode,value){const db=await abrir();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),os=tx.objectStore(STORE),req=value===undefined?os.get(KEY):os.put(value,KEY);let result;req.onsuccess=()=>{result=req.result};req.onerror=()=>reject(req.error);tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Gravação local cancelada'))})}finally{db.close()}}
export async function guardarModeloEmbalado(file){if(!file||!/(xlsx)$/i.test(file.name))throw Error('Selecione arquivo .xlsx do Estoque Embalado.');const bytes=await file.arrayBuffer();await operar('readwrite',{name:file.name,type:file.type||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',bytes,guardadoEm:new Date().toISOString()});return file.name}
export async function recuperarModeloEmbalado(){const x=await operar('readonly');return x?new File([x.bytes],x.name,{type:x.type}):null}

// Arquivos selecionados podem perder acesso quando o original é movido ou
// substituído (inclusive pela sincronização da pasta). Exportar de bytes próprios.
export async function resolverModeloEmbalado({memoria,selecionado,recuperar=recuperarModeloEmbalado}={}){
 const copiar=async arquivo=>{
  if(!arquivo)return null;
  const bytes=await arquivo.arrayBuffer();
  if(!bytes.byteLength)throw Error('Modelo Excel vazio.');
  return new File([bytes],arquivo.name,{type:arquivo.type||'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 };
 try{const copia=await copiar(memoria);if(copia)return copia;}catch{}
 try{const copia=await copiar(await recuperar());if(copia)return copia;}catch{}
 if(selecionado!==memoria)try{const copia=await copiar(selecionado);if(copia)return copia;}catch{}
 throw Error('Não foi possível ler a cópia do Excel. Selecione novamente o Estoque Embalado em IMPORTAR PLANILHAS e tente gerar o Excel. Não é necessário publicar o estoque novamente. Nenhum saldo foi alterado.');
}
