import test from 'node:test';
import assert from 'node:assert/strict';
import {criarColecaoIncremental,LIMITE_COLECAO_INCREMENTAL} from './colecao-incremental.mjs';
const documento=(id,dados={})=>({id,data:()=>structuredClone(dados)});
function fonte(){
 let docs=new Map(),ouvintes=[],leituras=0,assinaturas=0;
 return {
  get leituras(){return leituras;},get assinaturas(){return assinaturas;},get ouvintes(){return ouvintes;},
  assinar(ok,erro){const o={ok,erro,ativa:true};ouvintes.push(o);assinaturas++;return ()=>{o.ativa=false;};},
  publicar(alteracoes=[],metadata={fromCache:false,hasPendingWrites:false}){
   for(const x of alteracoes){if(x.type==='removed')docs.delete(x.doc.id);else docs.set(x.doc.id,x.doc);}
   const primeiro=assinaturas&&ouvintes.at(-1).primeiro!==false;
   for(const o of ouvintes.filter(x=>x.ativa)){
    if(!metadata.fromCache&&!metadata.hasPendingWrites)leituras+=o.primeiro!==false?docs.size:alteracoes.length;
    o.ok({docs:[...docs.values()],size:docs.size,metadata,docChanges:()=>alteracoes});o.primeiro=false;
   }
  }
 };
}
const adicionar=(id,dados)=>({type:'added',doc:documento(id,dados)});
test('carga confirmada seguida de inclusão, edição e remoção sem nova consulta',async()=>{
 const f=fonte();let revisoes=0;
 const c=criarColecaoIncremental({assinar:f.assinar,aoMudar:()=>revisoes++});
 const espera=c.ler();f.publicar([adicionar('a',{caixas:13}),adicionar('b',{caixas:20})]);
 assert.equal((await espera).size,2);
 f.publicar([{type:'modified',doc:documento('a',{caixas:15})},adicionar('c',{caixas:3})]);
 assert.equal((await c.ler()).docs.find(d=>d.id==='a').data().caixas,15);
 f.publicar([{type:'removed',doc:documento('b')}]);
 assert.deepEqual((await c.ler()).docs.map(x=>x.id),['a','c']);
 for(let i=0;i<100;i++)await c.ler();
 assert.equal(f.assinaturas,1);assert.equal(f.leituras,5);assert.equal(revisoes,3);c.parar();
});
test('cache offline e gravação sem confirmação não autorizam união',async()=>{
 const f=fonte();const c=criarColecaoIncremental({assinar:f.assinar,esperaMs:5});
 f.publicar([adicionar('offline',{})],{fromCache:true,hasPendingWrites:false});
 await assert.rejects(c.ler(),/confirmação online/);
 f.publicar([],{fromCache:false,hasPendingWrites:true});await assert.rejects(c.ler(),/confirmação online/);
 f.publicar();assert.equal((await c.ler()).size,1);c.parar();
});
test('baixa alterada durante a sessão substitui a prova anterior no cache',async()=>{
 const f=fonte(),c=criarColecaoIncremental({assinar:f.assinar});
 f.publicar([adicionar('exp1',{estado:'PENDENTE_BAIXA'})]);const antes=await c.ler();
 f.publicar([{type:'modified',doc:documento('exp1',{estado:'BAIXA_CONCLUIDA'})}]);
 const depois=await c.ler();assert.ok(depois.revisao>antes.revisao);assert.equal(depois.docs[0].data().estado,'BAIXA_CONCLUIDA');c.parar();
});
test('reconexão exige servidor e ignora notificações atrasadas da conexão anterior',async()=>{
 const f=fonte(),c=criarColecaoIncremental({assinar:f.assinar,esperaMs:5});
 f.publicar([adicionar('a',{caixas:1})]);const antigo=f.ouvintes[0];c.reconectar();
 antigo.erro(Error('erro antigo'));
 antigo.ok({size:0,docs:[],metadata:{fromCache:false}});
 await assert.rejects(c.ler(),/confirmação online/);
 f.publicar([adicionar('b',{caixas:2})]);assert.equal((await c.ler()).size,2);c.parar();
});
test('erro e troca de sessão bloqueiam o uso da imagem antiga',async()=>{
 const f=fonte(),c=criarColecaoIncremental({assinar:f.assinar});f.publicar([adicionar('a',{})]);
 f.ouvintes[0].erro(Error('permission-denied'));await assert.rejects(c.ler(),/permission-denied/);
 c.parar();await assert.rejects(c.ler(),/Sessão/);
});
test('limite não trunca silenciosamente a base nem recebe parcialmente',async()=>{
 const f=fonte(),c=criarColecaoIncremental({assinar:f.assinar,limite:2});
 f.publicar([adicionar('a',{}),adicionar('b',{})]);await assert.rejects(c.ler(),/limite seguro/);c.parar();
});
test('simulação: 2 consumidores, 1000 movimentos, 200 expedições, 50 novas movimentações',async()=>{
 let total=0;
 for(let aparelho=0;aparelho<2;aparelho++){
  const m=fonte(),e=fonte(),cm=criarColecaoIncremental({assinar:m.assinar}),ce=criarColecaoIncremental({assinar:e.assinar});
  m.publicar(Array.from({length:1000},(_,i)=>adicionar('m'+i,{caixas:1})));
  e.publicar(Array.from({length:200},(_,i)=>adicionar('e'+i,{estado:'BAIXA_CONCLUIDA'})));
  for(let i=0;i<50;i++){
   m.publicar([adicionar('novo'+i,{caixas:2})]);
   // Todos os consumidores operacionais reutilizam a mesma imagem da sessão.
   for(let chamada=0;chamada<3;chamada++){await cm.ler();await ce.ler();}
  }
  total+=m.leituras+e.leituras;cm.parar();ce.parar();
 }
 assert.equal(total,2500);
});

test('limite padrão respeita o teto real de dez mil documentos por consulta',()=>{assert.equal(LIMITE_COLECAO_INCREMENTAL,10000);});
