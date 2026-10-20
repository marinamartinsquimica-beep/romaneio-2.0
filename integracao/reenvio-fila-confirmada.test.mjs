import test from 'node:test';
import assert from 'node:assert/strict';
import {criarPublicadorMovimentos} from './publicador-firestore.js';
import {criarSincronizadorFila} from './sincronizador-fila.js';
import {motivosFormatoOperacional} from './protocolo-movimentos.js';
const ordenar=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(ordenar):Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordenar(x[k])])):x;
const item={sku:'5002',loteCompleto:'L24.02.05.10.26',caixas:'20',palete:'7'};
const movimentos=['inclusao','exclusao','inclusao','edicao'].map((tipo,i)=>({id:'evento000'+i,dispositivoId:'aparelho',tipo,item:{...item,caixas:i===3?'8':'20'},antes:tipo==='edicao'?item:null,criadoEm:'2026-10-20T08:00:00Z'}));
function ambiente(){
 let fila=structuredClone(movimentos),writes=0;const erros=[];
 const docs=new Map(fila.map(x=>[x.id,ordenar({...x,autorUid:'operador'})]));
 const pub=criarPublicadorMovimentos({obterUsuario:()=>({uid:'operador'}),referencia:id=>id,registrarErro:e=>erros.push(e),transacionar:async f=>f({get:async id=>({exists:()=>docs.has(id),data:()=>docs.get(id)}),set(){writes++}})});
 const sync=criarSincronizadorFila({ler:()=>structuredClone(fila),gravar:x=>{fila=x},publicador:pub,avisar(){}});
 return {sync,docs,erros,fila:()=>fila,writes:()=>writes};
}
test('quatro eventos já recebidos com campos reordenados saem da fila sem nova gravação',async()=>{const a=ambiente(),r=await a.sync.executar();assert.equal(r.confirmados,4);assert.equal(a.fila().length,0);assert.equal(a.writes(),0)});
test('diferença real de quantidade e de autor continua como conflito com motivo legível',async()=>{const a=ambiente();a.docs.get('evento0000').item.caixas='21';a.docs.get('evento0001').autorUid='outro';const r=await a.sync.executar();assert.equal(r.confirmados,2);assert.equal(r.pendentes,2);assert.equal(r.falhas.length,2);assert.match(r.falhas[0].mensagem,/Conflito/);assert.equal(a.writes(),0)});
test('validação explica dispositivo ausente sem inventar identificador nem alterar evento',()=>{const op={...movimentos[0],dispositivoId:''},antes=structuredClone(op);assert.match(motivosFormatoOperacional(op).join(' '),/aparelho/);assert.deepEqual(op,antes);assert.deepEqual(motivosFormatoOperacional(movimentos[0]),[])});
