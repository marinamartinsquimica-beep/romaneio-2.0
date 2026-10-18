import test from 'node:test';
import assert from 'node:assert/strict';
import {migrarHistorico} from '../integracao/migracao-historico.mjs';
test('migração em lote preserva ids e reexecução não duplica',async()=>{
 const fonte=[{id:'op_12345678',dados:{id:'op_12345678',tipo:'inclusao',autorUid:'uid1'}},{id:'op_87654321',dados:{id:'op_87654321',tipo:'exclusao',autorUid:'uid1'}}];
 const destino=new Map(),base={origemUid:'uid1',ambienteId:'operacao01',lerPagina:async({cursor})=>cursor?{registros:[],proximoCursor:null}:{registros:fonte,proximoCursor:null},lerDestino:async({id})=>destino.get(id),criarDestino:async({id,dados})=>destino.set(id,dados),registrarResumo:async()=>{}};
 const primeiro=await migrarHistorico(base),segundo=await migrarHistorico(base);
 assert.equal(primeiro.copiados,2);assert.equal(segundo.copiados,0);assert.equal(segundo.existentes,2);assert.equal(destino.size,2);
});
test('migração interrompe conflitos sem sobrescrever',async()=>{
 const dados={id:'op_12345678',tipo:'inclusao'};
 const base={origemUid:'uid1',ambienteId:'operacao01',lerPagina:async()=>({registros:[{id:'op_12345678',dados}]}),lerDestino:async()=>({id:'op_12345678',tipo:'exclusao'}),criarDestino:async()=>{throw Error('não deve gravar')},registrarResumo:async()=>{throw Error('não deve concluir')}};
 await assert.rejects(migrarHistorico(base),/Conflito/);
});
