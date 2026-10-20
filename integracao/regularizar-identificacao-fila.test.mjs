import test from 'node:test';
import assert from 'node:assert/strict';
import {regularizarIdentificacaoFila} from './regularizar-identificacao-fila.mjs';
const item={sku:'5002',loteCompleto:'L24.02.05.10.26',palete:'7',caixas:'20',postura:'05.10.26'};
const op=(id,tipo='inclusao')=>({id,dispositivoId:'',tipo,item:{...item,caixas:tipo==='edicao'?'8':'20'},antes:tipo==='edicao'?{...item}:null,criadoEm:'2026-10-20T08:00:00Z'});
function ambiente({existentes=[],falhaBackup=false,falhaServidor=false,mudarFila=false,sessaoValida=true}={}){
 let fila=[op('evento001'),op('evento002','exclusao'),op('evento003'),op('evento004','edicao')],writes=0,backup=null;const original=structuredClone(fila);
 const args={dispositivoId:'aparelho-remetente',ler:()=>structuredClone(fila),gravar:x=>{writes++;fila=x},consultarServidor:async id=>{if(falhaServidor)throw Error('permission-denied');return existentes.includes(id)},validarSessao:()=>{if(!sessaoValida)throw Error('Sessão alterada')},guardarBackup:async x=>{if(falhaBackup)throw Error('backup indisponível');backup=x;if(mudarFila)fila.push(op('evento005'))}};
 return {args,original,fila:()=>fila,writes:()=>writes,backup:()=>backup};
}
test('regulariza quatro eventos ausentes no servidor, com cópia integral anterior e sem mudar dados operacionais',async()=>{
 const a=ambiente(),r=await regularizarIdentificacaoFila(a.args);assert.equal(r.corrigidos,4);assert.deepEqual(a.backup().fila,a.original);
 a.fila().forEach((x,i)=>{assert.equal(x.dispositivoId,'aparelho-remetente');assert.deepEqual({...x,dispositivoId:''},a.original[i])});assert.equal(a.writes(),1);
});
test('evento já publicado não recebe identificação diferente',async()=>{const a=ambiente({existentes:['evento001']});const r=await regularizarIdentificacaoFila(a.args);assert.equal(r.corrigidos,3);assert.deepEqual(a.fila()[0],a.original[0]);assert.ok(!a.backup().ids.includes('evento001'))});
for(const [nome,opts] of [['cópia falha',{falhaBackup:true}],['servidor recusa leitura',{falhaServidor:true}],['sessão muda',{sessaoValida:false}]])test(nome+' preserva integralmente a fila',async()=>{const a=ambiente(opts);await assert.rejects(regularizarIdentificacaoFila(a.args));assert.equal(a.writes(),0);assert.deepEqual(a.fila(),a.original)});
test('alteração concorrente cancela reparo sem sobrescrever novos eventos',async()=>{const a=ambiente({mudarFila:true});await assert.rejects(regularizarIdentificacaoFila(a.args),/Fila mudou/);assert.equal(a.writes(),0);assert.equal(a.fila().length,5)});
test('evento com identificação válida permanece intacto e não exige cópia',async()=>{const a=ambiente();a.args.ler=()=>[{...op('evento001'),dispositivoId:'original'}];const r=await regularizarIdentificacaoFila(a.args);assert.equal(r.corrigidos,0);assert.equal(a.writes(),0);assert.equal(a.backup(),null)});
