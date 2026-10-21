// Base da sessão: uma carga inicial confirmada e deltas do mesmo acompanhamento.
// Não persiste nem apaga dados operacionais; cache offline não autoriza recepção.
export const LIMITE_COLECAO_INCREMENTAL=100000;
export function criarColecaoIncremental({assinar,aoMudar=()=>{},aoErro=()=>{},online=()=>true,limite=LIMITE_COLECAO_INCREMENTAL,esperaMs=15000}){
 let mapa=new Map(),pronta=false,encerrada=false,erro=null,cancelar=null,revisao=0,geracao=0;
 const esperas=new Set();
 const rejeitar=e=>{for(const p of esperas)p.reject(e);esperas.clear();};
 function iniciar(){
  const atual=++geracao;
  cancelar=assinar(snap=>{
   if(encerrada||atual!==geracao)return;
   if(snap.metadata.fromCache||snap.metadata.hasPendingWrites){pronta=false;return;}
   if(snap.size>=limite){falhar(Error('Base excede o limite seguro; recepção suspensa sem alterar dados.'));return;}
   const primeiro=!pronta;
   // Aplicar apenas documentos alterados. Após cache/reconexão, reconstruir
   // a imagem completa confirmada para não perder remoções ocorridas offline.
   let mudou=false;
   const proximos=primeiro?new Map():new Map(mapa);
   const alterados=primeiro?snap.docs.map(doc=>({type:'added',doc})):snap.docChanges({includeMetadataChanges:true});
   for(const {type,doc} of alterados){
    if(type==='removed'){mudou=proximos.delete(doc.id)||mudou;continue;}
    const anterior=mapa.get(doc.id);
    if(!anterior||JSON.stringify(anterior.data())!==JSON.stringify(doc.data()))mudou=true;
    proximos.set(doc.id,doc);
   }
   if(primeiro&&mapa.size!==proximos.size)mudou=true;
   mapa=proximos;pronta=true;erro=null;
   if(mudou||primeiro)revisao++;
   for(const p of esperas)p.resolve(imagem());esperas.clear();
   if(mudou||primeiro)aoMudar(imagem(),revisao);
  },e=>{if(atual===geracao)falhar(e);});
 }
 function falhar(e){if(encerrada)return;pronta=false;erro=e;rejeitar(e);aoErro(e);}
 function imagem(){const docs=[...mapa.values()];return {docs,size:docs.length,metadata:{fromCache:false,hasPendingWrites:false},revisao};}
 function ler(){
  if(encerrada)return Promise.reject(Error('Sessão de recebimento encerrada.'));
  if(!online())return Promise.reject(Error('Sem conexão; dados locais preservados.'));
  if(erro)return Promise.reject(erro);
  if(pronta)return Promise.resolve(imagem());
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{esperas.delete(p);reject(Error('Aguardando confirmação online; dados locais preservados.'));},esperaMs);
   const p={resolve:x=>{clearTimeout(timer);resolve(x);},reject:e=>{clearTimeout(timer);reject(e);}};
   esperas.add(p);
  });
 }
 function reconectar(){if(encerrada)return;pronta=false;erro=null;geracao++;cancelar?.();iniciar();}
 function parar(){encerrada=true;geracao++;cancelar?.();rejeitar(Error('Sessão alterada; dados locais preservados.'));mapa.clear();}
 iniciar();
 return {ler,parar,reconectar,invalidar(){pronta=false;},get revisao(){return revisao;}};
}
