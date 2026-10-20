import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {identidadeFisica} from '../integracao/marcos-romaneios-fechados.mjs';
const html=readFileSync(new URL('../integracao/central-conexao.html',import.meta.url),'utf8');
const start=html.indexOf('async function guardarHistoricoEncerradosRecebidos(');
const source=html.slice(start,html.indexOf('async function aplicarUniaoSeguraOperacional()',start)).replace("await import('./marcos-romaneios-fechados.mjs')",'await carregarMarcos()');
function ambiente(inicial=[],falhar=false){
 const dados=new Map(inicial),c={carregarMarcos:async()=>({identidadeFisica}),canonico:JSON.stringify};let gravacoes=0;
 const db={close(){},transaction(nome,modo){let abortada=false;const tx={abort(){abortada=true;queueMicrotask(()=>tx.onabort?.())},objectStore(){return{get(chave){const r={};queueMicrotask(()=>{r.result=dados.get(chave);r.onsuccess?.();if(modo==='readwrite'&&!abortada)queueMicrotask(()=>tx.oncomplete?.())});return r;},put(valor,chave){if(falhar){abortada=true;tx.error=Error('Histórico indisponível');queueMicrotask(()=>tx.onerror?.());return;}dados.set(chave,structuredClone(valor));gravacoes++;}}}};return tx;}};
 c.indexedDB={open(){const r={result:db};queueMicrotask(()=>r.onsuccess());return r;}};
 runInNewContext(source,c);return {salvar:c.guardarHistoricoEncerradosRecebidos,dados,gravacoes:()=>gravacoes};
}
const linha={registroId:'antigo',data:'19/10/2026',destino:'Taeque',palete:'8',sku:'5002',loteCompleto:'L24',caixas:45};
const arquivo={id:'reconciliado',data:'2026-10-20T12:00:00Z',entradas:[linha],pendencias:[],caminhoes:{8:'ABC'},historicoCaminhoes:{}};
test('cópia histórica preserva entradas e dados de caminhão antes de permitir arquivamento',async()=>{const a=ambiente();const r=await a.salvar(arquivo,[]);assert.equal(r.id,arquivo.id);assert.deepEqual(a.dados.get('fechamento-reconciliado'),arquivo);assert.equal(a.gravacoes(),1)});
test('histórico já existente é reutilizado sem criar duplicata',async()=>{const antigo={...arquivo,id:'original'};const a=ambiente([['fechamento-original',antigo]]);const r=await a.salvar(arquivo,[{id:'original'}]);assert.equal(r.id,'original');assert.equal(a.gravacoes(),0);assert.equal(a.dados.size,1)});
test('falha na cópia impede confirmação de arquivamento',async()=>{const a=ambiente([],true);await assert.rejects(a.salvar(arquivo,[]),/Histórico indisponível/);assert.equal(a.gravacoes(),0)});
test('mesmo ID de histórico com conteúdo diferente não sobrescreve cópia',async()=>{const antigo={...arquivo,entradas:[{...linha,caixas:99}]};const a=ambiente([['fechamento-reconciliado',antigo]]);await assert.rejects(a.salvar(arquivo,[]),/Histórico divergente/);assert.deepEqual(a.dados.get('fechamento-reconciliado'),antigo);assert.equal(a.gravacoes(),0)});
