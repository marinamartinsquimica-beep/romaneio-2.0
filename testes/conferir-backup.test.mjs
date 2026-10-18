import test from 'node:test';
import assert from 'node:assert/strict';
import {conferirBackupPreMigracao} from '../integracao/conferir-backup.mjs';
const correto={formato:'romaneio2-backup-v2',origemUid:'uid-001',movimentos:[{id:'abc',dados:{id:'abc',tipo:'inclusao'}}],totalMovimentos:1,estoques:{embalado:{tipo:'embalado',versao:'v1',itens:[{sku:'G',lote:'01',saldo:8}]},paripassu:null},dadosLocais:{entradas:'[]'},excelLocal:null};
test('backup completo passa na conferência somente leitura',()=>assert.equal(conferirBackupPreMigracao(correto).valido,true));
test('backup truncado ou duplicado é rejeitado',()=>{const x={...correto,totalMovimentos:2,movimentos:[...correto.movimentos,correto.movimentos[0]]};const a=conferirBackupPreMigracao(x);assert.equal(a.valido,false);assert.ok(a.erros.some(x=>x.includes('duplicado')))});
test('dados locais malformados interrompem migração',()=>assert.equal(conferirBackupPreMigracao({...correto,dadosLocais:{entradas:'{'}}).valido,false));
