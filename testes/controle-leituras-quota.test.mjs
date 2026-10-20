import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {criarControleLeituras} from '../integracao/controle-leituras-automaticas.mjs';
import {descreverErroPublicacao} from '../integracao/erro-publicacao-estoque.mjs';
test('sem novidades não relê histórico a cada cinco segundos; conferência periódica permanece',()=>{
 let tempo=0;const c=criarControleLeituras({agora:()=>tempo});
 assert.equal(c.deveConsultar('marina:ambiente:movimento1'),true);
 for(tempo=5000;tempo<300000;tempo+=5000)assert.equal(c.deveConsultar('marina:ambiente:movimento1'),false);
 assert.equal(c.deveConsultar('marina:ambiente:movimento1'),true);
});
test('nova movimentação, dados locais e troca de conta ou ambiente liberam consulta imediata',()=>{
 const c=criarControleLeituras({agora:()=>0});
 for(const chave of ['marina:a:1:local1','marina:a:2:local1','marina:a:2:local2','salaovos:a:2:local2','salaovos:b:2:local2'])assert.equal(c.deveConsultar(chave),true);
});
test('limite remoto e espaço do navegador têm orientações distintas, sem apagar dados',()=>{
 assert.match(descreverErroPublicacao({code:'resource-exhausted',message:'Quota exceeded.'}),/serviço compartilhado/);
 assert.match(descreverErroPublicacao({name:'QuotaExceededError',message:'Quota exceeded.'}),/Não apague/);
 assert.equal(descreverErroPublicacao({code:'permission-denied',message:'Acesso negado'}),'Acesso negado [permission-denied]');
 assert.equal(descreverErroPublicacao(new Error('Saldo inválido')),'Saldo inválido');
});
test('controle limita somente leituras automáticas; envio permanece antes do limitador',()=>{
 const html=readFileSync(new URL('../integracao/central-conexao.html',import.meta.url),'utf8');
 const ciclo=html.slice(html.indexOf('async function cicloAutomatico(){'),html.indexOf("window.addEventListener('online',()=>{"));
 assert.ok(ciclo.indexOf('await enviarFilaAutomaticamente()')<ciclo.indexOf('controleLeiturasAutomaticas.deveConsultar'));
 assert.match(ciclo,/localStorage.getItem\('romaneio2_solicitar_sincronizacao_v1'\)/);
 assert.match(ciclo,/if\(receberEntradasNoAparelho\(\)\)await receberAutomaticamente\(\)/);
 assert.match(html,/ultimaAssinaturaRemota=assinatura;\s*void cicloAutomatico\(\)/);
 assert.match(html,/getDocsFromServer\(query\(\.\.\.partes\)\)/);
});
