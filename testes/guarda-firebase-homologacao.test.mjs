import test from 'node:test';
import assert from 'node:assert/strict';
import {exigirFirebaseHomologacao} from '../integracao/guarda-firebase-homologacao.mjs';
test('aceita apenas projeto isolado de homologacao',()=>{
 assert.equal(exigirFirebaseHomologacao({projectId:'romaneio-2-0-homologacao'}),true);
 assert.throws(()=>exigirFirebaseHomologacao({projectId:'romaneio-2-0-laboratorio'}),/bloqueada/);
 assert.throws(()=>exigirFirebaseHomologacao({projectId:'outro-projeto-123'}),/bloqueada/);
});
