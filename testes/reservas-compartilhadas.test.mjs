import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const source=html.slice(html.indexOf('function reservasAtuaisTeste('),html.indexOf('function validarReservaTeste('));
const item=(id,caixas=17)=>({registroId:id,sku:'5008',loteCompleto:'L23',caixas});
const linha=(id,cx,reserva='1')=>({dataset:{registroId:id,reservaTeste:reserva},cells:Array.from({length:8},(_,i)=>({textContent:({1:'5008',4:'L23',7:String(cx)})[i]||''}))});
function calcular(locais,remotos,ignorar){const c={document:{querySelectorAll:()=>locais},window:{__reservasCompartilhadas:remotos},chaveReservaTeste:(s,l)=>s+'|'+l};runInNewContext(source,c);return c.reservasAtuaisTeste(ignorar).get('5008|L23')||0;}
test('outro aparelho sem entradas locais mostra reserva do estoque compartilhado',()=>assert.equal(calcular([], [item('a',156),item('b',129)]),285));
test('mesmo registro local e remoto conta uma vez, mantendo edição local pendente',()=>assert.equal(calcular([linha('a',20)],[item('a'),item('b',3)]),23));
test('registro remoto conta mesmo quando linha local não tem marcador de reserva',()=>assert.equal(calcular([linha('a',17,'')],[item('a')]),17));
test('editar não conta novamente o registro ignorado e preserva demais reservas',()=>assert.equal(calcular([linha('a',17)],[item('a'),item('b',3)],0),3));
test('sem conexão preserva cálculo local existente',()=>assert.equal(calcular([linha('a',17)],null),17));
