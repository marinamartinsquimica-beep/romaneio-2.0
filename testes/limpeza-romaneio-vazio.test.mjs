import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const inicio=source.indexOf('async function reiniciarEntradas()');
const fim=source.indexOf('async function reiniciarCaminhoes()',inicio);
const limpar=source.slice(inicio,fim);

test('romaneio vazio pode ser limpo sem bloquear pela fila de outros registros',()=>{
 assert.match(limpar,/const romaneioAtivo=/);
 assert.match(limpar,/if\(!dispositivoCelular&&filaPendente&&romaneioAtivo\)/);
 assert.doesNotMatch(limpar,/if\(!dispositivoCelular&&lerFilaMovimentos\(\)\.length\)/);
});
test('com entradas e fila pendente a limpeza continua bloqueada',()=>{
 assert.match(limpar,/entradasAtuais\.length>0/);
 assert.match(limpar,/tabelaAtiva/);
 assert.match(limpar,/Sincronize antes de apagar um romaneio com entradas/);
});
test('fila e base pendentes não são apagadas ao limpar tela vazia',()=>{
 assert.doesNotMatch(limpar,/removeItem\(FILA_MOVIMENTOS_KEY\)|setItem\(FILA_MOVIMENTOS_KEY,/);
 assert.match(limpar,/else if\(!filaPendente\)/);
 assert.match(limpar,/localStorage\.setItem\(BASE_MOVIMENTOS_KEY,'\[\]'\)/);
});
test('a cópia de segurança permanece antes da limpeza',()=>{
 assert.ok(limpar.indexOf('await salvarHistoricoFechamento()')>=0);
 assert.ok(limpar.indexOf('await salvarHistoricoFechamento()')<limpar.indexOf('localStorage.removeItem("entradas")'));
});
test('o celular continua registrando exclusões em sua fila',()=>{
 assert.match(limpar,/if\(dispositivoCelular\)\{/);
 assert.match(limpar,/registrarMovimentosLocais\(\[\]\)/);
});
