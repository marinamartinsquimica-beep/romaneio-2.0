import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dispositivoMobile,permiteReceberPaletes} from './direcao-sincronizacao.mjs';

const central=readFileSync(new URL('./central-conexao.html',import.meta.url),'utf8');
const painel=readFileSync(new URL('../index.html',import.meta.url),'utf8');

const android={userAgent:'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 Chrome/145 Mobile Safari/537.36'};
const ios={userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15'};
const tablet={userAgent:'Mozilla/5.0 (Linux; Android 15; Tablet) AppleWebKit/537.36'};
const ipadDesktop={userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',platform:'MacIntel',touchPoints:5};
const pc={userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/155',platform:'Win32',touchPoints:0};

test('Android, iPhone e tablet não recebem paletes remotos',()=>{
 for(const x of [android,ios,tablet,ipadDesktop]){
  assert.equal(dispositivoMobile(x),true);
  assert.equal(permiteReceberPaletes(x),false);
 }
});
test('computador mantém recebimento, inclusive com viewport estreita',()=>{
 assert.equal(dispositivoMobile(pc),false);
 assert.equal(permiteReceberPaletes(pc),true);
 assert.equal(permiteReceberPaletes({userAgentData:{mobile:false},...pc}),true);
});
test('indicador mobile da API também proíbe importar paletes',()=>{
 assert.equal(permiteReceberPaletes({userAgent:'Mozilla/5.0',mobile:true}),false);
});
test('não existe mais caminho de união automática ou manual de entradas no celular',()=>{
 const aplicar=central.slice(central.indexOf('async function aplicarUniaoSeguraOperacional(){'),central.indexOf("$('aplicarUniaoSegura').onclick="));
 assert.match(aplicar,/if\(!receberEntradasNoAparelho\(\)\)throw Error/);
 const guardFinal=aplicar.indexOf("if(!receberEntradasNoAparelho())throw Error('Celular não recebe paletes remotos");
 const gravacao=aplicar.indexOf("localStorage.setItem('entradas',JSON.stringify(resultado))");
 assert.ok(guardFinal>=0&&guardFinal<gravacao);
 assert.match(central,/async function receberAutomaticamente\(\)\{\s*if\(!receberEntradasNoAparelho\(\)\|\|/);
 assert.match(central,/if\(receberEntradasNoAparelho\(\)\)await receberAutomaticamente\(\)/);
});
test('arquivo de exclusões remotas não é importado no celular',()=>{
 assert.match(central,/function registrarExclusoesRecebidas\(snap\)\{\s*if\(!receberEntradasNoAparelho\(\)\)return/);
});
test('conciliar quantidade vinda de outro aparelho também é exclusivo do computador',()=>{
 assert.match(central,/if\(!receberEntradasNoAparelho\(\)\)throw Error\('O celular não importa correções do computador/);
});
test('envio do celular e exclusão local continuam preservados',()=>{
 assert.match(central,/async function enviarFilaAutomaticamente\(\)/);
 assert.match(central,/await enviarFilaAutomaticamente\(\)/);
 const apagar=painel.slice(painel.indexOf('async function reiniciarEntradas()'),painel.indexOf('async function reiniciarCaminhoes()'));
 assert.match(apagar,/registrarMovimentosLocais\(\[\]\)/);
 assert.match(apagar,/localStorage\.removeItem\("entradas"\)/);
 assert.match(apagar,/salvarHistoricoFechamento\(\)/);
});
