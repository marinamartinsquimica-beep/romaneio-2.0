import test from 'node:test';
import assert from 'node:assert/strict';
import {podeExpirarHistorico,expirarHistoricosLocais,CHAVE_INDICE_HISTORICOS,RETENCAO_HISTORICOS_MS} from './retencao-historicos.mjs';
const agora=Date.parse('2026-10-21T12:00:00Z');
const antigo={id:'antigo',data:'2026-10-15T12:00:00Z',entradas:[{registroId:'r1'}],pendencias:[]};
function ambiente({falha=false,mudarDurante=false}={}){
 const recente={...antigo,id:'recente',data:'2026-10-20T12:00:00Z'};
 const valores=new Map([[CHAVE_INDICE_HISTORICOS,JSON.stringify([antigo,recente])],['entradas','[]'],['romaneio2_movimentos_pendentes_v1','[]'],['romaneio2_registros_fechados_sync_v1','PROVA'],['estoque','SALDO']]);
 const copias=new Map([['fechamento-antigo',antigo],['fechamento-recente',recente],['backup-seguro',{data:antigo.data}]]);
 const storage={getItem:k=>valores.get(k)??null,setItem:(k,v)=>valores.set(k,v)};
 const idb={open(){const r={};queueMicrotask(()=>{r.result={close(){},transaction(){
  const pendentes=new Map(copias);let abortou=false;
  const tx={abort(){abortou=true;queueMicrotask(()=>tx.onabort?.());},objectStore(){return {get(k){const req={};queueMicrotask(()=>{req.result=pendentes.get(k);if(mudarDurante)valores.set('entradas','[{"registroId":"r1"}]');req.onsuccess?.();queueMicrotask(()=>{if(abortou)return;if(falha){tx.error=Error('Falha no disco');tx.onerror?.();return;}copias.clear();for(const [key,v] of pendentes)copias.set(key,v);tx.oncomplete?.();});});return req;},delete:k=>pendentes.delete(k)};}};
  return tx;
 }};r.onsuccess();});return r;}};
 return {storage,idb,valores,copias};
}
test('cinco dias exatos ainda preservam; só após cinco dias completos pode expirar',()=>{
 assert.equal(podeExpirarHistorico(antigo,{agora:Date.parse(antigo.data)+RETENCAO_HISTORICOS_MS}),false);
 assert.equal(podeExpirarHistorico(antigo,{agora}),true);
 assert.equal(podeExpirarHistorico({...antigo,data:'inválida'},{agora}),false);
});
test('ativo, fila pendente, identidade ausente ou pendência sem baixa impedem limpeza',()=>{
 assert.equal(podeExpirarHistorico(antigo,{agora,ativos:[{registroId:'r1'}]}),false);
 assert.equal(podeExpirarHistorico(antigo,{agora,fila:[{item:{registroId:'r1'}}]}),false);
 assert.equal(podeExpirarHistorico({...antigo,entradas:[{}]},{agora}),false);
 assert.equal(podeExpirarHistorico({...antigo,pendencias:[{estado:'PENDENTE_BAIXA'}]},{agora}),false);
 assert.equal(podeExpirarHistorico({...antigo,pendencias:[{estado:'BAIXA_CONCLUIDA'}]},{agora}),true);
});
test('limpeza transacional remove somente cópia expirada e índice correspondente',async()=>{
 const a=ambiente();assert.equal(await expirarHistoricosLocais({...a,agora}),1);
 assert.equal(a.copias.has('fechamento-antigo'),false);assert.equal(a.copias.has('fechamento-recente'),true);assert.equal(a.copias.has('backup-seguro'),true);
 assert.equal(a.valores.get('romaneio2_registros_fechados_sync_v1'),'PROVA');assert.equal(a.valores.get('estoque'),'SALDO');
 assert.equal(a.valores.get('entradas'),'[]');assert.equal(a.valores.get('romaneio2_movimentos_pendentes_v1'),'[]');
 assert.deepEqual(JSON.parse(a.valores.get(CHAVE_INDICE_HISTORICOS)).map(x=>x.id),['recente']);
});
test('falha no armazenamento não confirma limpeza nem remove índice',async()=>{
 const a=ambiente({falha:true}),antes=a.valores.get(CHAVE_INDICE_HISTORICOS);
 await assert.rejects(expirarHistoricosLocais({...a,agora}),/Falha no disco/);
 assert.equal(a.copias.has('fechamento-antigo'),true);assert.equal(a.valores.get(CHAVE_INDICE_HISTORICOS),antes);
});
test('mudança simultânea dos ativos cancela a exclusão antes do commit',async()=>{
 const a=ambiente({mudarDurante:true});await assert.rejects(expirarHistoricosLocais({...a,agora}),/Dados mudaram/);
 assert.equal(a.copias.has('fechamento-antigo'),true);
});
