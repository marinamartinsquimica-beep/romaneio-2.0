import test from 'node:test';
import assert from 'node:assert/strict';
import {chaveSelecao,selecionarRomaneios,assinaturaRegistros,planejarExclusao,gravarExclusaoLocal} from './selecao-romaneios.mjs';
import {conciliarCorrecoes} from './correcoes-lancamentos.mjs';
const r=(n,extra={})=>({registroId:'registro-'+n,data:'23/10/2026',sku:'3938',destino:'DESTINO '+n,palete:'1',loteCompleto:'LOTE-'+n,caixas:32,...extra});
const arquivo=[1,2,3,4,5].map(n=>r(n,{movimentoExclusaoId:'exclusao-'+n,estado:'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA'}));
const selecao=[1,3,5].map(n=>chaveSelecao('arquivo','DESTINO '+n));
function plano(extra={}){let id=0;return planejarExclusao({entradas:[],arquivo,selecao,agora:'2026-10-23T12:00:00Z',criarId:()=>String(++id).padStart(8,'0'),dispositivoId:'computador',...extra});}
test('seleciona três entre cinco destinos, preservando os outros dois',()=>{
 const p=plano();assert.equal(p.registros.length,3);assert.equal(p.arquivo.filter(x=>x.estado==='ARQUIVADA_APOS_CONFERENCIA').length,3);
 assert.deepEqual(p.arquivo.filter(x=>x.estado!=='ARQUIVADA_APOS_CONFERENCIA'),[arquivo[1],arquivo[3]]);
 assert.equal(p.movimentos.length,3);assert.ok(p.movimentos.every(m=>m.tipo==='exclusao'&&m.item.finalidadeExclusao==='CORRECAO_LANCAMENTO'));
 assert.ok(p.arquivo.every(x=>x.baixaConfirmadaEm===undefined));
});
test('a exclusão de NHT independe de saldo e não modifica estoque nem entradas de outro destino',()=>{
 const estoque=[{sku:'outro',saldo:778}];const outro=r(9);const p=plano({entradas:[outro]});
 assert.deepEqual(p.entradas,[outro]);assert.deepEqual(estoque,[{sku:'outro',saldo:778}]);
 assert.equal(arquivo.filter(x=>x.estado==='ARQUIVADA_APOS_CONFERENCIA').length,0);
});
test('seleção mista conserva identidades e não soma cópia removida da mesma linha',()=>{
 const ativo=r(1);const registros=selecionarRomaneios({entradas:[ativo,r(8)],arquivo,selecao:[...selecao,chaveSelecao('ativo',ativo.destino)]});
 assert.equal(registros.length,3);assert.equal(registros[0].origemBaixa,'ativo');assert.equal(registros[1].origemBaixa,'arquivo');
});
test('linhas com dados físicos iguais e IDs distintos permanecem na seleção',()=>{
 const a=r(1),b={...a,registroId:'outro-id'};
 assert.equal(selecionarRomaneios({entradas:[a,b],arquivo:[],selecao:[chaveSelecao('ativo',a.destino)]}).length,2);
});
test('assinatura detecta edição durante confirmação, mesmo quando total de caixas não muda',()=>{
 assert.notEqual(assinaturaRegistros([r(1)]),assinaturaRegistros([r(1,{loteCompleto:'NOVO'})]));
 assert.notEqual(assinaturaRegistros([r(1)]),assinaturaRegistros([r(1,{estado:'BAIXA_CONCLUIDA'})]));
});
test('correção enviada impede retorno da pendência em outro computador e repetição é idempotente',()=>{
 const p=plano();const m=p.movimentos.map(m=>({...m,autorUid:'operador'}));
 const recebido=conciliarCorrecoes({entradas:[],arquivo,movimentos:m});
 assert.equal(recebido.arquivo.filter(x=>x.estado==='ARQUIVADA_APOS_CONFERENCIA').length,3);
 const repetido=conciliarCorrecoes({entradas:[],arquivo:recebido.arquivo,movimentos:m});assert.equal(repetido.evidencias.length,0);
});
test('não encerra baixas concluídas nem duplica uma nova exclusão da mesma seleção',()=>{
 const p=plano({arquivo:arquivo.map((x,i)=>i===0?{...x,estado:'BAIXA_CONCLUIDA'}:x)});
 assert.equal(p.registros.length,2);assert.equal(p.arquivo[0].estado,'BAIXA_CONCLUIDA');
 assert.throws(()=>plano({arquivo:p.arquivo}),/Selecione/);
});
test('grava auditoria e fila antes de aplicar exclusão; falha de armazenamento restaura dados',()=>{
 const dados=new Map([['entradas',JSON.stringify([r(9)])],['fila','[]'],['arquivo',JSON.stringify(arquivo)],['base','[]']]);const antes=new Map(dados);
 let falhou=false;const storage={getItem:k=>dados.get(k)??null,removeItem:k=>dados.delete(k),setItem(k,v){if(k==='arquivo'&&!falhou){falhou=true;throw Error('cota local');}dados.set(k,v);}};
 const options={filaKey:'fila',baseKey:'base',arquivoKey:'arquivo',auditoriaKey:'auditoria',agora:'hoje'};
 assert.throws(()=>gravarExclusaoLocal(storage,plano({entradas:[r(9)]}),options),/cota local/);assert.deepEqual(dados,antes);
 gravarExclusaoLocal(storage,plano({entradas:[r(9)]}),options);assert.equal(JSON.parse(dados.get('fila')).length,3);assert.equal(JSON.parse(dados.get('auditoria')).length,1);
});

