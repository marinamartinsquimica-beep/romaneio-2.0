import test from 'node:test';
import assert from 'node:assert/strict';
import {File} from 'node:buffer';
import {resolverModeloEmbalado} from './modelo-estoque-persistente.mjs';
globalThis.File??=File;
const arquivo=()=>new File(['modelo intacto'],'estoque.xlsx');
test('arquivo original inacessível usa bytes preservados no navegador',async()=>{
 const memoria={arrayBuffer:async()=>{throw Error('The requested file could not be read')}};
 const r=await resolverModeloEmbalado({memoria,recuperar:async()=>arquivo()});
 assert.equal(await r.text(),'modelo intacto');assert.equal(r.name,'estoque.xlsx');
});
test('cópia legível em memória mantém preferência e se torna independente',async()=>{
 const original=arquivo();const r=await resolverModeloEmbalado({memoria:original,recuperar:async()=>{throw Error('não consultar')}});
 assert.notEqual(r,original);assert.equal(await r.text(),await original.text());
});
test('sem cópia legível orienta nova seleção sem solicitar publicação ou baixa',async()=>{
 await assert.rejects(resolverModeloEmbalado({recuperar:async()=>null}),/Não é necessário publicar o estoque novamente/);
});
test('arquivo recém selecionado recupera exportação quando cópia persistida falha',async()=>{
 assert.equal(await (await resolverModeloEmbalado({selecionado:arquivo(),recuperar:async()=>{throw Error('falha local')}})).text(),'modelo intacto');
});
