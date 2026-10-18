import test from 'node:test';
import assert from 'node:assert/strict';
import {extrairParipassu} from './leitor-paripassu.mjs';
import {conferirEstoques} from './conferencia-estoques.mjs';
const cab=['Empresa','Código de Rastreamento','Lote','Tipo Produto','Capacidade da Embalagem','Unidade','Quantidade','Qtd. Caixas'];
test('PariPassu usa ovos/capacidade e não Qtd. Caixas',()=>{
 const r=extrairParipassu([cab,['A','X','L1','5008-CAIXA (240)-GRANDE BLISTER-20 UNIDADES',1,'un',2400,1]]);
 assert.equal(r.itens[0].saldo,10);
});
test('industrial excluído e mesmo SKU/lote consolidado',()=>{
 const r=extrairParipassu([cab,['A','X','L1','INDUSTRIAL',1,'un',999,1],['A','Y','L1','5008-CAIXA (240)-GRANDE',1,'un',240,1],['A','Z','L1','5008-CAIXA (240)-GRANDE',1,'un',480,1]]);
 assert.equal(r.industriaisIgnorados,1);assert.equal(r.itens.length,1);assert.equal(r.itens[0].saldo,3);
});
test('diferença de 1 ovo não é arredondada e gera pendência',()=>{
 const r=extrairParipassu([cab,['A','X','L1','5008-CAIXA (240)-GRANDE',1,'un',241,1]]);
 const c=conferirEstoques([{sku:'5008',lote:'L1',saldo:1}],r.itens);
 assert.equal(c.pendencias.length,0);assert.equal(c.conformes,1);
});
test('caixa fracionada permanece pendência mesmo com mesmo saldo numérico',()=>{
 const r=extrairParipassu([cab,['A','X','L1','5008-CAIXA (240)-GRANDE',1,'un',120,1]]);
 const c=conferirEstoques([{sku:'5008',lote:'L1',saldo:0.5}],r.itens);
 assert.equal(c.pendencias.length,0);assert.equal(c.conformes,1);
});
