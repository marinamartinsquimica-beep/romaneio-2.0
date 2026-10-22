import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {runInNewContext} from 'node:vm';
import {conciliarCorrecoes,identificarCorrecoes} from '../integracao/correcoes-lancamentos.mjs';
const html=readFileSync(new URL('../integracao/central-conexao.html',import.meta.url),'utf8');
const fonte=html.slice(html.indexOf('function aplicarCorrecoesConfirmadas('),html.indexOf('let baseRecebida=null;'));
const item={registroId:'cancelar-0001',data:'22/10/2026',sku:'5002',destino:'DESTINO',palete:'1',loteCompleto:'LOTE-A',postura:'21/10/26',caixas:10};
const evento={id:'mov-cancelamento',tipo:'exclusao',criadoEm:'2026-10-22T12:00:00Z',item:{...item,finalidadeExclusao:'CORRECAO_LANCAMENTO'}};
const docs=ms=>ms.map(m=>({id:m.id,data:()=>m}));
function ambiente(ms=[evento],mobile=false){
 const store=new Map([['entradas',JSON.stringify([item,{...item,registroId:'atual-0002',loteCompleto:'LOTE-B'}])],['romaneio2_ultimo_estado_movimentos_v1',JSON.stringify([item])]]);
 const base={movimentos:{revisao:1},expedicoes:{ler:async()=>({docs:[]})}};
 const c={conciliarCorrecoes,identificarCorrecoes,receberEntradasNoAparelho:()=>!mobile,baseRecebida:base,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)}};
 runInNewContext(fonte,c);return {c,store,snap:{docs:docs(ms),revisao:1}};
}
test('cancelamento confirmado chega ao desktop, preserva outro lote e não recria pendência após repetição',async()=>{
 const {c,store,snap}=ambiente();await c.registrarExclusoesRecebidas(snap);
 assert.equal(JSON.parse(store.get('entradas')).length,1);assert.equal(JSON.parse(store.get('entradas'))[0].loteCompleto,'LOTE-B');
 const chave='romaneio2_expedicoes_excluidas_pendentes_v1';assert.equal(JSON.parse(store.get(chave))[0].estado,'ARQUIVADA_APOS_CONFERENCIA');
 assert.equal(JSON.parse(store.get('romaneio2_ultimo_estado_movimentos_v1')).length,0);
 const antes=store.get(chave);await c.registrarExclusoesRecebidas(snap);assert.equal(store.get(chave),antes);
 assert.equal(JSON.parse(store.get('romaneio2_auditoria_correcoes_lancamentos_v1')).length,1);
});
test('remover por expedição mantém palete e pendência de baixa',async()=>{
 const {c,store,snap}=ambiente([{...evento,item}]);await c.registrarExclusoesRecebidas(snap);
 assert.equal(JSON.parse(store.get('entradas')).length,2);assert.equal(JSON.parse(store.get('romaneio2_expedicoes_excluidas_pendentes_v1'))[0].estado,'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA');
});
test('celular não recebe cancelamentos remotos',async()=>{
 const {c,store,snap}=ambiente([evento],true);const antes=store.get('entradas');await c.registrarExclusoesRecebidas(snap);assert.equal(store.get('entradas'),antes);assert.equal(store.size,2);
});
test('sem confirmação de comprovantes não aplica cancelamento',async()=>{
 const {c,store,snap}=ambiente();c.baseRecebida.expedicoes.ler=async()=>{throw Error('offline')};const antes=store.get('entradas');await assert.rejects(c.registrarExclusoesRecebidas(snap),/offline/);assert.equal(store.get('entradas'),antes);
});
