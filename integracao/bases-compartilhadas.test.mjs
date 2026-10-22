import test from 'node:test';import assert from 'node:assert/strict';
import {criarColecaoIncremental} from './colecao-incremental.mjs';
import {adquirirBaseCompartilhada,metricasBasesCompartilhadas} from './bases-compartilhadas.mjs';
function ambiente(){let assinaturas=0,paradas=0,fonte;const escopo={};let online=true;
 const criar=callbacks=>criarColecaoIncremental({online:()=>online,esperaMs:5,assinar:(ok,erro)=>{assinaturas++;fonte={ok,erro};return ()=>paradas++;},...callbacks});
 const publicar=(id='a',cx=10,metadata={fromCache:false,hasPendingWrites:false})=>{const doc={id,data:()=>({caixas:cx})};fonte.ok({docs:[doc],size:1,metadata,docChanges:()=>[{type:'modified',doc}]});};
 return {escopo,criar,publicar,get assinaturas(){return assinaturas;},get paradas(){return paradas;},set online(v){online=v;}};
}
test('painel e Central reutilizam uma assinatura e ambos recebem mudanças',async()=>{
 const a=ambiente();let painel=0,central=0;
 const p=adquirirBaseCompartilhada({chave:'u:amb:movimentos',criar:a.criar,escopo:a.escopo,aoMudar:()=>painel++});
 a.publicar();const c=adquirirBaseCompartilhada({chave:'u:amb:movimentos',criar:a.criar,escopo:a.escopo,aoMudar:()=>central++});
 await new Promise(r=>setImmediate(r));assert.equal(a.assinaturas,1);assert.equal(central,1);
 a.publicar('a',20);assert.equal((await c.ler()).docs[0].data().caixas,20);assert.equal(painel,2);assert.equal(central,2);
 p.parar();assert.equal(a.paradas,0);c.parar();assert.equal(a.paradas,1);assert.equal(metricasBasesCompartilhadas(a.escopo).length,0);
});
test('contas e ambientes distintos não compartilham dados',()=>{
 const a=ambiente();const refs=['u:a:movimentos','v:a:movimentos','u:b:movimentos'].map(chave=>adquirirBaseCompartilhada({chave,criar:a.criar,escopo:a.escopo}));assert.equal(a.assinaturas,3);refs.forEach(r=>r.parar());
});
test('offline bloqueia leitura e reconexão duplicada reinicia apenas uma vez',async()=>{
 const a=ambiente();const p=adquirirBaseCompartilhada({chave:'u:a:expedicoes',criar:a.criar,escopo:a.escopo}),c=adquirirBaseCompartilhada({chave:'u:a:expedicoes',criar:a.criar,escopo:a.escopo});a.publicar();
 a.online=false;p.invalidar();c.invalidar();await assert.rejects(p.ler(),/Sem conexão/);
 a.online=true;p.reconectar();c.reconectar();assert.equal(a.assinaturas,2);await assert.rejects(c.ler(),/confirmação/);a.publicar();assert.equal((await c.ler()).size,1);p.parar();c.parar();
});
