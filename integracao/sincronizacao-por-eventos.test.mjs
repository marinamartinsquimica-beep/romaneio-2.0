import assert from 'node:assert/strict';
import {test} from 'node:test';
import {assinarPorAtividade,transacaoSinalizada} from './sincronizacao-por-eventos.mjs';
test('transação avisa somente quando grava, preservando a confirmação idempotente',async()=>{
 const documentos=new Map(),escritas=[];
 const doc=(_,...p)=>({path:p.join('/')});
 const runTransaction=async(_,f)=>f({get:async r=>({exists:()=>documentos.has(r.path),data:()=>documentos.get(r.path)}),set:(r,d)=>{documentos.set(r.path,d);escritas.push(r.path)},update:(r,d)=>documentos.set(r.path,{...documentos.get(r.path),...d})});
 const deps={db:{},doc,runTransaction,raiz:()=>['romaneio_ambientes','teste']};
 await transacaoSinalizada(deps,async tx=>tx.set(doc(null,'romaneio_ambientes','teste','movimentos','novo'),{id:'novo'}));
 assert.equal(documentos.get('romaneio_ambientes/teste/movimentos/novo').syncSeq,1);
 assert.equal(documentos.get('romaneio_ambientes/teste/sync_meta/atividade').movimentos,1);
 const antes=escritas.length;
 await transacaoSinalizada(deps,async tx=>tx.get(doc(null,'romaneio_ambientes','teste','movimentos','novo')));
 assert.equal(escritas.length,antes);
});
test('sem mudança não consulta; reconexão reutiliza cursor; falha não perde dados',async()=>{
 const cache=new Map(),storage={getItem:k=>cache.get(k)||null,setItem:(k,v)=>cache.set(k,v)};
 globalThis.location={origin:'https://teste'};
 globalThis.window={localStorage:storage,location};window.parent=window;
 let callback,consultas=0,falhar=false;const erros=[],imagens=[],remotos=[];
 const deps={db:{},raiz:['romaneio_ambientes','teste'],nome:'movimentos',
 doc:(_,...p)=>({path:p.join('/')}),
 collection:(_,...p)=>p.join('/'),where:(...x)=>x,orderBy:()=>null,limit:()=>null,startAfter:()=>null,
 query:(c,...f)=>({c,f}),onSnapshot:(_,cb)=>{callback=cb;return ()=>{}},
 getDocsFromServer:async q=>{consultas++;if(falhar)throw Error('sem resposta');const min=q.f[0][2],max=q.f[1][2];const docs=remotos.filter(d=>d.syncSeq>min&&d.syncSeq<=max).map(d=>({id:d.id,data:()=>d}));return {docs,size:docs.length}},
 getDocFromServer:async()=>{throw Error('estoque não solicitado')}};
 const ouvir=()=>assinarPorAtividade(deps,s=>imagens.push(s.docs.map(d=>d.id)),e=>erros.push(e));
 const tick=()=>new Promise(r=>setImmediate(r));
 let parar=ouvir();
 const avisar=n=>callback({exists:()=>true,data:()=>({sequencia:n,movimentos:n}),metadata:{fromCache:false,hasPendingWrites:false}});
 remotos.push({id:'um',syncSeq:1,criadoEm:'2026-11-10T10:00:00Z'});avisar(1);await tick();assert.equal(consultas,1);assert.deepEqual(imagens.at(-1),['um']);
 avisar(1);await tick();assert.equal(consultas,1);
 remotos.push({id:'dois',syncSeq:2,criadoEm:'2026-11-10T10:01:00Z'});falhar=true;avisar(2);await tick();assert.equal(erros.length,1);assert.equal(consultas,2);
 falhar=false;avisar(2);await tick();assert.deepEqual(imagens.at(-1),['um','dois']);assert.equal(consultas,3);
 parar();parar=ouvir();avisar(2);await tick();assert.equal(consultas,3);
 storage.setItem('romaneio2_ultimo_reinicio_local_v1','2026-11-10T10:00:30Z');avisar(2);await tick();assert.deepEqual(imagens.at(-1),['dois']);assert.equal(consultas,3);
 remotos.push({id:'edicao',syncSeq:3,tipo:'edicao',item:{registroId:'legado',caixas:3},antes:{registroId:'legado',caixas:2},criadoEm:'2026-11-10T10:02:00Z'});
 avisar(3);await tick();assert.equal(consultas,4);
 assert(imagens.at(-1).includes('base145_legado'));
 const guardado=JSON.parse([...cache.values()].find(v=>v.startsWith('{"cursor"')));
 assert.equal(guardado.dados.movimentos.base145_legado.item.caixas,2);
 parar();delete globalThis.window;delete globalThis.location;
});
