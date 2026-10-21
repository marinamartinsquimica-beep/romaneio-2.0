import test from 'node:test';
import assert from 'node:assert/strict';
import {registroBaixadoNoEstoque} from './status-baixa-romaneio.mjs';
const linha={registroId:'registro-teste',data:'20/10/2026',sku:'5002',destino:'SC',palete:'24',loteCompleto:'LOTE-TESTE',lote:'LT',postura:'19/10/26',caixas:10};
const prova={...linha,estado:'BAIXA_CONCLUIDA'};
test('status só aparece com confirmação de baixa e identidade correspondente',()=>{
 assert.equal(registroBaixadoNoEstoque(linha,[prova]),true);
 assert.equal(registroBaixadoNoEstoque(linha,[{...prova,estado:'PENDENTE_BAIXA'}]),false);
 assert.equal(registroBaixadoNoEstoque(linha,[]),false);
 for(const campo of ['registroId','destino','palete','sku','loteCompleto','data','postura','caixas'])
  assert.equal(registroBaixadoNoEstoque({...linha,[campo]:campo==='caixas'?9:'outro'},[prova]),false,campo);
});
test('duas parcelas de dez caixas reconhecem o comprovante único de vinte',()=>{
 const agrupado={...prova,caixas:20,linhasBaixa:[{...linha},{...linha}]};
 assert.equal(registroBaixadoNoEstoque(linha,[agrupado]),true);
 assert.equal(registroBaixadoNoEstoque({...linha,caixas:5},[agrupado]),false);
 assert.equal(registroBaixadoNoEstoque({...linha,registroId:'novo-mesmo-destino'},[agrupado]),false);
});
