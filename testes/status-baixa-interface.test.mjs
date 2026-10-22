import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {registroBaixadoNoEstoque} from '../integracao/status-baixa-romaneio.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../integracao/estoques-firebase-ui.mjs',import.meta.url),'utf8');
const linha={registroId:'reg-existente',data:'20/10/2026',sku:'5002',destino:'SC',palete:'24',loteCompleto:'LOTE',lote:'LT',postura:'19/10/26',caixas:10};
function renderizar(comprovantes,registros=[linha],excluidos=[],saldo=0){
 class El{constructor(){this.children=[];this.style={};this.textContent='';}replaceChildren(){this.children=[];}append(...xs){this.children.push(...xs);}appendChild(x){this.children.push(x);}addEventListener(){}}
 const els=new Map(['listaPendenciasEstoque','contadorPendenciasEstoque','opPendenciasEstoqueResumo'].map(k=>[k,new El()]));
 const linhas=registros.map(x=>({dataset:{registroId:x.registroId},cells:[x.data,x.sku,x.destino,x.palete,x.loteCompleto,x.lote,x.postura,x.caixas].map(t=>({textContent:String(t)}))}));
 const c={window:{estoqueTesteConsulta:new Map([['lote',{sku:'5002',lote:'LOTE',saldo}]]),romaneioPossuiBaixaConfirmada:r=>registroBaixadoNoEstoque(r,comprovantes)},document:{getElementById:id=>els.get(id),createElement:()=>new El(),querySelectorAll:selector=>selector.includes('raiar-linha-pendente')?[]:linhas},lerExpedicoesPendentes:()=>excluidos,chaveReservaTeste:(s,l)=>JSON.stringify([s,l])};
 const s=html.slice(html.indexOf('function renderizarPendenciasConferenciaEstoque(){'),html.indexOf('function atualizarResumoReservaTeste()'));
 runInNewContext(html.slice(html.indexOf('function linhasConferenciaEstoque(){'),html.indexOf('function reservasAtuaisTeste('))+s,c);c.renderizarPendenciasConferenciaEstoque();return els;
}
test('reabrir tela reconhece comprovante remoto, zera pendência e exibe etiqueta vermelha sem arquivo local',()=>{
 const els=renderizar([{...linha,estado:'BAIXA_CONCLUIDA'}]);
 assert.equal(els.get('contadorPendenciasEstoque').textContent,'0');
 const card=els.get('listaPendenciasEstoque').children[0];
 assert.equal(card.style.borderLeft,'5px solid #bf4747');
 assert.ok(card.children.some(x=>x.textContent==='ROMANEIO BAIXADO ESTOQUE'));
 assert.equal(card.children.some(x=>x.textContent==='CONFERIR ROMANEIO'),false);
});
test('comprovante agrupado marca ambas as parcelas; novo registro no mesmo destino permanece pendente',()=>{
 const comprovante={...linha,caixas:20,estado:'BAIXA_CONCLUIDA',linhasBaixa:[{...linha},{...linha}]};
 assert.equal(renderizar([comprovante],[linha,{...linha}]).get('contadorPendenciasEstoque').textContent,'0');
 const els=renderizar([comprovante],[linha,{...linha,registroId:'novo'}]);
 assert.equal(els.get('contadorPendenciasEstoque').textContent,'1');
 assert.ok(els.get('listaPendenciasEstoque').children[0].children.some(x=>x.textContent==='CONFERIR ROMANEIO'));
});
test('saldo zerado sem comprovante não produz status baixado',()=>{
 const els=renderizar([]);assert.equal(els.get('contadorPendenciasEstoque').textContent,'1');
});
test('falha de renderização após confirmação não transforma baixa concluída em falha transacional',()=>{
 const a=ui.indexOf('function atualizarComprovantesBaixa('),b=ui.indexOf('const $=id=>',a);
 const c={window:{__comprovantesBaixaConfirmados:[],renderizarPendenciasConferenciaEstoque:()=>{throw Error('DOM indisponível')}},console:{warn(){}}};
 runInNewContext(ui.slice(a,b),c);
 assert.doesNotThrow(()=>c.atualizarComprovantesBaixa([{...linha,estado:'BAIXA_CONCLUIDA'}]));
 assert.equal(c.window.__comprovantesBaixaConfirmados.length,1);
});
test('linha já baixada deixa de reservar estoque sem alterar as caixas do romaneio',()=>{
 const row={dataset:{registroId:linha.registroId,reservaTeste:'1'},cells:[linha.data,linha.sku,linha.destino,linha.palete,linha.loteCompleto,linha.lote,linha.postura,linha.caixas].map(x=>({textContent:String(x)}))};
 const c={document:{querySelectorAll:()=>[row]},window:{__reservasCompartilhadas:[],romaneioPossuiBaixaConfirmada:r=>registroBaixadoNoEstoque(r,[{...linha,estado:'BAIXA_CONCLUIDA'}])},dadosDaLinhaRomaneio:()=>({...linha}),chaveReservaTeste:(sku,lote)=>sku+':'+lote};
 const fonte=html.slice(html.indexOf('function reservasAtuaisTeste('),html.indexOf('function validarReservaTeste('));
 runInNewContext(fonte,c);assert.equal(c.reservasAtuaisTeste().size,0);assert.equal(row.cells[7].textContent,'10');
 c.window.romaneioPossuiBaixaConfirmada=()=>false;assert.equal([...c.reservasAtuaisTeste().values()][0],10);
});

