import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {criarControleLeituras} from '../integracao/controle-leituras-automaticas.mjs';
const html=readFileSync(new URL('../integracao/central-conexao.html',import.meta.url),'utf8');
const ui=readFileSync(new URL('../integracao/estoques-firebase-ui.mjs',import.meta.url),'utf8');
function simular(desktop){
 let tempo=1000000;const contagem={envios:0,recepcoes:0,expedicoes:0,consolidacoes:0};
 const dados=new Map([['entradas','[{"registroId":"preservado"}]'],['romaneio2_movimentos_pendentes_v1','[]'],['romaneio2_historico_fechamentos_v1','[{"id":"historico-preservado"}]']]);
 const fonte=html.slice(html.indexOf('let cicloEmAndamento=false,'),html.indexOf("window.addEventListener('online',()=>{void cicloAutomatico();"));
 const c={Date:{now:()=>tempo},JSON,auth:{currentUser:{uid:'marina'}},navigator:{onLine:true},escopoOperacionalPronto:true,ambienteOperacional:{ambienteId:'sala-ovos'},ultimaAssinaturaRemota:'mov1',localStorage:{getItem:k=>dados.get(k)||null,setItem:()=>{throw Error('Agendamento não deve gravar dados')},removeItem:()=>{throw Error('Agendamento não deve apagar dados')}},lerOperacional:()=>[],criarControleLeituras:()=>criarControleLeituras({agora:()=>tempo}),enviarFilaAutomaticamente:async()=>contagem.envios++,consolidarBaseLegada:async()=>contagem.consolidacoes++,receberEntradasNoAparelho:()=>desktop,receberAutomaticamente:async()=>contagem.recepcoes++,sincronizarExpedicoesCompartilhadas:async()=>contagem.expedicoes++,$:()=>({textContent:''})};
 runInNewContext(fonte,c);
 return {c,contagem,dados,avancar:t=>{tempo=t},async hora(){for(let s=0;s<3600;s+=5){tempo=1000000+s*1000;await c.cicloAutomatico();}}};
}
test('computador sem novidades: 12 consultas de expedições por hora, preservando dados e envio',async()=>{
 const a=simular(true),antes=JSON.stringify([...a.dados]);await a.hora();
 assert.equal(a.contagem.expedicoes,12);assert.equal(a.contagem.recepcoes,12);assert.equal(a.contagem.envios,720);
 assert.equal(JSON.stringify([...a.dados]),antes);
});
test('celular sem consultas de recepção, expedições ou consolidação; envio permanece',async()=>{
 const a=simular(false),antes=JSON.stringify([...a.dados]);await a.hora();
 assert.deepEqual(a.contagem,{envios:720,recepcoes:0,expedicoes:0,consolidacoes:0});assert.equal(JSON.stringify([...a.dados]),antes);
});
test('movimento novo e pedido manual disparam consulta antes do prazo de conferência',async()=>{
 const a=simular(true);await a.c.cicloAutomatico();a.avancar(1005000);a.c.ultimaAssinaturaRemota='mov2';await a.c.cicloAutomatico();
 assert.equal(a.contagem.recepcoes,2);assert.equal(a.contagem.expedicoes,2);
 a.dados.set('romaneio2_solicitar_sincronizacao_v1','pedido-manual');await a.c.cicloAutomatico();assert.equal(a.contagem.expedicoes,3);
});
test('fila pendente não bloqueia conciliação de baixas nem deixa receber por cima da fila',async()=>{
 const a=simular(true);a.c.lerOperacional=()=>[{id:'aguardando'}];await a.c.cicloAutomatico();
 assert.equal(a.contagem.envios,1);assert.equal(a.contagem.recepcoes,0);assert.equal(a.contagem.expedicoes,1);
});
test('celular não cria assinatura de movimentos e guarda adicional impede expedições diretas',async()=>{
 let assinaturas=0;
 const fonte=html.slice(html.indexOf('function observarMovimentosAutomaticos(u){'),html.indexOf('// O painel já acompanha expedições:'));
 const c={contaObservada:null,cancelarMudancasRemotas:null,ultimaAssinaturaRemota:null,receberEntradasNoAparelho:()=>false,onSnapshot:()=>assinaturas++};runInNewContext(fonte,c);c.observarMovimentosAutomaticos({uid:'salaovos'});assert.equal(assinaturas,0);
 const inicio=html.indexOf('async function sincronizarExpedicoesCompartilhadasInterno(){');
 assert.match(html.slice(inicio,inicio+200),/if\(!receberEntradasNoAparelho\(\)\)return/);
});
test('aviso de expedição exige mesma origem, janela, conta e ambiente; consulta servidor continua obrigatória',async()=>{
 const a=simular(true);await a.c.cicloAutomatico();let listener;const parent={};Object.assign(a.c,{window:{parent,addEventListener:(_nome,fn)=>{listener=fn}},location:{origin:'https://romaneio.example'}});
 const fonte=html.slice(html.indexOf("window.addEventListener('message',e=>{\n if(e.origin!==location.origin||e.source!==window.parent"),html.indexOf('setInterval(()=>{if(navigator.onLine)void cicloAutomatico();},5000);'));
 runInNewContext(fonte,a.c);
 const msg={origin:a.c.location.origin,source:parent,data:{origem:'romaneio-expedicoes-alteradas',uid:'marina',ambienteId:'sala-ovos'}};
 listener({...msg,origin:'https://outro.example'});listener({...msg,data:{...msg.data,uid:'outra'}});listener({...msg,data:{...msg.data,ambienteId:'outro'}});assert.equal(a.contagem.expedicoes,1);
 listener(msg);await new Promise(resolve=>setImmediate(resolve));assert.equal(a.contagem.expedicoes,2);assert.equal(a.contagem.recepcoes,2);
 assert.match(html,/getDocsFromServer\(consulta\)/);
});
test('consultas simultâneas do painel são agrupadas sem perder uma alteração durante a consulta',()=>{
 const inicio=ui.indexOf(' let atualizacaoPaletes=');const trecho=ui.slice(inicio,ui.indexOf(' async function atualizarPaletesCompartilhados(){',inicio));
 let proximo=0,consultas=0;const timers=new Map();const c={clearTimeout:id=>timers.delete(id),setTimeout:fn=>{timers.set(++proximo,fn);return proximo},unsub:[],atualizarPaletesCompartilhados:()=>consultas++};runInNewContext(trecho,c);
 c.agendarConsultaCompartilhada();c.agendarConsultaCompartilhada();c.agendarConsultaCompartilhada();assert.equal(timers.size,1);[...timers.values()][0]();assert.equal(consultas,1);
 assert.match(ui,/if\(refazerConsulta\)\{refazerConsulta=false;void atualizarPaletesCompartilhados\(\);\}/);
 assert.match(ui,/Date.now\(\)-ultimaConsultaPaletes>=300000/);
});
