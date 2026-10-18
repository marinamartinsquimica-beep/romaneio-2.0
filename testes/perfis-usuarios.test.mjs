import test from 'node:test';
import assert from 'node:assert/strict';
import {permissoesDoUsuario,exigirPermissao} from '../integracao/perfis-usuarios.mjs';
test('administrador gerencia usuários e publica Excel',()=>{
 const admin={perfil:'administrador',ativo:true};
 assert.equal(exigirPermissao(admin,'usuarios').usuarios,true);
 assert.equal(exigirPermissao(admin,'publicarExcel').publicarExcel,true);
});
test('operador publica e substitui planilha, mas não gerencia usuários',()=>{
 const operador={perfil:'operador',ativo:true};
 assert.equal(exigirPermissao(operador,'publicarExcel').publicarExcel,true);
 assert.throws(()=>exigirPermissao(operador,'usuarios'),/não permitido/);
});
test('usuário inativo e perfil desconhecido não recebem permissões',()=>{
 assert.equal(permissoesDoUsuario({perfil:'operador',ativo:false}),null);
 assert.equal(permissoesDoUsuario({perfil:'admin',ativo:true}),null);
 assert.throws(()=>exigirPermissao(null,'publicarExcel'),/não permitido/);
});
