import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../integracao/central-conexao.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function construirBackupConferencia(){'),html.indexOf('async function completarBackupComBaseConfirmada('));
test('backup inclui excluídos, estoque e comprovantes sem gravar nem consultar serviço',()=>{
 const dados={entradas:'[{"registroId":"a"}]',romaneio2_expedicoes_excluidas_pendentes_v1:'[{"registroId":"b","caixas":32}]'};
 const painel={estoqueTesteConsulta:new Map([['a',{saldo:45}]]),__comprovantesBaixaConfirmados:[{estado:'BAIXA_CONCLUIDA'}],__reservasCompartilhadas:[{caixas:3}]};
 const c={window:{parent:painel},localStorage:{getItem:k=>dados[k]??null}};
 runInNewContext(source,c);const copia=c.construirBackupConferencia();
 assert.equal(copia.dados.entradas.length,1);assert.equal(copia.dados.romaneio2_expedicoes_excluidas_pendentes_v1[0].caixas,32);
 assert.equal(copia.conferencia.estoque[0].saldo,45);assert.equal(copia.conferencia.comprovantes.length,1);assert.equal(copia.conferencia.reservasCompartilhadas[0].caixas,3);
 assert.equal(dados.entradas,'[{"registroId":"a"}]');
});
test('Central aberta separadamente exporta arquivo de excluídos mesmo sem painel',()=>{
 const w={};w.parent=w;
 const c={window:w,localStorage:{getItem:k=>k==='entradas'?'[]':null}};
 runInNewContext(source,c);const copia=c.construirBackupConferencia();
 assert.equal(copia.conferencia.estoque,null);assert.equal(copia.dados.entradas.length,0);
});

test('backup completo usa bases recebidas e exige confirmação de ambas',async()=>{
 const base={movimentos:{ler:async()=>({docs:[{id:'mov',data:()=>({tipo:'exclusao'})}]})},expedicoes:{ler:async()=>({docs:[{id:'exp',data:()=>({estado:'BAIXA_CONCLUIDA'})}]})}};
 const c={baseRecebida:base,metricasBasesCompartilhadas:()=>[],metricasEnviosCompartilhados:()=>[]};
 const fonte=html.slice(html.indexOf('async function completarBackupComBaseConfirmada('),html.indexOf("$('exportarBackupUniao').onclick="));
 runInNewContext(fonte,c);const copia=await c.completarBackupComBaseConfirmada({conferencia:{}},base);
 assert.equal(copia.conferencia.movimentosConfirmados[0].id,'mov');
 assert.equal(copia.conferencia.expedicoesConfirmadas[0].estado,'BAIXA_CONCLUIDA');
 await assert.rejects(c.completarBackupComBaseConfirmada({conferencia:{}},null),/Aguarde a conexão/);
 c.baseRecebida={};await assert.rejects(c.completarBackupComBaseConfirmada({conferencia:{}},base),/conexão mudou/);
});
test('destinos aguardando baixa não oferecem encerramento manual por destino',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const bloco=index.slice(index.indexOf('function mostrarExpedicoesExcluidasOperador(){'),index.indexOf('function operadorAtualizarPainel(){'));
 assert.match(bloco,/div.append\(titulo,exportar,preparar\)/);
 assert.doesNotMatch(bloco,/div.append\([^;]*(arquivar|corrigir)/);
});
