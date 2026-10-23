import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const codigo=readFileSync(new URL('../service-worker.js',import.meta.url),'utf8');
const js=()=>new Response('export const valor=240;',{headers:{'content-type':'text/javascript'}});
function worker({rede=async()=>{throw Error('offline')},cache=null}={}){
 const eventos={};const inicio=new Response('<html>Entrada</html>',{headers:{'content-type':'text/html'}});
 const contexto={URL,Response,fetch:rede,caches:{match:async req=>req==='./inicio.html'?inicio:cache,open:async()=>({put:async()=>{}})},self:{addEventListener:(tipo,fn)=>eventos[tipo]=fn}};
 vm.runInNewContext(codigo,contexto);
 return async(path,mode='cors')=>{let resultado;eventos.fetch({request:{method:'GET',url:'https://exemplo.test/'+path,mode},respondWith:p=>resultado=p});return resultado;};
}
test('falha de rede recupera leitor da cópia local sem devolver HTML',async()=>{
 const resposta=await worker({cache:js()})('integracao/leitor-paripassu.mjs?v=2.0.120');
 assert.equal(resposta.headers.get('content-type'),'text/javascript');assert.match(await resposta.text(),/240/);
});
test('sem leitor em cache, falha de módulo não devolve a página de entrada',async()=>{
 const resposta=await worker()('integracao/leitor-paripassu.mjs?v=2.0.120');
 assert.equal(resposta.type,'error');assert.equal(await resposta.text(),'');
});
test('resposta HTML recebida no endereço do leitor usa a cópia JavaScript',async()=>{
 const resposta=await worker({rede:async()=>new Response('<html>Erro</html>',{headers:{'content-type':'text/html'}}),cache:js()})('integracao/leitor-paripassu.mjs');
 assert.equal(resposta.headers.get('content-type'),'text/javascript');
});
test('erro HTTP de publicação transitória recupera leitor local',async()=>{
 const resposta=await worker({rede:async()=>new Response('indisponível',{status:503}),cache:js()})('integracao/leitor-paripassu.mjs');
 assert.equal(resposta.status,200);assert.match(await resposta.text(),/240/);
});
test('navegação offline continua abrindo a tela de entrada',async()=>{
 const resposta=await worker()('index.html','navigate');assert.match(await resposta.text(),/Entrada/);
});
test('importação e conferência pedem o mesmo leitor identificado e pré-carregado',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../integracao/estoques-firebase-ui.mjs',import.meta.url),'utf8');
 const leitor=index.match(/leitor-paripassu\.mjs\?v=[\d.]+/)[0];
 assert.ok(ui.includes(leitor));assert.ok(codigo.includes(leitor));
});
test('cópia local de módulo com conteúdo HTML também é recusada',async()=>{
 const cache=new Response('<html>Entrada</html>',{headers:{'content-type':'text/html'}});
 const resposta=await worker({cache})('integracao/leitor-paripassu.mjs');
 assert.equal(resposta.type,'error');
});
