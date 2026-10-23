import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {registrarFechamento,filtrarMovimentosJaFechados} from './marcos-romaneios-fechados.mjs';
const item=(id,extra={})=>({registroId:id,data:'2026-10-19',palete:'7',destino:'Taeque',sku:'9876',loteCompleto:'L30.10.17.10.26',postura:'17.10.26',caixas:17,...extra});
const evento=(id,criadoEm,x=item(id))=>({tipo:'inclusao',id:'evento_'+id,criadoEm,item:x});
const corte='2026-10-19T14:00:00Z';
test('palete apagado não volta quando o celular ainda tem evento antigo',()=>{
 const dados=registrarFechamento([item('registro-7')],[],corte);
 const r=filtrarMovimentosJaFechados([evento('registro-7','2026-10-19T13:00:00Z')],dados);
 assert.equal(r.length,0);
});
test('evento realmente novo após o fechamento permanece visível',()=>{
 const dados=registrarFechamento([item('registro-7')],[],corte);
 const r=filtrarMovimentosJaFechados([evento('registro-7','2026-10-19T14:10:00Z')],dados);
 assert.equal(r.length,1);
});
test('mesmo SKU lote e palete com novo registroId não é tratado como repetido',()=>{
 const dados=registrarFechamento([item('registro-7')],[],corte);
 assert.equal(filtrarMovimentosJaFechados([evento('registro-NOVO','2026-10-19T13:00:00Z')],dados).length,1);
});
test('sem registroId: usa data palete destino SKU lote postura e caixas',()=>{
 const antigo=item('',{registroId:''});
 const dados=registrarFechamento([antigo],[],corte);
 assert.equal(filtrarMovimentosJaFechados([evento('','2026-10-19T13:00:00Z',antigo)],dados).length,0);
 assert.equal(filtrarMovimentosJaFechados([evento('','2026-10-19T13:00:00Z',{...antigo,caixas:18})],dados).length,1);
});
test('marcadores anteriores são preservados ao limpar novo romaneio',()=>{
 const primeiro=registrarFechamento([item('A')],[],corte);
 const final=registrarFechamento([item('B')],primeiro,'2026-10-19T15:00:00Z');
 assert.equal(final.length,2);
 assert.equal(filtrarMovimentosJaFechados([evento('A','2026-10-19T12:00:00Z'),evento('B','2026-10-19T14:50:00Z')],final).length,0);
});
test('o filtro não modifica os movimentos do Firebase',()=>{
 const movs=[evento('A','2026-10-19T12:00:00Z')],original=JSON.stringify(movs);
 filtrarMovimentosJaFechados(movs,registrarFechamento([item('A')],[],corte));
 assert.equal(JSON.stringify(movs),original);
});
test('o aplicativo grava marcadores antes de limpar e verifica antes da união',()=>{
 const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const central=readFileSync(new URL('./central-conexao.html',import.meta.url),'utf8');
 assert.ok(index.indexOf('localStorage.setItem(CHAVE_FECHAMENTOS')<index.indexOf('localStorage.removeItem("entradas")'));
 assert.match(central,/const movs=filtrarEventosBaixados\(filtrarMovimentosJaFechados\(movimentosRecepcao,fechamentosBrutos\),expedicoesRecepcao\)/);
});


test('exclusão sem baixa fecha somente versão selecionada, preservando outra com mesmo ID',()=>{
 const antigo={registroId:'mesmo-id',data:'23/10/2026',destino:'RS',palete:'1',sku:'5002',loteCompleto:'ANTIGO',caixas:35};
 const novo={...antigo,loteCompleto:'NOVO',caixas:40};
 const fechados=registrarFechamento([antigo],[],'2026-10-23T13:00:00Z',{porVersao:true});
 const eventos=[antigo,novo].map((item,i)=>({id:'evento-'+i,tipo:'inclusao',criadoEm:'2026-10-23T12:00:00Z',item}));
 assert.deepEqual(filtrarMovimentosJaFechados(eventos,fechados),[eventos[1]]);
});