test('removido do celular gera pendência mesmo sem linha no romaneio ativo',()=>{
 const els=renderizar([],[],[{...linha,estado:'PENDENTE_BAIXA'}]);
 assert.equal(els.get('contadorPendenciasEstoque').textContent,'1');
 assert.ok(els.get('listaPendenciasEstoque').children[0].children.some(x=>x.textContent==='CONFERIR ROMANEIO'));
});
test('cópia excluída não duplica caixas presentes no computador',()=>{
 const els=renderizar([],[linha],[{...linha,estado:'PENDENTE_BAIXA'}]);
 assert.match(els.get('listaPendenciasEstoque').children[0].children[1].textContent,/Romaneio: 10 CX/);
});
test('excluído com baixa comprovada não reabre pendências',()=>{
 assert.equal(renderizar([{...linha,estado:'BAIXA_CONCLUIDA'}],[],[{...linha,estado:'PENDENTE_BAIXA'}]).get('contadorPendenciasEstoque').textContent,'0');
});

test('palete excluído continua reservando saldo sem linha ativa',()=>{
 const c={document:{querySelectorAll:()=>[]},window:{__reservasCompartilhadas:[]},lerExpedicoesPendentes:()=>[{...linha,estado:'PENDENTE_BAIXA'}],dadosDaLinhaRomaneio:()=>({...linha}),chaveReservaTeste:(s,l)=>s+':'+l};
 const fonte=html.slice(html.indexOf('function linhasConferenciaEstoque(){'),html.indexOf('function validarReservaTeste('));
 runInNewContext(fonte,c);assert.equal([...c.reservasAtuaisTeste().values()][0],10);
});

test('cópia excluída do mesmo registro com quantidade e data antigas não cria pendência',()=>{
 for(const [atual,antiga] of [[45,32],[39,3]]){
  const els=renderizar([],[{...linha,caixas:atual}],[{...linha,data:'outra data',caixas:antiga,estado:'PENDENTE_BAIXA'}],atual);
  assert.equal(els.get('contadorPendenciasEstoque').textContent,'0');
 }
});
test('IDs distintos no mesmo palete continuam somando pendência real',()=>{
 const els=renderizar([],[{...linha,caixas:45}],[{...linha,registroId:'outra',caixas:32,estado:'PENDENTE_BAIXA'}],45);
 assert.equal(els.get('contadorPendenciasEstoque').textContent,'1');
 assert.match(els.get('listaPendenciasEstoque').children[0].children[1].textContent,/Romaneio: 77 CX/);
});
test('duas parcelas legítimas com mesmo ID mantêm multiplicidade sem duplicar cópias',()=>{
 const els=renderizar([],[linha,{...linha}],[{...linha,estado:'PENDENTE_BAIXA'},{...linha,estado:'PENDENTE_BAIXA'}],19);
 assert.equal(els.get('contadorPendenciasEstoque').textContent,'1');
 assert.match(els.get('listaPendenciasEstoque').children[0].children[1].textContent,/Romaneio: 20 CX/);
});
test('aviso mostra apenas caixas sem baixa quando parte do lote já foi baixada',()=>{
 const els=renderizar([{...linha,estado:'BAIXA_CONCLUIDA'}],[linha,{...linha,registroId:'nova',caixas:12}],[],5);
 assert.equal(els.get('contadorPendenciasEstoque').textContent,'1');
 assert.match(els.get('listaPendenciasEstoque').children[0].children[1].textContent,/Romaneio: 12 CX/);
});
