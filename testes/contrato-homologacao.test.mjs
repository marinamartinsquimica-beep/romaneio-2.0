import test from 'node:test';
import assert from 'node:assert/strict';
import {exigirHomologacao} from '../integracao/contrato-homologacao.mjs';
test('ambiente isolado de homologação é aceito',()=>assert.equal(exigirHomologacao({ambienteId:'homologacao_teste001',migracaoConcluida:true,dadosFicticios:true}),'homologacao_teste001'));
test('ambiente oficial ou não liberado é bloqueado',()=>{
 assert.throws(()=>exigirHomologacao({ambienteId:'producao001',migracaoConcluida:true,dadosFicticios:true}),/não configurado/);
 assert.throws(()=>exigirHomologacao({ambienteId:'homologacao_teste001',migracaoConcluida:false,dadosFicticios:true}),/não liberado/);
 assert.throws(()=>exigirHomologacao({ambienteId:'homologacao_teste001',migracaoConcluida:true,dadosFicticios:false}),/dados de homologação/);
});
