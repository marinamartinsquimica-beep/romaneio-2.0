import test from 'node:test';
import assert from 'node:assert/strict';
import {filtrarExpedicoesJaBaixadas} from './filtro-expedicoes-baixadas.mjs';
import {identidadeExpedicaoBaixa} from './baixa-transacional.mjs';
const base=[
 {registroId:'id-1',palete:'1',destino:'A',sku:'3938',loteCompleto:'L21.15.13.10.26',caixas:10},
 {registroId:'id-2',palete:'2',destino:'B',sku:'5008',loteCompleto:'L25.03.14.10.26',caixas:50},
 {registroId:'id-3',palete:'3',destino:'C',sku:'3826',loteCompleto:'L32.18.13.10.26',caixas:16}
];
const key=x=>identidadeExpedicaoBaixa(x,true).id;
test('BAIXA TOTAL ignora o romaneio já baixado e mantém somente os dois novos',async()=>{
 const docs=new Map([[key(base[0]),{...base[0],estado:'BAIXA_CONCLUIDA'}]]);
 const r=await filtrarExpedicoesJaBaixadas({
  registros:base,destino:'TODOS OS DESTINOS',buscar:async id=>docs.get(id)||null
 });
 assert.deepEqual(r.concluidos.map(x=>x.registroId),['id-1']);
 assert.deepEqual(r.pendentes.map(x=>x.registroId),['id-2','id-3']);
 assert.equal(r.pendentes.reduce((s,x)=>s+x.caixas,0),66);
});
test('todas as expedições concluídas ficam fora da nova baixa',async()=>{
 const docs=new Map(base.map(x=>[key(x),{...x,estado:'BAIXA_CONCLUIDA'}]));
 const r=await filtrarExpedicoesJaBaixadas({
  registros:base,destino:'TODOS OS DESTINOS',buscar:async id=>docs.get(id)||null
 });
 assert.equal(r.pendentes.length,0);
 assert.equal(r.concluidos.length,3);
});
test('exclusão posterior do celular não permite baixar novamente um registro já concluído',async()=>{
 const x={...base[0],movimentoExclusaoId:'movimento-exclusao-1'};
 const ativo=identidadeExpedicaoBaixa(base[0],true).id;
 const remoto=identidadeExpedicaoBaixa(x,false).id;
 const docs=new Map([
  [remoto,{...x,estado:'PENDENTE_BAIXA'}],
  [ativo,{...base[0],estado:'BAIXA_CONCLUIDA'}]
 ]);
 const r=await filtrarExpedicoesJaBaixadas({
  registros:[x],destino:'TODOS OS DESTINOS',buscar:async id=>docs.get(id)||null
 });
 assert.equal(r.pendentes.length,0);
 assert.equal(r.concluidos.length,1);
});
test('registro concluído divergente bloqueia rebaixa e exige conferência manual',async()=>{
 const x=base[0];
 await assert.rejects(
  filtrarExpedicoesJaBaixadas({
   registros:[x],destino:'TODOS OS DESTINOS',
   buscar:async()=>({...x,caixas:9,estado:'BAIXA_CONCLUIDA'})
  }),
  /dados divergentes/
 );
});
test('falha na consulta remota bloqueia em vez de utilizar cache ou descontar',async()=>{
 await assert.rejects(
  filtrarExpedicoesJaBaixadas({
   registros:[base[0]],destino:'TODOS OS DESTINOS',
   buscar:async()=>{throw Error('Firebase offline');}
  }),
  /Firebase offline/
 );
});
