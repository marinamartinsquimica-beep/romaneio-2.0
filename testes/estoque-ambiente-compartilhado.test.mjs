import test from 'node:test';
import assert from 'node:assert/strict';
import {publicarEstoqueOficial} from '../integracao/publicacao-estoques.mjs';
const dados={tipo:'embalado',nome:'ESTOQUE.xlsx',versao:'nova-001',itens:[{sku:'G',lote:'001',saldo:12}]};
function deps({atual=null}={}){
 let rota=null,gravado=null;
 const doc=(_db,...partes)=>{rota=partes;return partes};
 const runTransaction=async(_db,fn)=>fn({
  get:async()=>({exists:()=>!!atual,data:()=>atual}),
  set:(_ref,val)=>{gravado=val}
 });
 return {doc,runTransaction,get rota(){return rota},get gravado(){return gravado}};
}
test('publicação do operador usa ambiente compartilhado sem baixar estoque',async()=>{
 const d=deps();
 await publicarEstoqueOficial({db:{},uid:'uid-operador',tipo:'embalado',dados,versaoEsperada:'',autorizado:true,ambienteId:'ambiente001',doc:d.doc,runTransaction:d.runTransaction});
 assert.deepEqual(d.rota,['romaneio_ambientes','ambiente001','estoques_oficiais','embalado']);
 assert.equal(d.gravado.autorUid,'uid-operador');
 assert.equal(d.gravado.itens[0].saldo,12);
});
test('conta antiga mantém publicação legada',async()=>{
 const d=deps();
 await publicarEstoqueOficial({db:{},uid:'uid-antigo',tipo:'embalado',dados,versaoEsperada:'',autorizado:true,doc:d.doc,runTransaction:d.runTransaction});
 assert.deepEqual(d.rota,['rom_v250_contas','uid-antigo','estoques_oficiais','embalado']);
});
test('rejeita versão desatualizada sem gravar dados',async()=>{
 const d=deps({atual:{versao:'alterada-por-outro-usuario'}});
 await assert.rejects(publicarEstoqueOficial({db:{},uid:'uid-operador',tipo:'embalado',dados,versaoEsperada:'anterior',autorizado:true,ambienteId:'ambiente001',doc:d.doc,runTransaction:d.runTransaction}),/outro operador/);
 assert.equal(d.gravado,null);
});
