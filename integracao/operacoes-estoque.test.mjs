import test from 'node:test';import assert from 'node:assert/strict';
import {prepararBaixa,prepararAjuste,reavaliarConferencia} from './operacoes-estoque.mjs';
const estoque=()=>[{sku:'5008',lote:'L1',saldo:10},{sku:'5009',lote:'L2',saldo:5}];
test('baixa em prévia não altera origem',()=>{const origem=estoque(),r=prepararBaixa(origem,[{id:'a',sku:'5008',lote:'L1',caixas:3}]);assert.equal(r.itens[0].saldo,7);assert.equal(r.aplicados.length,1);assert.equal(origem[0].saldo,10);assert.equal(r.confirmada,false)});
test('movimento duplicado exige revisão',()=>assert.throws(()=>prepararBaixa(estoque(),[{id:'a',sku:'5008',lote:'L1',caixas:3},{id:'a',sku:'5008',lote:'L1',caixas:3}])));
test('saldo insuficiente permite baixa parcial sem saldo negativo',()=>{
 const r=prepararBaixa(estoque(),[{id:'a',sku:'5008',lote:'L1',caixas:11}]);
 assert.equal(r.aplicados[0].caixas,10);assert.equal(r.pendencias[0].caixas,1);
 assert.equal(r.itens[0].saldo,0);
});
test('contagem parcial só altera escopo',()=>{const r=prepararAjuste(estoque(),[{sku:'5008',lote:'L1',caixas:8}]);assert.equal(r.itens[0].saldo,8);assert.equal(r.itens[1].saldo,5);assert.equal(r.alteracoes.length,1);assert.equal(r.confirmado,false)});
test('contagem duplicada rejeitada',()=>assert.throws(()=>prepararAjuste(estoque(),[{sku:'5008',lote:'L1',caixas:2},{sku:'5008',lote:'L1',caixas:1}])));
test('pendência resolvida apenas quando nova conferência elimina diferença',()=>{const antes=[{sku:'5008',lote:'L1'}],r=reavaliarConferencia([{sku:'5008',lote:'L1',saldo:10}],[{sku:'5008',lote:'L1',saldo:10}],antes);assert.equal(r.resolvidas.length,1);assert.equal(r.pendencias.length,0)});

test('baixa parcial distribuída pelo saldo de cada SKU/lote e conserva origem',()=>{
 const original=[
  {sku:'3938',lote:'L21.15.13.10.26',saldo:8},
  {sku:'5008',lote:'L25.03.14.10.26',saldo:26},
  {sku:'3826',lote:'L32.18.13.10.26',saldo:0},
  {sku:'OUTRO',lote:'L000',saldo:1496}
 ];
 const r=prepararBaixa(original,[
  {id:'p1',sku:'3938',lote:'L21.15.13.10.26',caixas:10},
  {id:'p2',sku:'5008',lote:'L25.03.14.10.26',caixas:50},
  {id:'p3',sku:'3826',lote:'L32.18.13.10.26',caixas:16}
 ]);
 assert.deepEqual(r.aplicados.map(x=>x.caixas),[8,26]);
 assert.deepEqual(r.pendencias.map(x=>x.caixas),[2,24,16]);
 assert.equal(r.aplicados.reduce((a,x)=>a+x.caixas,0),34);
 assert.equal(r.pendencias.reduce((a,x)=>a+x.caixas,0),42);
 assert.deepEqual(r.itens.slice(0,3).map(x=>x.saldo),[0,0,0]);
 assert.equal(original[0].saldo,8);assert.equal(original[1].saldo,26);
});
test('dois paletes do mesmo SKU repartem corretamente as caixas sem duplicação',()=>{
 const r=prepararBaixa([{sku:'5008',lote:'L1',saldo:7}],[
  {id:'p1',sku:'5008',lote:'L1',caixas:3},
  {id:'p2',sku:'5008',lote:'L1',caixas:6}
 ]);
 assert.deepEqual(r.aplicados.map(x=>x.caixas),[3,4]);
 assert.deepEqual(r.pendencias.map(x=>x.caixas),[2]);
 assert.equal(r.itens[0].saldo,0);
});