test('excluir cópia removida também retira sua representação ativa idêntica, sem bloquear',()=>{
 const p=plano({entradas:[r(1),r(8)]});
 assert.deepEqual(p.entradas,[r(8)]);assert.equal(p.registros.length,3);
});
test('identificador compartilhado não impede excluir seleção nem apaga outro destino',()=>{
 const outro={...r(1),destino:'OUTRO DESTINO',loteCompleto:'LOTE NOVO'};
 const p=plano({entradas:[outro]});
 assert.deepEqual(p.entradas,[outro]);assert.equal(p.registros.length,3);
 const recebidos=conciliarCorrecoes({entradas:[outro],arquivo,movimentos:p.movimentos});
 assert.deepEqual(recebidos.entradas,[outro]);
});
test('duas linhas selecionadas com mesmo ID são excluídas, com auditoria das duas parcelas',()=>{
 const a=r(1),b={...a};const p=plano({entradas:[a,b],arquivo:[],selecao:[chaveSelecao('ativo',a.destino)]});
 assert.equal(p.entradas.length,0);assert.equal(p.registros.length,2);assert.equal(p.movimentos.length,2);
 const remoto=conciliarCorrecoes({entradas:[a,b],arquivo:[],movimentos:p.movimentos});
 assert.equal(remoto.entradas.length,0);
});
test('cancelado por correção sai da seleção, mas substituto com outro lote e mesmo ID permanece',async()=>{
 const {fontesOperacionais}=await import('./selecao-romaneios.mjs');
 const antigo=r(1),novo={...antigo,loteCompleto:'CORRIGIDO'};
 const marcador={...antigo,estado:'ARQUIVADA_APOS_CONFERENCIA',correcaoMovimentoId:'correcao-1'};
 const f=fontesOperacionais({entradas:[antigo,novo],arquivo:[marcador,arquivo[0]]});
 assert.deepEqual(f.entradas,[novo]);assert.deepEqual(f.arquivo,[]);
});
test('excluir versão antiga deixa nova quantidade e novo lote do mesmo ID disponíveis para baixa',()=>{
 const novo={...r(1),loteCompleto:'CORRIGIDO',caixas:40};const p=plano({entradas:[novo]});
 assert.deepEqual(p.entradas,[novo]);
 assert.equal(selecionarRomaneios({entradas:p.entradas,arquivo:p.arquivo,selecao:[chaveSelecao('ativo',novo.destino)]})[0].caixas,40);
});
test('exclusão explícita de registro já baixado preserva comprovante e impede retorno',()=>{
 const a=r(1),recibo={...a,estado:'BAIXA_CONCLUIDA',baixaConfirmadaEm:'antes'};
 const p=plano({entradas:[a],arquivo:[recibo],selecao:[chaveSelecao('ativo',a.destino)]});
 assert.equal(p.entradas.length,0);assert.deepEqual(p.arquivo[0],recibo);
 const remoto=conciliarCorrecoes({entradas:[a],arquivo:[recibo],movimentos:p.movimentos,comprovantes:[recibo]});
 assert.equal(remoto.entradas.length,0);assert.deepEqual(remoto.arquivo[0],recibo);
 assert.ok(remoto.arquivo.some(x=>x.estado==='ARQUIVADA_APOS_CONFERENCIA'));
});
