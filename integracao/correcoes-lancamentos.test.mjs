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
