import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconciliarPendenciasJaBaixadas} from './reconciliar-pendencias-baixadas.mjs';
import {identidadeExpedicaoBaixa} from './baixa-transacional.mjs';
const central=readFileSync(new URL('./central-conexao.html',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const base={destino:'Teste app',registroId:'registro30A',movimentoExclusaoId:'excl30A',palete:'1',sku:'5008',loteCompleto:'L25.03.13.10.26',caixas:30,estado:'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA'};
const ativo=x=>identidadeExpedicaoBaixa({...x,movimentoExclusaoId:''},true).id;
const excluido=x=>identidadeExpedicaoBaixa(x,false).id;

test('reconciliação de baixa ativa anterior remove pendência duplicada após apagar romaneio',async()=>{
 const remoto=new Map([[ativo(base),{...base,estado:'BAIXA_CONCLUIDA'}]]);
 const entrada=[base];
 const r=await reconciliarPendenciasJaBaixadas(entrada,async id=>remoto.get(id)||null);
 assert.equal(r.concluidas,1);
 assert.equal(r.pendentes,0);
 assert.equal(entrada[0].estado,'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA');
});
test('dois registros de 30 e um de 20 só encerram se cada ID tiver prova remota',async()=>{
 const registros=[base,{...base,registroId:'registro30B',movimentoExclusaoId:'excl30B'},
   {...base,registroId:'registro20',movimentoExclusaoId:'excl20',destino:'Teste Sync Cel',caixas:20}];
 const remoto=new Map(registros.map(x=>[ativo(x),{...x,estado:'BAIXA_CONCLUIDA'}]));
 const r=await reconciliarPendenciasJaBaixadas(registros,async id=>remoto.get(id)||null);
 assert.equal(r.concluidas,3);
 assert.equal(r.pendentes,0);
 assert.equal(r.registros.reduce((s,x)=>s+x.caixas,0),80);
});
test('mesmo SKU e lote com outra expedição não serve como comprovação',async()=>{
 const x={...base,registroId:'outraExpedicao'};
 const id=ativo(x);
 const r=await reconciliarPendenciasJaBaixadas([x],async key=>key===id?{...x,caixas:20,estado:'BAIXA_CONCLUIDA'}:null);
 assert.equal(r.pendentes,1);
});
test('arquivamento manual auditado permanece terminal, sem inventar BAIXA_CONCLUIDA',async()=>{
 const historico={...base,estado:'ARQUIVADA_APOS_CONFERENCIA',motivoArquivo:'verificado pelo operador'};
 const r=await reconciliarPendenciasJaBaixadas([historico],async()=>{throw Error('Acesso remoto não necessário para arquivo terminal')});
 assert.equal(r.concluidas,0);
 assert.equal(r.pendentes,0);
 assert.equal(r.registros[0].estado,'ARQUIVADA_APOS_CONFERENCIA');
});
test('estado remoto PENDENTE e saldo zerado não permitem baixa fictícia',async()=>{
 const r=await reconciliarPendenciasJaBaixadas([base],async()=>({...base,estado:'PENDENTE_BAIXA'}));
 assert.equal(r.pendentes,1);
});
test('fila de movimentos não condiciona sincronização das expedições',()=>{
 const pos=central.indexOf('async function cicloAutomatico()');
 const trecho=central.slice(pos,central.indexOf("window.addEventListener('online'",pos));
 assert.match(trecho,/await enviarFilaAutomaticamente\(\)/);
 assert.match(trecho,/if\(receberEntradasNoAparelho\(\)&&controleExpedicoesAutomaticas.deveConsultar\(assinaturaExpedicoes\)\)\{/);
 assert.match(trecho,/await sincronizarExpedicoesCompartilhadas\(\)/);
 const blocoExpedicoes=trecho.slice(trecho.indexOf('const assinaturaExpedicoes='));
 assert.doesNotMatch(blocoExpedicoes,/lerOperacional/);
 assert.match(blocoExpedicoes,/await sincronizarExpedicoesCompartilhadas\(\)/);
 assert.ok(trecho.includes("if(receberEntradasNoAparelho())await receberAutomaticamente()"));
});
test('paginação completa consulta servidor, em vez de truncar expedições em 50',()=>{
 const trecho=central.slice(central.indexOf('async function sincronizarExpedicoesCompartilhadasInterno()'),central.indexOf('function registrarExclusoesRecebidas('));
 assert.match(trecho,/getDocsFromServer\(consulta\)/);
 assert.match(trecho,/startAfter\(cursor\)/);
 assert.match(trecho,/orderBy\('__name__'\)/);
 assert.match(trecho,/const verificadas=await reconciliarPendenciasJaBaixadas\(locais,buscarBaixa\)/);
 assert.ok(trecho.indexOf('const verificadas=await reconciliarPendenciasJaBaixadas')<trecho.indexOf('for(const x of verificadas.registros)'));
 assert.doesNotMatch(trecho,/tx\.update\(d,\{estado:'BAIXA_CONCLUIDA'/);
});
test('marcação de pendência encerrada não desconta saldo nem escreve Firestore',()=>{
 const bloco=index.slice(index.indexOf('async function arquivarPendenciaHistoricaSemNovaBaixa(destino)'),index.indexOf('function mostrarExpedicoesExcluidasOperador(){'));
 assert.match(bloco,/await confirmarRaiar\(/);
 assert.match(bloco,/x\.estado='ARQUIVADA_APOS_CONFERENCIA'/);
 assert.match(bloco,/romaneio2_auditoria_pendencias_historicas_v1/);
 assert.match(bloco,/localStorage\.setItem\(chaveAuditoria/);
 assert.doesNotMatch(bloco,/registrarBaixaConferida|runTransaction|estoques_oficiais|tx\.update/);
});
test('destinos arquivados deixam de aparecer em pendências e no seletor de baixa',()=>{
 assert.match(index,/x\.estado!=='BAIXA_CONCLUIDA'&&x\.estado!=='ARQUIVADA_APOS_CONFERENCIA'/);
 assert.match(index,/ENCERRAR PENDÊNCIA ANTIGA \(SEM BAIXA\)/);
 assert.match(index,/if\(event.key==='romaneio2_expedicoes_excluidas_pendentes_v1'\)\{[\s\S]*?atualizarDestinosBaixa\(\)/);
});
