import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const ini=html.indexOf('async function resolverPendenciasSincronizacao(');
const source=html.slice(ini,html.indexOf('\nwindow.addEventListener("load"',ini));
async function executar({online=true,falhar=false,restantes=0}={}){
 let fila=[{id:'a'},{id:'b'}],chamadas=0,reaberturas=0;
 const mensagem={textContent:''},botao={disabled:false};
 const c={navigator:{onLine:online},lerFilaMovimentos:()=>fila,atualizarIndicadorFilaMovimentos(){},operadorAtualizarPainel(){},consultarFilaMovimentos(){reaberturas++},document:{getElementById:()=>mensagem}};
 runInNewContext(source,c);
 await c.resolverPendenciasSincronizacao(botao,mensagem,async()=>({async sincronizarMovimentos250(){chamadas++;if(falhar)throw Error('Permissão negada');fila=fila.slice(0,restantes);}}));
 return {fila,chamadas,reaberturas,mensagem,botao};
}
test('envio confirmado atualiza a janela e informa conclusão',async()=>{const r=await executar();assert.equal(r.fila.length,0);assert.equal(r.chamadas,1);assert.equal(r.reaberturas,1);assert.match(r.mensagem.textContent,/confirmadas/);assert.equal(r.botao.disabled,true)});
test('envio parcial mantém as pendências e permite tentar novamente',async()=>{const r=await executar({restantes:1});assert.equal(r.fila.length,1);assert.match(r.mensagem.textContent,/1 movimentação/);assert.equal(r.botao.disabled,false)});
test('falha de acesso preserva fila e orienta Central de Conexão',async()=>{const r=await executar({falhar:true});assert.deepEqual(r.fila,[{id:'a'},{id:'b'}]);assert.match(r.mensagem.textContent,/Permissão negada.*Central de Conexão/)});
test('offline não tenta enviar nem remove eventos',async()=>{const r=await executar({online:false});assert.equal(r.chamadas,0);assert.equal(r.fila.length,2);assert.match(r.mensagem.textContent,/Sem internet/)});
