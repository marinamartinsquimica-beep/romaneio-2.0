import test from 'node:test';
import assert from 'node:assert/strict';
import {conferirEstoques} from './conferencia-estoques.mjs';
const e=(sku,lote,saldo)=>({sku,lote,saldo,postura:'17.10.26'});
test('lotes zerados e ausentes no PariPassu nao sao pendencias nem conformes',()=>{
 const r=conferirEstoques([e('11796','L29.09.17.10.26',0),e('11796','L30.10.17.10.26',0)],[]);
 assert.equal(r.conferidos,0);assert.equal(r.conformes,0);assert.deepEqual(r.pendencias,[]);
});
test('lotes zerados no Embalado nao exigem correspondencia no PariPassu',()=>{
 const r=conferirEstoques([e('11796','L29',0),e('3826','L27',10)],[e('3826','L27',6.667)]);
 assert.equal(r.conferidos,1);assert.equal(r.pendencias.length,1);
 assert.equal(r.pendencias[0].sku,'3826');assert.ok(Math.abs(r.pendencias[0].diferenca-3.333)<0.001);
});
test('lote com saldo positivo e ausente continua sendo pendencia',()=>{
 const r=conferirEstoques([e('3826','L27',10)],[]);
 assert.equal(r.conferidos,1);assert.equal(r.pendencias[0].tipo,'ausente_paripassu');
});
test('saldo zero nao esconde saldo positivo de outra linha mesmo SKU/lote',()=>{
 const r=conferirEstoques([e('11796','L29',0),e('11796','L29',5)],[]);
 assert.equal(r.conferidos,1);assert.equal(r.pendencias.length,1);assert.equal(r.pendencias[0].embalado,5);
});
test('a conferencia nao altera os dados oficiais de estoque',()=>{
 const original=[e('11796','L29',0),e('3826','L27',10)];const antes=JSON.stringify(original);
 conferirEstoques(original,[]);assert.equal(JSON.stringify(original),antes);
});
