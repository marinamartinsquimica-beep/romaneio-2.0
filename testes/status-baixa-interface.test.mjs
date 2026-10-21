import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {registroBaixadoNoEstoque} from '../integracao/status-baixa-romaneio.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../integracao/estoques-firebase-ui.mjs',import.meta.url),'utf8');
const linha={registroId:'reg-existente',data:'20/10/2026',sku:'5002',destino:'SC',palete:'24',loteCompleto:'LOTE',lote:'LT',postura:'19/10/26',caixas:10};
function renderizar(comprovantes,registros=[linha]){
 class El{constructor(){this.children=[];this.style={};this.textContent='';}replaceChildren(){this.children=[];}append(...xs){this.children.push(...xs);}appendChild(x){this.children.push(x);}addEventListener(){}}
 const els=new Map(['listaPendenciasEstoque','contadorPendenciasEstoque','opPendenciasEstoqueResumo'].map(k=>[k,new El()]));
 const linhas=registros.map(x=>({dataset:{registroId:x.registroId},cells:[x.data,x.sku,x.destino,x.palete,x.loteCompleto,x.lote,x.postura,x.caixas].map(t=>({textContent:String(t)}))}));
 const c={window:{estoqueTesteConsulta:new Map([['lote',{sku:'5002',lote:'LOTE',saldo:0}]]),romaneioPossuiBaixaConfirmada:r=>registroBaixadoNoEstoque(r,comprovantes)},document:{getElementById:id=>els.get(id),createElement:()=>new El(),querySelectorAll:selector=>selector.includes('raiar-linha-pendente')?[]:linhas},lerExpedicoesPendentes:()=>[],chaveReservaTeste:(s,l)=>JSON.stringify([s,l])};
 const s=html.slice(html.indexOf('function renderizarPendenciasConferenciaEstoque(){'),html.indexOf('function atualizarResumoReservaTeste()'));
 runInNewContext(s,c);c.renderizarPendenciasConferenciaEstoque();return els;
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
