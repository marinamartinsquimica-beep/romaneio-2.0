import test from 'node:test';import assert from 'node:assert/strict';
import {prepararBaixa,prepararAjuste,reavaliarConferencia} from './operacoes-estoque.mjs';
const estoque=()=>[{sku:'5008',lote:'L1',saldo:10},{sku:'5009',lote:'L2',saldo:5}];
test('baixa em prévia não altera origem',()=>{const origem=estoque(),r=prepararBaixa(origem,[{id:'a',sku:'5008',lote:'L1',caixas:3}]);assert.equal(r.itens[0].saldo,7);assert.equal(r.aplicados.length,1);assert.equal(origem[0].saldo,10);assert.equal(r.confirmada,false)});
test('movimento duplicado exige revisão',()=>assert.throws(()=>prepararBaixa(estoque(),[{id:'a',sku:'5008',lote:'L1',caixas:3},{id:'a',sku:'5008',lote:'L1',caixas:3}])));
test('sem saldo não autoriza baixa negativa',()=>{const r=prepararBaixa(estoque(),[{id:'a',sku:'5008',lote:'L1',caixas:11}]);assert.equal(r.pendencias.length,1);assert.equal(r.itens[0].saldo,10)});
test('contagem parcial só altera escopo',()=>{const r=prepararAjuste(estoque(),[{sku:'5008',lote:'L1',caixas:8}]);assert.equal(r.itens[0].saldo,8);assert.equal(r.itens[1].saldo,5);assert.equal(r.alteracoes.length,1);assert.equal(r.confirmado,false)});
test('contagem duplicada rejeitada',()=>assert.throws(()=>prepararAjuste(estoque(),[{sku:'5008',lote:'L1',caixas:2},{sku:'5008',lote:'L1',caixas:1}])));
test('pendência resolvida apenas quando nova conferência elimina diferença',()=>{const antes=[{sku:'5008',lote:'L1'}],r=reavaliarConferencia([{sku:'5008',lote:'L1',saldo:10}],[{sku:'5008',lote:'L1',saldo:10}],antes);assert.equal(r.resolvidas.length,1);assert.equal(r.pendencias.length,0)});
