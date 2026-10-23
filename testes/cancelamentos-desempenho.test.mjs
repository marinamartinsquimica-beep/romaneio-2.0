import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {criarIndiceCancelamentos} from '../integracao/correcoes-lancamentos.mjs';
import {fontesOperacionais,chaveSelecao} from '../integracao/selecao-romaneios.mjs';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const registro=n=>({registroId:'r'+n,data:'23/10/2026',destino:'RS',palete:'1',sku:'5002',loteCompleto:'L'+n,caixas:1});
test('conferir centenas de linhas lê arquivo e fila apenas uma vez por atualização',()=>{
 const arquivo=Array.from({length:800},(_,n)=>({...registro(n),estado:n===0?'ARQUIVADA_APOS_CONFERENCIA':'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA',...(n===0?{correcaoMovimentoId:'c0'}:{})}));
 const linhas=Array.from({length:200},(_,n)=>({item:registro(n),dataset:{registroId:'r'+n},cells:[registro(n).data,'5002','RS','1','L'+n,'','',1,''].map(v=>({textContent:String(v)}))}));
 let leiturasArquivo=0,leiturasFila=0;
 const c={window:{criarIndiceCancelamentos},document:{querySelectorAll:()=>linhas},dadosDaLinhaRomaneio:l=>l.item,
 lerExpedicoesPendentes:()=>{leiturasArquivo++;return arquivo;},lerFilaMovimentos:()=>{leiturasFila++;return [];}};
 const a=html.indexOf('function linhasConferenciaEstoque(){'),b=html.indexOf('function reservasAtuaisTeste(',a);
 runInNewContext(html.slice(a,b),c);const r=c.linhasConferenciaEstoque();
 assert.equal(r.length,799);assert.equal(leiturasArquivo,1);assert.equal(leiturasFila,1);
});
test('filtrar histórico grande tem crescimento linear de visitas, mantendo substituição válida',()=>{
 let visitas=0;
 const arquivo=Array.from({length:5000},(_,n)=>({...registro(n),get estado(){visitas++;return n%10===0?'ARQUIVADA_APOS_CONFERENCIA':'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA';},...(n%10===0?{correcaoMovimentoId:'c'+n}:{})}));
 const substituto={...registro(0),loteCompleto:'NOVO'};
 const resultado=fontesOperacionais({entradas:[registro(0),substituto],arquivo});
 assert.deepEqual(resultado.entradas,[substituto]);assert.equal(resultado.arquivo.length,4500);
 assert.ok(visitas<=15000,'o histórico não deve ser varrido para cada linha');
});
test('nova atualização do índice reconhece cancelamentos recebidos depois, sem manter resultado antigo',()=>{
 const arquivo=[];const antes=criarIndiceCancelamentos(arquivo);assert.equal(antes(registro(1)),false);
 arquivo.push({...registro(1),estado:'ARQUIVADA_APOS_CONFERENCIA',correcaoMovimentoId:'c1'});
 const depois=criarIndiceCancelamentos(arquivo);assert.equal(depois(registro(1)),true);
 assert.equal(depois({...registro(1),loteCompleto:'NOVO'}),false);
});
test('atualização idêntica mantém os controles de seleção; alteração de caixas redesenha',()=>{
 let redesenhos=0;const alvo={dataset:{},replaceChildren(){redesenhos++;},append(){}};
 let entradas=[registro(1)];
 const elemento=()=>({style:{},addEventListener(){},append(){}});
 const c={document:{getElementById:()=>alvo,createElement:elemento,createTextNode:x=>x},chavesSelecionadas:()=>[],
 lerFontesOperacionais:()=>({entradas,arquivo:[]}),chaveSelecao,invalidarSelecaoPreparada(){}};
 const a=html.indexOf('function renderizarSelecaoRomaneios(){'),b=html.indexOf('function invalidarSelecaoPreparada(){',a);
 runInNewContext(html.slice(a,b),c);c.renderizarSelecaoRomaneios();c.renderizarSelecaoRomaneios();assert.equal(redesenhos,1);
 entradas=[{...registro(1),caixas:2}];c.renderizarSelecaoRomaneios();assert.equal(redesenhos,2);
});
