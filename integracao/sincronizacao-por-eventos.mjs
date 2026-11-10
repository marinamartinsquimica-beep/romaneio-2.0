// Um documento de atividade avisa mudanças; coleções são consultadas apenas por sequência.
// A cópia e o cursor são gravados juntos. Uma falha não avança o cursor.
export async function transacaoSinalizada({db,doc,runTransaction,raiz},executar,opcoes){
 const caminho=raiz();
 return runTransaction(db,async tx=>{
  const ref=doc(db,...caminho,'sync_meta','atividade'),snap=await tx.get(ref);
  const anterior=snap.exists()?snap.data():{};
  const seq=(Number(anterior.sequencia)||0)+1,escritas=[];
  const proxy={get:r=>tx.get(r),set:(...a)=>escritas.push(['set',...a]),update:(...a)=>escritas.push(['update',...a]),delete:(...a)=>escritas.push(['delete',...a])};
  const resultado=await executar(proxy),mudancas={};
  for(const [metodo,r,dados,...resto] of escritas){
   const partes=r.path.split('/'),colecao=partes[2],id=partes[3];
   const pertence=partes.slice(0,2).join('/')===caminho.join('/');
   if(pertence&&['movimentos','expedicoes'].includes(colecao)){
    mudancas[colecao]=seq;tx[metodo](r,{...dados,syncSeq:seq},...resto);
   }else{
    if(pertence&&colecao==='estoques_oficiais'&&['embalado','paripassu'].includes(id))mudancas[id]=seq;
    tx[metodo](r,dados,...resto);
   }
  }
  if(Object.keys(mudancas).length)tx.set(ref,{sequencia:seq,movimentos:Number(anterior.movimentos)||0,expedicoes:Number(anterior.expedicoes)||0,embalado:Number(anterior.embalado)||0,paripassu:Number(anterior.paripassu)||0,...mudancas});
  return resultado;
 },opcoes);
}
export const semSequencia=d=>{const {syncSeq,...conteudo}=d;return conteudo;};

export function assinarPorAtividade({db,raiz,nome,doc,collection,query,where,orderBy,limit,startAfter,getDocsFromServer,getDocFromServer,onSnapshot},ok,erro){
 let escopo=window;try{if(window.parent.location.origin===location.origin)escopo=window.parent;}catch{}
 const registro=escopo.__romaneioAtividade145||(escopo.__romaneioAtividade145=new Map());
 const chave=raiz.join('/');let feed=registro.get(chave);
 if(!feed){
  const armazenamento=escopo.localStorage,chaveCache='romaneio2_eventos145:'+chave;
  let estado;try{estado=JSON.parse(armazenamento.getItem(chaveCache)||'null');}catch{}
  estado=estado&&estado.cursor&&estado.dados?estado:{cursor:{},dados:{}};
  feed={ouvintes:new Map(),estado,confirmado:false,ocupado:false,alvo:{},parado:false};
  registro.set(chave,feed);
  const emitir=tipo=>{
   const dados=feed.estado.dados[tipo]||{};
   const meta={fromCache:false,hasPendingWrites:false};
   const snap=['embalado','paripassu'].includes(tipo)?{exists:()=>!!dados.versao,data:()=>dados,metadata:meta}:(()=>{
   const corte=Date.parse(armazenamento.getItem('romaneio2_ultimo_reinicio_local_v1')||'');
   const docs=Object.entries(dados).filter(([,d])=>!Number.isFinite(corte)||Date.parse(d.criadoEm||d.excluidoEm||'')>corte).map(([id,d])=>({id,data:()=>d}));
    return {docs,size:docs.length,metadata:meta,docChanges:()=>docs.map(d=>({type:'added',doc:d}))};
   })();
   for(const o of feed.ouvintes.get(tipo)||[])o.ok(snap);
  };
  feed.emitir=emitir;
  feed.buscar=async()=>{
   if(feed.ocupado){feed.pendente=true;return;}
   if(feed.parado||!feed.confirmado)return;
   feed.pendente=false;
   let falhou=false;
   feed.ocupado=true;
   try{
    for(const tipo of feed.ouvintes.keys()){
     const alvo=Number(feed.alvo[tipo])||0,atual=Number(feed.estado.cursor[tipo])||0;
     if(alvo<=atual){emitir(tipo);continue;}
     let dados={...(feed.estado.dados[tipo]||{})};
     if(['embalado','paripassu'].includes(tipo)){
      const s=await getDocFromServer(doc(db,...raiz,'estoques_oficiais',tipo));dados=s.exists()?s.data():{};
     }else{
      let ultimo=null;
      do{
       const filtros=[where('syncSeq','>',atual),where('syncSeq','<=',alvo),orderBy('syncSeq'),limit(500)];
       if(ultimo)filtros.push(startAfter(ultimo));
       const s=await getDocsFromServer(query(collection(db,...raiz,tipo),...filtros));
       for(const d of s.docs)dados[d.id]=d.data();
       ultimo=s.size===500?s.docs.at(-1):null;
      }while(ultimo&&!feed.parado);
     }
     // Uma edição nova de registro legado traz seu estado anterior completo.
     // Esse ponto de partida local evita consultar ou republicar o histórico.
     if(tipo==='movimentos'){
      const eventos=Object.values(dados).sort((a,b)=>String(a.criadoEm||'').localeCompare(String(b.criadoEm||'')));
      const inclusoes=new Set(eventos.filter(d=>d.tipo==='inclusao').map(d=>d.item?.registroId).filter(Boolean));
      for(const d of eventos)if(d.tipo==='edicao'&&d.antes&&d.item?.registroId&&!inclusoes.has(d.item.registroId)){
       const id='base145_'+d.item.registroId,instante=Date.parse(d.criadoEm);
       dados[id]={...d,id,tipo:'inclusao',item:d.antes,antes:null,criadoEm:Number.isFinite(instante)?new Date(instante-1).toISOString():d.criadoEm};
       inclusoes.add(d.item.registroId);
      }
     }
     if(feed.parado)return;
     const proximo={cursor:{...feed.estado.cursor,[tipo]:alvo},dados:{...feed.estado.dados,[tipo]:dados}};
     armazenamento.setItem(chaveCache,JSON.stringify(proximo));feed.estado=proximo;emitir(tipo);
    }
   }catch(e){falhou=true;for(const os of feed.ouvintes.values())for(const o of os)o.erro(e);}
   finally{feed.ocupado=false;}
   if(!falhou&&!feed.parado&&feed.pendente)queueMicrotask(()=>void feed.buscar());
  };
  feed.cancelar=onSnapshot(doc(db,...raiz,'sync_meta','atividade'),s=>{
   if(s.metadata.fromCache||s.metadata.hasPendingWrites)return;
   feed.confirmado=true;feed.alvo=s.exists()?s.data():{};void feed.buscar();
  },e=>{for(const os of feed.ouvintes.values())for(const o of os)o.erro(e);});
 }
 const consumidor={ok,erro},ouvintes=feed.ouvintes.get(nome)||new Set();
 ouvintes.add(consumidor);feed.ouvintes.set(nome,ouvintes);
 if(feed.confirmado)queueMicrotask(()=>void feed.buscar());
 return ()=>{ouvintes.delete(consumidor);if(!ouvintes.size)feed.ouvintes.delete(nome);if(!feed.ouvintes.size){feed.parado=true;feed.cancelar();registro.delete(chave);}};
}

