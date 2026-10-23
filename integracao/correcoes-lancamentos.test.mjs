import test from 'node:test';
import assert from 'node:assert/strict';
import {conciliarCorrecoes,identificarCorrecoes} from './correcoes-lancamentos.mjs';
const item={registroId:'cancelado',data:'21/10/2026',sku:'3938',destino:'NHT',palete:'1',loteCompleto:'L20.01.18.10.26',postura:'.18.10.26',caixas:32};
const evento={id:'exclusao-correta',tipo:'exclusao',criadoEm:'2026-10-22T12:00:00Z',item:{...item,finalidadeExclusao:'CORRECAO_LANCAMENTO'}};
const arquivo={...item,movimentoExclusaoId:evento.id,estado:'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA'};
const executar=(extra={})=>conciliarCorrecoes({entradas:[item,{...item,registroId:'nova',caixas:35}],arquivo:[arquivo],movimentos:[evento],...extra});
test('cancelamento explícito retira somente ID e conteúdo comprovados, sem baixa e com evidência',()=>{
 const r=executar();assert.equal(r.entradas.length,1);assert.equal(r.entradas[0].caixas,35);assert.equal(r.arquivo[0].estado,'ARQUIVADA_APOS_CONFERENCIA');assert.equal(r.arquivo[0].baixaConfirmadaEm,undefined);assert.equal(r.evidencias.length,2);assert.equal(item.caixas,32);
});
test('exclusão de expedição, mesmo SKU e volume, continua aguardando baixa',()=>{
 const r=executar({movimentos:[{...evento,item}]});assert.equal(r.evidencias.length,0);assert.equal(r.entradas.length,2);assert.equal(r.arquivo[0].estado,arquivo.estado);
});
test('cancelamento já confirmado por baixa e fila local pendente não são modificados',()=>{
 for(const extra of [{comprovantes:[{...item,estado:'BAIXA_CONCLUIDA'}]},{fila:[{tipo:'edicao',item}]}])assert.equal(executar(extra).evidencias.length,0);
});
test('cancelamento nunca remove linha com mesmo ID e conteúdo divergente',()=>{
 const r=executar({entradas:[{...item,caixas:40}]});assert.equal(r.entradas[0].caixas,40);
});
test('novo computador cria marcador de correção, evitando recriar pendência remota',()=>{
 const r=executar({arquivo:[],entradas:[]});assert.equal(r.arquivo[0].movimentoExclusaoId,evento.id);assert.equal(r.arquivo[0].estado,'ARQUIVADA_APOS_CONFERENCIA');
 const repetido=conciliarCorrecoes({entradas:r.entradas,arquivo:r.arquivo,movimentos:[evento]});assert.equal(repetido.evidencias.length,0);
});
test('reparo legado exige evento exato e substituição documentada do mesmo autor e aparelho',()=>{
 const velho={...item,registroId:'5beef855-fe01-4cae-ab1d-0a1dd8495148'};
 const e={...evento,id:'fe2fc4ad-44c2-4ad7-b48f-7d7231578062',item:velho,autorUid:'u',dispositivoId:'d'};
 const n={...e,tipo:'inclusao',id:'novo',criadoEm:'2026-10-22T12:01:00Z',item:{...velho,registroId:'9a1e0eb0-fafa-4b81-a34b-1e2394efe3af',caixas:35}};
 assert.equal(identificarCorrecoes([e,n]).length,1);
 assert.equal(identificarCorrecoes([e]).length,0);
 assert.equal(identificarCorrecoes([e,{...n,autorUid:'outro'}]).length,0);
 assert.equal(identificarCorrecoes([{...e,item:{...velho,loteCompleto:'outro'}},n]).length,0);
});
test('conferência preparada antes de cancelamento é recusada antes de descontar estoque',async()=>{
 const {validarSelecaoSemCancelamentos}=await import('./correcoes-lancamentos.mjs');
 const r=executar();assert.throws(()=>validarSelecaoSemCancelamentos([item],r.arquivo),/Prepare novamente/);
 assert.doesNotThrow(()=>validarSelecaoSemCancelamentos([{...item,registroId:'nova'}],r.arquivo));
});

// Regressão da sequência documentada de 22–23/10; nenhum dado de estoque é escrito.
const anterior={registroId:'96c2b5c6-9538-45e0-af37-5680c69efb6b',data:'22/10/2026',sku:'3938',destino:'RS',palete:'5',loteCompleto:'L31.11.19.10.26',postura:'.19.10.26',caixas:16};
const editado={...anterior,caixas:35};
const sequencia=[
 {id:'e5c20236-4f64-400a-957b-848e0df60dd3',tipo:'inclusao',criadoEm:'2026-10-22T21:50:06.913Z',item:anterior},
 {id:'6b1b8099-e01a-454f-84e1-16d18573ce9f',tipo:'edicao',criadoEm:'2026-10-22T21:54:32.582Z',antes:anterior,item:editado},
 {id:'400e4f4a-a33e-4d64-a621-7dd8d8048530',tipo:'exclusao',criadoEm:'2026-10-22T22:25:40.149Z',item:editado},
 {id:'612fd7fe-d3cd-4a5c-8f85-3e6a02ef2ea2',tipo:'exclusao',criadoEm:'2026-10-23T14:48:34.215Z',item:{...editado,finalidadeExclusao:'CORRECAO_LANCAMENTO',exclusaoSemBaixaOperador:true,movimentoExclusaoId:'400e4f4a-a33e-4d64-a621-7dd8d8048530'}}
].map(m=>({...m,autorUid:'operador-teste'}));
const reparar=(extra={})=>conciliarCorrecoes({entradas:[anterior,{...editado,registroId:'atual',palete:'6'}],arquivo:[],movimentos:sequencia,...extra});
test('reparo comprovado remove somente versão anterior e deixa marcador durável e prova da edição',async()=>{
 const {criarIndiceCancelamentos}=await import('./correcoes-lancamentos.mjs');
 const r=reparar();assert.deepEqual(r.entradas,[{...editado,registroId:'atual',palete:'6'}]);
 const marcador=r.arquivo.find(x=>Number(x.caixas)===16);
 assert.equal(marcador.edicaoComprovanteId,sequencia[1].id);assert.equal(marcador.estado,'ARQUIVADA_APOS_CONFERENCIA');
 assert.equal(marcador.baixaConfirmadaEm,undefined);assert.equal(criarIndiceCancelamentos(r.arquivo)(anterior),true);
 const repetido=reparar({entradas:r.entradas,arquivo:r.arquivo});assert.equal(repetido.evidencias.length,0);
 const retorno=reparar({arquivo:r.arquivo});assert.deepEqual(retorno.entradas,r.entradas);
});
test('reparo restrito exige toda a cadeia exata e preserva edição local, reinclusão posterior e baixa',()=>{
 for(const extra of [
  ...sequencia.slice(0,3).map((_,i)=>({movimentos:sequencia.filter((_,j)=>j!==i)})),
  {movimentos:sequencia.map((m,i)=>i===1?{...m,antes:{...anterior,caixas:17}}:m)},
  {movimentos:sequencia.map((m,i)=>i===1?{...m,autorUid:'outro'}:m)},
  {movimentos:[...sequencia,{id:'nova-inclusao',tipo:'inclusao',criadoEm:'2026-10-23T15:00:00Z',item:anterior}]},
  {fila:[{tipo:'edicao',item:anterior}]},
  {comprovantes:[{...anterior,estado:'BAIXA_CONCLUIDA'}]}
 ])assert.equal(reparar(extra).entradas.some(x=>x===anterior),true);
});
