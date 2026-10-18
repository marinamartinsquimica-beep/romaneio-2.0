import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createContext,runInContext} from 'node:vm';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const inicio=html.indexOf('let swRegistration = null;');
const fim=html.indexOf('let deferredInstallPrompt = null;',inicio);
assert.ok(inicio>=0&&fim>inicio,'Trecho de atualização não encontrado');
const codigo=html.slice(inicio,fim);

function ambiente(versaoServidor='2.0.74'){
 const classes=new Set(),callbacks={},docCallbacks={},swCallbacks={},timeouts=[];
 const botao={disabled:false,textContent:'Atualizar agora'};
 let comparacoes=0,alteracoes=0,consultas=0,reloads=0;
 const register={waiting:null,update:async()=>{alteracoes++;},addEventListener(){}};
 const ctx=createContext({
   navigator:{serviceWorker:{
     register:async()=>register,
     addEventListener:(n,cb)=>{swCallbacks[n]=cb},
     controller:{}
   }},
   window:{location:{replace(){reloads++;}},addEventListener:(n,cb)=>{callbacks[n]=cb}},
   document:{
     hidden:false,
     getElementById:id=>id==='updateBanner'?{classList:{
       add:c=>{comparacoes++;classes.add(c)},
       remove:c=>classes.delete(c)
     }}:id==='updateNowBtn'?botao:null,
     addEventListener:(n,cb)=>{docCallbacks[n]=cb}
   },
   fetch:async()=>{consultas++;return {ok:true,json:async()=>({version:versaoServidor})};},
   Date,encodeURIComponent,setInterval(){},
   setTimeout:(cb)=>{timeouts.push(cb)},
   console:{warn(){}}
 });
 runInContext('const APP_VERSION="2.0.74";const VERSION_URL="version.json";\n'+codigo,ctx);
 return {
   ctx,classes,botao,callbacks,docCallbacks,swCallbacks,timeouts,register,
   get mostra(){return classes.has('show')},
   get chamadasDeExibicao(){return comparacoes},
   get consultas(){return consultas},
   get reloads(){return reloads},
   get atualizacoesWorker(){return alteracoes}
 };
}
test('com versão igual, aviso não aparece nem com worker instalado',async()=>{
 const a=ambiente('2.0.74');
 await a.ctx.verificarVersaoPublicada();
 a.swCallbacks.controllerchange();
 assert.equal(a.mostra,false);
 assert.equal(a.reloads,0);
});
test('uma versão mais antiga que a instalada não gera falso aviso',async()=>{
 const a=ambiente('2.0.73');
 await a.ctx.verificarVersaoPublicada();
 assert.equal(a.mostra,false);
});
test('somente versão numericamente superior exige atualização',()=>{
 const a=ambiente();
 assert.equal(a.ctx.versaoPublicadaMaisNova('2.0.75','2.0.74'),true);
 assert.equal(a.ctx.versaoPublicadaMaisNova('2.0.74','2.0.74'),false);
 assert.equal(a.ctx.versaoPublicadaMaisNova('2.0.73','2.0.74'),false);
 assert.equal(a.ctx.versaoPublicadaMaisNova('2.0.9','2.0.74'),false);
 assert.equal(a.ctx.versaoPublicadaMaisNova('2.0.100','2.0.74'),true);
 assert.equal(a.ctx.versaoPublicadaMaisNova('inválido','2.0.74'),false);
});
test('diversos avisos simultâneos, online/visibilidade, mantêm um único banner',async()=>{
 const a=ambiente('2.0.75');
 await Promise.all([a.ctx.verificarVersaoPublicada(),a.ctx.verificarVersaoPublicada(),a.ctx.verificarVersaoPublicada()]);
 assert.equal(a.consultas,1);
 assert.equal(a.mostra,true);
 // Há um único elemento de banner no HTML; show usa apenas classList.
 assert.equal((html.match(/id="updateBanner"/g)||[]).length,1);
 assert.equal(a.chamadasDeExibicao,1);
});
test('um clique atualiza somente uma vez, inclusive com controllerchange repetido',async()=>{
 const a=ambiente('2.0.75');
 await a.ctx.verificarVersaoPublicada();
 await Promise.all([a.ctx.aplicarAtualizacao(),a.ctx.aplicarAtualizacao()]);
 a.swCallbacks.controllerchange();
 a.swCallbacks.controllerchange();
 assert.equal(a.reloads,1);
 assert.equal(a.botao.disabled,true);
});
test('worker em espera sem nova versão não força aviso',async()=>{
 const a=ambiente('2.0.74');
 a.register.waiting={postMessage(){}};
 await Promise.resolve();await Promise.resolve();
 await a.ctx.verificarVersaoPublicada();
 assert.equal(a.mostra,false);
 assert.equal(a.reloads,0);
});
