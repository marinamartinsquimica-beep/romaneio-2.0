import test from 'node:test';
import assert from 'node:assert/strict';
import {alinharModeloComEstoqueOficial} from '../integracao/baixa-modelo-aprovado.mjs';
const montar=(saldo=10)=>{const r={sku:'4998',lote:'L20.01.13.10.26',caixas:15,saidas:15-saldo,saldo};return {stock:{records:[r],map:new Map([['4998|L20.01.13.10.26',[r]]])},registro:r}};
test('concilia uma caixa sem mexer na entrada original',()=>{const {stock,registro}=montar(10);const log=alinharModeloComEstoqueOficial(stock,[{sku:'4998',lote:'L20.01.13.10.26',saldo:9}]);assert.equal(registro.saldo,9);assert.equal(registro.saidas,6);assert.equal(registro.caixas,15);assert.equal(log.length,1)});
test('mantém modelo já igual ao Firebase',()=>{const {stock}=montar(10);assert.deepEqual(alinharModeloComEstoqueOficial(stock,[{sku:'4998',lote:'L20.01.13.10.26',saldo:10}]),[])});
test('bloqueia aumento acima da entrada original',()=>{const {stock}=montar(10);assert.throws(()=>alinharModeloComEstoqueOficial(stock,[{sku:'4998',lote:'L20.01.13.10.26',saldo:20}]),/incompatível/)});
test('bloqueia lote novo que o modelo não possui',()=>{const {stock}=montar(10);assert.throws(()=>alinharModeloComEstoqueOficial(stock,[{sku:'4998',lote:'L20.01.13.10.26',saldo:10},{sku:'111',lote:'L01.01.01.10.26',saldo:1}]),/não presente/)});
test('bloqueia diferença ambígua com linhas repetidas',()=>{const {stock,registro}=montar(10);stock.map.get('4998|L20.01.13.10.26').push({...registro});assert.throws(()=>alinharModeloComEstoqueOficial(stock,[{sku:'4998',lote:'L20.01.13.10.26',saldo:9}]),/repetidas/)});
