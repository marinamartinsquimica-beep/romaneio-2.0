import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('histórico de romaneios encerrados aparece apenas no painel do operador',()=>{
  const operador=html.indexOf('id="opVisaoGeral"');
  const historico=html.indexOf('id="operadorHistoricoFechamentos"');
  const finalOperador=html.indexOf('id="opAbaImportacao"');
  const romaneioMobile=html.indexOf('id="abaTotal"');
  assert.ok(operador>=0&&operador<historico&&historico<finalOperador);
  assert.ok(historico<romaneioMobile);
  assert.equal((html.match(/id="historicoFechamentos"/g)||[]).length,1);
  assert.match(html,/@media\s*\(max-width:767px\)\s*\{#operadorHistoricoFechamentos\{display:none!important\}\}/);
});
test('backups e exportação Excel permanecem implementados',()=>{
  assert.match(html,/async function salvarHistoricoFechamento\(\)/);
  assert.match(html,/async function exportarHistoricoFechamento\(id\)/);
  assert.match(html,/romaneio_historico_[^\n]+\.xlsx/);
  assert.match(html,/function renderizarHistoricoFechamentos\(\)/);
});
