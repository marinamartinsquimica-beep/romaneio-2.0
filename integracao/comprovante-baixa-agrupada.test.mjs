import test from 'node:test';
import assert from 'node:assert/strict';
import {parcelaComprovada} from './comprovante-baixa-agrupada.mjs';
import {filtrarExpedicoesJaBaixadas} from './filtro-expedicoes-baixadas.mjs';
import {reconciliarPendenciasJaBaixadas} from './reconciliar-pendencias-baixadas.mjs';
const linha={registroId:'registro-compartilhado',destino:'Destino teste',palete:'24',sku:'5002',loteCompleto:'LOTE-TESTE',lote:'LT',postura:'20/10/26',data:'21/10/2026',caixas:10};
const comprovante={...linha,caixas:20,estado:'BAIXA_CONCLUIDA',linhasBaixa:[{...linha},{...linha}]};
test('comprovação de parcelas exige integridade do total e das identidades físicas',()=>{
 assert.equal(parcelaComprovada(linha,comprovante),true);
 assert.equal(parcelaComprovada({...linha,caixas:20},comprovante),false);
 assert.equal(parcelaComprovada({...linha,destino:'Outro'},comprovante),false);
 assert.equal(parcelaComprovada(linha,{...comprovante,caixas:10}),false);
 assert.equal(parcelaComprovada(linha,{...comprovante,linhasBaixa:[linha,{...linha,caixas:9}]}),false);
});
test('histórico agregado reconcilia exclusão sem descontar caixa nem bloquear parcela legítima',async()=>{
 const r=await reconciliarPendenciasJaBaixadas([{...linha,estado:'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA'}],async()=>comprovante);
 assert.equal(r.concluidas,1);assert.equal(r.pendentes,0);assert.equal(r.registros[0].caixas,10);
});
test('comprovante antigo de uma linha não encerra duas linhas com o mesmo ID',async()=>{
 await assert.rejects(filtrarExpedicoesJaBaixadas({registros:[linha,{...linha}],destino:'TODOS OS DESTINOS',buscar:async()=>({...linha,estado:'BAIXA_CONCLUIDA'})}),/não cobre todas as linhas/);
});
