import test from 'node:test';
import assert from 'node:assert/strict';
import {extrairParipassu} from './leitor-paripassu.mjs';
const cab=['Empresa','Código de Rastreamento','Lote','Tipo Produto','Capacidade da Embalagem','Unidade','Quantidade','Qtd. Caixas'];
const linha=(lote,produto,ovos,caixas=1)=>['Raiar','CT',lote,produto,1,'un',ovos,caixas];
test('ignora industrial e calcula caixas pela quantidade de ovos, nunca Qtd. Caixas',()=>{
 const r=extrairParipassu([['Gerado por'],cab,linha('L1','INDUSTRIAL',240),linha('L2','5008-CAIXA (240)-GRANDE BLISTER-20 UNIDADES',2400)]);
 assert.equal(r.industriaisIgnorados,1);assert.equal(r.itens.length,1);assert.equal(r.itens[0].saldo,10);
});
test('reconhece 120 ovos e consolida linhas do mesmo SKU/lote',()=>{
 const r=extrairParipassu([cab,linha('L1','6295-CAIXA (120)-GRANDE TAEQ-10 UNIDADES',120),linha('L1','6295-CAIXA (120)-GRANDE TAEQ-10 UNIDADES',240)]);
 assert.equal(r.itens.length,1);assert.equal(r.itens[0].saldo,3);
});
test('caixas fracionadas permanecem importáveis e sinalizadas',()=>{
 const r=extrairParipassu([cab,linha('L1','5002-CAIXA (240)-MEDIO-10 UNIDADES',1782)]);
 assert.equal(r.itens[0].saldo,7.425);assert.equal(r.caixasFracionadas,1);
});
test('rejeita produto não industrial sem SKU/capacidade',()=>{
 assert.throws(()=>extrairParipassu([cab,linha('L1','PRODUTO DESCONHECIDO',240)]),/sem SKU/);
});

test('reconhece capacidade 270 e capacidade não cadastrada',()=>{
 const r=extrairParipassu([cab,linha('L270','5008-CAIXA (270)-GRANDE',540),linha('L180','5010-CAIXA (180)-GRANDE',360)]);
 assert.deepEqual(r.itens.map(x=>x.saldo),[2,2]);
});

import {conferirEstoques} from './conferencia-estoques.mjs';
import {validarEstoqueOficial} from './contrato-estoques.mjs';
test('saldo embalado permanece oficial; divergencia vira pendencia',()=>{
 const r=extrairParipassu([cab,linha('L1','5008-CAIXA (240)-GRANDE',480)]);
 const e=[{sku:'5008',lote:'L1',saldo:3}];
 const p=validarEstoqueOficial({tipo:'paripassu',nome:'paripassu.xlsx',versao:'teste',itens:r.itens},'paripassu');
 const x=conferirEstoques(e,p.itens);
 assert.equal(e[0].saldo,3);assert.equal(x.pendencias.length,1);assert.equal(x.pendencias[0].diferenca,1);
});
test('saldo PariPassu parcial gera pendencia sem bloqueio',()=>{
 const r=extrairParipassu([cab,linha('L1','5008-CAIXA (240)-GRANDE',300)]);
 const p=validarEstoqueOficial({tipo:'paripassu',nome:'paripassu.xlsx',versao:'teste',itens:r.itens},'paripassu');
 const x=conferirEstoques([{sku:'5008',lote:'L1',saldo:1}],p.itens);
 assert.equal(x.pendencias.length,0);assert.equal(x.conformes,1);
});
test('exclui INDUSTRIA DIRETO sem afetar produtos embalados',()=>{
 const r=extrairParipassu([cab,linha('L1','INDÚSTRIA DIRETO',240),linha('L2','5008-CAIXA (240)-GRANDE',240)]);
 assert.equal(r.industriaisIgnorados,1);assert.equal(r.itens.length,1);
});

test('caixa parcial continua pendente mesmo se os dois saldos forem iguais',()=>{
 const r=extrairParipassu([cab,linha('L1','5008-CAIXA (240)-GRANDE',360)]);
 const x=conferirEstoques([{sku:'5008',lote:'L1',saldo:1.5}],r.itens);
 assert.equal(x.pendencias.length,0);
 assert.equal(x.conformes,1);
});
