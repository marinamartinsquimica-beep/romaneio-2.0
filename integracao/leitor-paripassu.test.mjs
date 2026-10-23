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

test('publica produto PariPassu em formato ESTOJO 10 (CAIXA 120 UN.)',()=>{
 const produto='12209-RAIAR - GRANDE - ESTOJO 10 (CAIXA 120 UN.)';
 const r=extrairParipassu([cab,linha('L25.03.13.10.26',produto,720,6)]);
 assert.equal(r.itens.length,1);
 assert.deepEqual({sku:r.itens[0].sku,ovosPorCaixa:r.itens[0].ovosPorCaixa,ovos:r.itens[0].ovos,saldo:r.itens[0].saldo},
  {sku:'12209',ovosPorCaixa:120,ovos:720,saldo:6});
 const validado=validarEstoqueOficial({tipo:'paripassu',nome:'Estoque - 2026-10-19.xlsx',versao:'teste-12209',itens:r.itens},'paripassu');
 assert.equal(validado.itens[0].saldo,6);
});
test('preserva sintaxes (120) e (CAIXA 120 UN.), incluindo UNIDADES',()=>{
 const data=[
  linha('L1','5008-CAIXA (240)-GRANDE BLISTER',480),
  linha('L2','12209-RAIAR - GRANDE - ESTOJO 10 (CAIXA 120 UN.)',240),
  linha('L3','12210-RAIAR - GRANDE - ESTOJO 10 (CAIXA 120 UNIDADES)',360)
 ];
 const r=extrairParipassu([cab,...data]);
 assert.deepEqual(r.itens.map(x=>x.saldo),[2,2,3]);
 assert.deepEqual(r.itens.map(x=>x.ovosPorCaixa),[240,120,120]);
});
test('ESTOJO 10 sozinho não permite inferir ovos por caixa',()=>{
 assert.throws(()=>extrairParipassu([cab,linha('L1','12209-RAIAR - GRANDE - ESTOJO 10',120)]),/sem SKU ou ovos\/caixa/);
});
test('capacidades declaradas contraditórias bloqueiam publicação sem escolher quantidade arbitrária',()=>{
 assert.throws(()=>extrairParipassu([cab,linha('L1','12209-RAIAR (240) (CAIXA 120 UN.)',480)]),/Capacidades de caixa divergentes/);
});
test('quantidade permanece em ovos e não usa Qtd. Caixas nem ESTOJO 10 como saldo',()=>{
 const r=extrairParipassu([cab,linha('L1','12209-RAIAR - GRANDE - ESTOJO 10 (CAIXA 120 UN.)',600,1)]);
 assert.equal(r.itens[0].saldo,5);
 assert.equal(r.itens[0].ovos,600);
});
test('SKU desconhecido e capacidade ausente ainda bloqueiam estoque incompleto',()=>{
 assert.throws(()=>extrairParipassu([cab,linha('L1','SEM IDENTIFICACAO (CAIXA 120 UN.)',120)]),/sem SKU ou ovos\/caixa/);
});

test('SKU 10775 sem capacidade na descrição usa as 240 unidades confirmadas, sem ler os valores 1 como caixas',()=>{
 const r=extrairParipassu([cab,linha('L21.15.21.10.26','10775 - OVO CAIPIRA ORGÂNICO BENASSI- GRANDE - EST',960,1)]);
 assert.equal(r.itens[0].sku,'10775');assert.equal(r.itens[0].ovosPorCaixa,240);
 assert.equal(r.itens[0].ovos,960);assert.equal(r.itens[0].saldo,4);
});
test('SKU 10775 com descrição completa mantém a mesma conversão',()=>{
 const r=extrairParipassu([cab,linha('L1','10775-CAIXA (240)-GRANDE BENASSI -10 UNIDADES',960)]);
 assert.equal(r.itens[0].saldo,4);
});
test('capacidade declarada conflitante do SKU 10775 exige conferência antes de publicar',()=>{
 assert.throws(()=>extrairParipassu([cab,linha('L1','10775-CAIXA (360)-GRANDE BENASSI',960)]),/Capacidade de caixa divergente no SKU 10775/);
});
test('correspondência confirmada não é aplicada a outro SKU com nome semelhante',()=>{
 assert.throws(()=>extrairParipassu([cab,linha('L1','10776 - OVO CAIPIRA ORGÂNICO BENASSI- GRANDE - EST',960)]),/falta informar ovos por caixa/);
});
