import test from 'node:test';
import assert from 'node:assert/strict';
import {reconciliarPendenciasJaBaixadas} from './reconciliar-pendencias-baixadas.mjs';
import {identidadeExpedicaoBaixa} from './baixa-transacional.mjs';
import {readFileSync} from 'node:fs';

const primeira={registroId:'registro_60',movimentoExclusaoId:'movimento_60',destino:'Teste app',palete:'1',sku:'5008',loteCompleto:'L25.03.13.10.26',caixas:60,estado:'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA'};
const segunda={registroId:'registro_20',movimentoExclusaoId:'movimento_20',destino:'Teste Sync Cel',palete:'2',sku:'3938',loteCompleto:'L21.15.13.10.26',caixas:20,estado:'PENDENTE_BAIXA'};
const ativo=x=>identidadeExpedicaoBaixa({...x,movimentoExclusaoId:''},true).id;
const excluido=x=>identidadeExpedicaoBaixa(x,false).id;
const concluido=x=>({...x,estado:'BAIXA_CONCLUIDA',baixaConfirmadaEm:'2026-10-18T20:00:00Z',confirmadoPor:'operador'});
test('duas exclusões depois das baixas anteriores deixam zero pendências, sem gerar baixa',async()=>{
 const dados=new Map([[ativo(primeira),concluido(primeira)],[ativo(segunda),concluido(segunda)]]);
 const origem=[primeira,segunda],r=await reconciliarPendenciasJaBaixadas(origem,async id=>dados.get(id)||null);
 assert.equal(r.concluidas,2);
 assert.equal(r.pendentes,0);
 assert.ok(r.registros.every(x=>x.estado==='BAIXA_CONCLUIDA'));
 assert.equal(r.registros.reduce((n,x)=>n+x.caixas,0),80);
 assert.equal(origem[0].estado,'EXCLUIDO_NO_CELULAR_AGUARDANDO_BAIXA');
});
test('baixado pelo próprio documento de exclusão também é reconciliado',async()=>{
 const r=await reconciliarPendenciasJaBaixadas([primeira],async id=>id===excluido(primeira)?concluido(primeira):null);
 assert.equal(r.concluidas,1);
 assert.equal(r.registros[0].referenciaBaixaConcluida,excluido(primeira));
});
test('sem saldo, mas Firebase ainda pendente: não encerrar sem confirmação',async()=>{
 const r=await reconciliarPendenciasJaBaixadas([primeira],async()=>({...primeira,estado:'PENDENTE_BAIXA'}));
 assert.equal(r.concluidas,0);
 assert.equal(r.pendentes,1);
 assert.equal(r.registros[0].estado,primeira.estado);
});
test('mesmo SKU e caixas mas palete ou lote diferente não confirma baixa',async()=>{
 const diferente={...primeira,palete:'7'};
 const r=await reconciliarPendenciasJaBaixadas([primeira],async()=>concluido(diferente));
 assert.equal(r.concluidas,0);
 assert.equal(r.pendentes,1);
});
test('mesmo identificador com quantidade alterada não é prova de baixa',async()=>{
 const r=await reconciliarPendenciasJaBaixadas([primeira],async()=>concluido({...primeira,caixas:59}));
 assert.equal(r.pendentes,1);
});
test('falta de identificador seguro mantém a pendência',async()=>{
 const semId={...primeira,registroId:'',movimentoExclusaoId:''};
 let tentativas=0;
 const r=await reconciliarPendenciasJaBaixadas([semId],async()=>{tentativas++;return concluido(primeira)});
 assert.equal(tentativas,0);
 assert.equal(r.pendentes,1);
});
test('erro de conexão rejeita reconciliação; não considera saldo zerado prova',async()=>{
 await assert.rejects(reconciliarPendenciasJaBaixadas([primeira],async()=>{throw Error('Firebase indisponível')}),/Firebase indisponível/);
});
test('idempotência: reconciliação repetida não altera históricos concluídos',async()=>{
 const dados=new Map([[ativo(primeira),concluido(primeira)]]);
 const inicial=await reconciliarPendenciasJaBaixadas([primeira],async id=>dados.get(id)||null);
 const final=await reconciliarPendenciasJaBaixadas(inicial.registros,async()=>{throw Error('Não pode consultar de novo')});
 assert.equal(final.concluidas,0);
 assert.equal(final.pendentes,0);
 assert.equal(final.registros[0].baixaConfirmadaEm,'2026-10-18T20:00:00Z');
});
test('o código principal não gera Excel se todas as expedições já foram concluídas',()=>{
 const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(source,/if\(!registrosParaBaixa\.length\)\{[\s\S]*?Não é necessário gerar outro Excel/);
 assert.match(source,/if\(romaneiosJaBaixados\)\{\s*marcarExpedicoesBaixadasNoArquivo\(verificados\.concluidos\)/);
 assert.match(source,/const podeBaixar=resultado\.aplicados\.length>0/);
});
test('sincronizador usa consulta remota e salva somente dados conciliados',()=>{
 const source=readFileSync(new URL('./central-conexao.html',import.meta.url),'utf8');
 assert.match(source,/await reconciliarPendenciasJaBaixadas\(final,async id=>/);
 assert.match(source,/getDocFromServer\(doc\(db,\.\.\.raiz,'expedicoes',id\)\)/);
 assert.match(source,/localStorage\.setItem\(chave,JSON\.stringify\(comprovadas\.registros\)\)/);
});
