import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {paletesOutrosUsuarios} from './painel-paletes-outros-usuarios.mjs';
import {identidadeExpedicaoBaixa} from './baixa-transacional.mjs';
const p=(id,sku='5008')=>({registroId:id,sku,loteCompleto:'L23.07.14.10.26',lote:'L23',postura:'14.10.26',data:'2026-10-20',palete:'12',destino:'Taeque',caixas:17});
const m=(tipo,id,item,autorUid='salaovos',hora='2026-10-20T08:00:00Z',antes=null)=>({id,tipo,item,autorUid,criadoEm:hora,antes});
const inclusao=(item,autor='salaovos')=>m('inclusao','mov-'+item.registroId,item,autor);
const consulta=(movimentos,locais=[],expedicoes=[],fechamentos=[])=>paletesOutrosUsuarios({movimentos,uidAtual:'marina',entradasLocais:locais,expedicoes,fechamentos});
test('outro usuário vê palete do salaovos sem receber em entradas locais',()=>{
 const locais=[];const r=consulta([inclusao(p('abc-12345'))],locais);
 assert.equal(r.remotos.length,1);assert.equal(r.remotos[0].sku,'5008');
 assert.deepEqual(locais,[]);
});
test('mesmo login salaovos não recebe painel adicional',()=>{
 const r=paletesOutrosUsuarios({movimentos:[inclusao(p('abc-12345'))],uidAtual:'salaovos',entradasLocais:[],fechamentos:[],expedicoes:[]});
 assert.equal(r.remotos.length,0);
});
test('não duplica registro já presente no computador',()=>{
 const item=p('abc-12345');const r=consulta([inclusao(item)],[item]);
 assert.equal(r.remotos.length,0);
});
test('exclusão do celular remove da visão compartilhada',()=>{
 const item=p('abc-12345');const r=consulta([inclusao(item),m('exclusao','excl-1',item,'salaovos','2026-10-20T09:00:00Z')]);
 assert.equal(r.remotos.length,0);
});
test('baixa concluída não aparece como palete ativo compartilhado',()=>{
 const item=p('abc-12345');const exp=identidadeExpedicaoBaixa(item,true).id;
 const r=consulta([inclusao(item)],[],[{id:exp,estado:'BAIXA_CONCLUIDA'}]);
 assert.equal(r.remotos.length,0);
});
test('historico incompleto não cria palete fictício',()=>{
 const item=p('abc-12345');const r=consulta([m('edicao','edit-1',item)]);
 assert.equal(r.remotos.length,0);assert.equal(r.incertos.length,1);
});
test('marcador local de fechamento impede reimportação da expedição antiga',()=>{
 const item=p('abc-12345');
 const r=consulta([inclusao(item)],[],[],[{chave:'id:ABC-12345',registroId:'ABC-12345',fechadoEm:'2026-10-20T10:00:00Z'}]);
 assert.equal(r.remotos.length,0);
});
test('código do painel não altera a sincronização local nem o armazenamento de entradas',()=>{
 const ui=readFileSync(new URL('./estoques-firebase-ui.mjs',import.meta.url),'utf8');
 const inicio=ui.indexOf('async function atualizarPaletesCompartilhados()');
 const fim=ui.indexOf('window.__paletesDeOutrosUsuarios=resultado.remotos;',inicio);
 const secao=ui.slice(inicio,fim);
 assert.match(secao,/getDocsFromServer\(consulta\)/);
 assert.match(secao,/paletesOutrosUsuarios\(/);
 assert.doesNotMatch(secao,/localStorage\.setItem\('entradas'/);
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/btn.addEventListener\('click',\(\)=>abrirConsultaCompartilhada\(d.destino,d.palete\)\)/);
 assert.doesNotMatch(html,/btn.textContent='Consulta compartilhada';btn.disabled=true/);
});
