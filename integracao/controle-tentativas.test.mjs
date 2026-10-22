import test from 'node:test';import assert from 'node:assert/strict';import {criarControleTentativas,controleEnviosCompartilhado} from './controle-tentativas.mjs';import {criarPublicadorMovimentos} from './publicador-firestore.js';
test('cota esgotada suspende novas tentativas por 15 minutos e conserva retomada',()=>{
 let agora=0;const c=criarControleTentativas({agora:()=>agora});assert.equal(c.iniciar(),true);c.falhou({code:'resource-exhausted'});c.encerrar();
 for(let i=0;i<179;i++){agora+=5000;assert.equal(c.iniciar(),false);}agora=900000;assert.equal(c.iniciar(),true);c.sucesso();c.encerrar();assert.equal(c.podeTentar(),true);
});
test('falhas transitórias aumentam a espera e envios simultâneos são bloqueados',()=>{
 let agora=0;const c=criarControleTentativas({agora:()=>agora});assert.equal(c.iniciar(),true);assert.equal(c.iniciar(),false);c.falhou({code:'unavailable'});c.encerrar();assert.equal(c.restanteMs,5000);agora=5000;c.iniciar();c.falhou({code:'unavailable'});c.encerrar();assert.equal(c.restanteMs,10000);
});
test('app e Central dividem o controle apenas na mesma conta e janela',()=>{
 const escopo={};assert.equal(controleEnviosCompartilhado('u',escopo),controleEnviosCompartilhado('u',escopo));assert.notEqual(controleEnviosCompartilhado('u',escopo),controleEnviosCompartilhado('v',escopo));
});
test('publicador interrompe lote ao atingir cota sem confirmar nem descartar o restante',async()=>{
 let consultas=0;const p=criarPublicadorMovimentos({obterUsuario:()=>({uid:'u'}),referencia:id=>id,registrarErro(){},transacionar:async()=>{consultas++;const e=Error('quota');e.code='resource-exhausted';throw e;}});
 const fila=Array.from({length:20},(_,i)=>({id:'movimento-'+i,tipo:'inclusao',dispositivoId:'d',criadoEm:'2026-10-22',item:{sku:'5002',loteCompleto:'L',caixas:10}}));
 const r=await p.publicar(fila);assert.equal(consultas,1);assert.equal(r.confirmacoes.length,1);assert.equal(r.pendentes.length,20);assert.equal(fila.length,20);
});
