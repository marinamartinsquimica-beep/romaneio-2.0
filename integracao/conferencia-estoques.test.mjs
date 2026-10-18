import test from 'node:test';
import assert from 'node:assert/strict';
import {conferirEstoques} from './conferencia-estoques.mjs';
const a=[{sku:'A',lote:'1',saldo:10},{sku:'B',lote:'2',saldo:5}];
test('conformidade completa',()=>{const x=conferirEstoques(a,a);assert.equal(x.conformes,2);assert.equal(x.pendencias.length,0);});
test('saldo diferente',()=>{const x=conferirEstoques(a,[{sku:'A',lote:'1',saldo:9},{sku:'B',lote:'2',saldo:5}]);assert.equal(x.pendencias[0].tipo,'saldo_insuficiente_paripassu');assert.equal(x.pendencias[0].diferenca,1);});
test('conferencia unilateral: ignora itens exclusivos no PariPassu',()=>{const x=conferirEstoques(a,[{sku:'C',lote:'3',saldo:2}]);assert.equal(x.pendencias.length,2);assert.equal(x.conferidos,2);assert.equal(x.pendencias.every(p=>p.tipo==='ausente_paripassu'),true);});
test('linhas duplicadas consolidadas sem perder caixas',()=>{const x=conferirEstoques([{sku:'A',lote:'1',saldo:3},{sku:'A',lote:'1',saldo:7}],[{sku:'A',lote:'1',saldo:10}]);assert.equal(x.conformes,1);});
test('nao altera originais',()=>{const x=JSON.stringify(a);conferirEstoques(a,[]);assert.equal(JSON.stringify(a),x);});
test('rejeita saldos invalidos',()=>assert.throws(()=>conferirEstoques([{sku:'A',lote:'1',saldo:-1}],[])));

test('PariPassu maior que Embalado é OK, sem aviso',()=>{const x=conferirEstoques([{sku:'A',lote:'1',postura:'01/10/2026',saldo:5}],[{sku:'A',lote:'1',postura:'01/10/2026',saldo:8}]);assert.equal(x.pendencias.length,0);assert.equal(x.conformes,1);});
test('PariPassu menor que Embalado gera pendência',()=>{const x=conferirEstoques([{sku:'A',lote:'1',postura:'01/10/2026',saldo:8}],[{sku:'A',lote:'1',postura:'01/10/2026',saldo:5}]);assert.equal(x.pendencias.length,1);assert.equal(x.pendencias[0].diferenca,3);});
test('lote completo com postura embutida difere e gera ausência',()=>{const x=conferirEstoques([{sku:'A',lote:'L25.03.12.10.26',saldo:4}],[{sku:'A',lote:'L25.03.13.10.26',saldo:9}]);assert.equal(x.pendencias[0].tipo,'ausente_paripassu');});
test('sem coluna postura no PariPassu não cria ausência falsa para o mesmo lote completo',()=>{const x=conferirEstoques([{sku:'A',lote:'L25.03.12.10.26',postura:'12/10/2026',saldo:4}],[{sku:'A',lote:'L25.03.12.10.26',saldo:9}]);assert.equal(x.pendencias.length,0);});
