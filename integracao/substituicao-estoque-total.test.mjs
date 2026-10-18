import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selecionarInventarioEstoque,prepararSubstituicaoTotal,assinaturaInventario} from './substituicao-estoque-total.mjs';
const estoque=[
 {sku:'5008',lote:'L25.03.14.10.26',saldo:26,postura:'14.10.26',ovosPorCaixa:360},
 {sku:'3938',lote:'L21.15.13.10.26',saldo:8,postura:'13.10.26',ovosPorCaixa:360},
 {sku:'3826',lote:'L32.18.13.10.26',saldo:16}
];
const registros=[
 {registroId:'inv-1',destino:'ESTOQUE',sku:'5008',loteCompleto:'L25.03.14.10.26',caixas:15,postura:'14.10.26'},
 {registroId:'inv-2',destino:'estoque',sku:'5008',loteCompleto:'L25.03.14.10.26',caixas:9,postura:'14.10.26'},
 {registroId:'inv-3',destino:'ESTOQUE',sku:'11745',loteCompleto:'L33.02.15.10.26',caixas:30,postura:'15.10.26'},
 {registroId:'expedicao-1',destino:'CLIENTE',sku:'3938',loteCompleto:'L21.15.13.10.26',caixas:100}
];
test('apenas destino ESTOQUE, sem incluir caixa de destino CLIENTE',()=>{
 const r=selecionarInventarioEstoque(registros);
 assert.equal(r.length,2);assert.equal(r.reduce((s,x)=>s+x.saldo,0),54);
 assert.equal(r.find(x=>x.sku==='5008').saldo,24);
 assert.equal(r.find(x=>x.sku==='11745').saldo,30);
});
test('substituição integral: antigos ausentes são retirados, novos são incluídos, não soma com estoque atual',()=>{
 const r=prepararSubstituicaoTotal(estoque,registros);
 assert.equal(r.estoqueAnterior,50);
 assert.equal(r.estoqueDepois,54);
 assert.equal(r.retirados.length,2);
 assert.equal(r.totalLotes,2);
 assert.equal(r.totalRegistros,3);
 assert.deepEqual(r.itens.map(x=>x.saldo),[24,30]);
 assert.equal(r.itens.find(x=>x.sku==='5008').saldo,24);
 assert.equal(r.itens.some(x=>x.sku==='3938'),false);
 assert.equal(estoque[0].saldo,26);
});
test('inclusões de mesmo SKU e lote agregam corretamente sem apagar entradas da fonte',()=>{
 const antes=JSON.stringify(registros);
 prepararSubstituicaoTotal(estoque,registros);
 assert.equal(JSON.stringify(registros),antes);
});
test('ESTOQUE vazio bloqueia substituição integral e não apaga estoque',()=>{
 assert.throws(()=>prepararSubstituicaoTotal(estoque,[{destino:'CLIENTE',sku:'5008',lote:'L',caixas:1}]),/Nenhum palete/);
 assert.equal(estoque.length,3);
});
test('registros ESTOQUE com caixas fracionadas ou negativas são bloqueados',()=>{
 for(const caixas of [0,-1,2.5,'abc']){
  assert.throws(()=>selecionarInventarioEstoque([{...registros[0],caixas}]),/inválido/);
 }
});
test('posturas conflitantes no mesmo SKU/lote não podem gerar Excel incorreto',()=>{
 assert.throws(()=>selecionarInventarioEstoque([registros[0],{...registros[1],postura:'12.10.26'}]),/Posturas divergentes/);
});
test('assinatura muda quando inventário é editado entre conferência e confirmação',()=>{
 const antes=assinaturaInventario(registros);
 assert.equal(antes,assinaturaInventario([...registros].reverse()));
 assert.notEqual(antes,assinaturaInventario(registros.map((x,i)=>i===0?{...x,caixas:x.caixas+1}:x)));
});
test('conferência da baixa de expedição permanece separada',()=>{
 const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(source,/modo==='baixa'\?movimentosDoRomaneio\(\):\[\]/);
 assert.match(source,/resultado=prepararBaixa\(e,registros\)/);
 assert.match(source,/resultado=prepararSubstituicaoTotal\(e,inventario\)/);
 assert.match(source,/assinaturaInventario\(lerJsonLocalStorage\('entradas',\[\]\)\)/);
 assert.match(source,/id="etapa4ConfirmarSubstituicao"/);
 assert.match(source,/if\(!atual.exportado\|\|!atual.excelAtualizado\?\.blob\)/);
});
test('contrato Firestore mantém versão esperada, permissões e apenas estoque embalado',()=>{
 const ui=readFileSync(new URL('./estoques-firebase-ui.mjs',import.meta.url),'utf8');
 assert.match(ui,/window.substituirEstoqueEmbaladoPeloInventario=async/);
 assert.match(ui,/ambienteAtual\?\.permissoes\?\.publicarExcel/);
 assert.match(ui,/tipo:'embalado',dados,versaoEsperada:versaoInicial/);
 const generator=readFileSync(new URL('./baixa-modelo-aprovado.mjs',import.meta.url),'utf8');
 assert.match(generator,/export async function gerarSubstituicaoModeloAprovado/);
 assert.match(generator,/await updateDependentCaches\(sx,reescrito.finalRecords\)/);
 assert.match(generator,/await installPanelFormulas\(sx\)/);
 assert.match(generator,/await sx.forceRecalc\(\)/);
});
