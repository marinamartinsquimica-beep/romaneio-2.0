import test from 'node:test';
import assert from 'node:assert/strict';
import {romaneioBaixado,filtrarEventosBaixados,separarEncerradosLocais,identidadeHistoricoEncerrados} from './recepcao-romaneios-ativos.mjs';
import {registrarFechamento} from './marcos-romaneios-fechados.mjs';
const antigo={registroId:'taeque-antigo',data:'19/10/2026',destino:'Taeque',palete:'8',sku:'5002',loteCompleto:'L24',postura:'05.10.26',caixas:45};
const atual={...antigo,registroId:'taeque-novo',data:'20/10/2026'};
const outro={...atual,destino:'ANGELONI',registroId:'angeloni'};
const movimentos=[{id:'m1',tipo:'inclusao',item:antigo},{id:'m2',tipo:'exclusao',item:antigo},{id:'m3',tipo:'inclusao',item:atual}];
const expedicoes=[{...antigo,id:'exp-baixa-excluida',origemId:'evento-exclusao',estado:'BAIXA_CONCLUIDA'}];
test('baixa por exclusão reconhece registro antigo sem bloquear novo palete no mesmo destino',()=>{
 assert.equal(romaneioBaixado(antigo,expedicoes),true);assert.equal(romaneioBaixado(atual,expedicoes),false);
 const eventos=filtrarEventosBaixados(movimentos,expedicoes);assert.deepEqual(eventos,[movimentos[2]]);
});
test('Taeque baixado e excluído é separado do ativo para preservar em histórico',()=>{
 const r=separarEncerradosLocais({registros:[antigo,atual,outro],movimentos,expedicoes});
 assert.deepEqual(r.encerrados,[antigo]);assert.deepEqual(r.atuais,[atual,outro]);
});
test('somente excluir sem baixa mantém registro para baixa pendente no desktop',()=>{
 const r=separarEncerradosLocais({registros:[antigo],movimentos,expedicoes:[]});assert.deepEqual(r.atuais,[antigo]);assert.equal(r.encerrados.length,0);
});
test('baixa sem exclusão não remove local que ainda aguarda encerramento pelo operador',()=>{
 const r=separarEncerradosLocais({registros:[antigo],movimentos:[movimentos[0]],expedicoes});assert.deepEqual(r.atuais,[antigo]);assert.equal(r.encerrados.length,0);
});
test('marcador local de encerramento mais baixa comprova fechamento mesmo sem evento de exclusão remoto',()=>{
 const fechamentos=registrarFechamento([antigo],[],'2026-10-19T20:00:00Z');
 const r=separarEncerradosLocais({registros:[antigo,atual],movimentos:[],expedicoes,fechamentos});assert.deepEqual(r.encerrados,[antigo]);assert.deepEqual(r.atuais,[atual]);
});
test('legado exige identidade completa e nunca encerra pelo nome do destino',()=>{
 const legado={...antigo};delete legado.registroId;const ex={...legado,estado:'BAIXA_CONCLUIDA'};
 assert.equal(romaneioBaixado(legado,[ex]),true);assert.equal(romaneioBaixado({...legado,data:'20/10/2026'},[ex]),false);assert.equal(romaneioBaixado(atual,[ex]),false);
});
test('histórico do mesmo conjunto tem ID estável e independe da ordem',()=>{assert.equal(identidadeHistoricoEncerrados([antigo,outro]),identidadeHistoricoEncerrados([outro,antigo]));assert.notEqual(identidadeHistoricoEncerrados([antigo]),identidadeHistoricoEncerrados([atual]));});
