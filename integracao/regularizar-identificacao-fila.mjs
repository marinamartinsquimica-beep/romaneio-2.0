// Reparo exclusivo do metadado do aparelho remetente em eventos ainda não publicados.
// Nenhuma alteração de ID, item, estado anterior, autor, estoque ou permissões.
import {motivosFormatoOperacional} from './protocolo-movimentos.js?v=2.0.97';
const dispositivoValido=x=>typeof x==='string'&&x.length>0&&x.length<=160;
export async function regularizarIdentificacaoFila({dispositivoId,ler,gravar,consultarServidor,guardarBackup,validarSessao}){
 if(!dispositivoValido(dispositivoId))throw Error('Identificação do aparelho remetente inválida.');
 if([ler,gravar,consultarServidor,guardarBackup,validarSessao].some(f=>typeof f!=='function'))throw Error('Reparo sem proteção de cópia e verificação.');
 const fila=ler(),assinatura=JSON.stringify(fila);if(!Array.isArray(fila))throw Error('Fila local inválida.');
 const candidatos=fila.filter(op=>!dispositivoValido(op?.dispositivoId)&&motivosFormatoOperacional({...op,dispositivoId}).length===0);
 if(!candidatos.length)return {corrigidos:0};
 const ids=new Set();for(const op of fila){if(ids.has(op?.id))throw Error('IDs repetidos: fila preservada para revisão.');ids.add(op?.id);}
 const ausentes=new Set();
 for(const op of candidatos){await validarSessao();if(!await consultarServidor(op.id))ausentes.add(op.id);}
 if(!ausentes.size)return {corrigidos:0};
 await guardarBackup({formato:'romaneio-backup-identificacao-fila-v1',criadoEm:new Date().toISOString(),dispositivoRemetente:dispositivoId,motivo:'Regularização exclusiva da identificação do aparelho remetente',ids:[...ausentes],fila:JSON.parse(assinatura)});
 await validarSessao();
 if(JSON.stringify(ler())!==assinatura)throw Error('Fila mudou durante a conferência. Reparo cancelado; tente novamente.');
 gravar(fila.map(op=>ausentes.has(op.id)?{...op,dispositivoId}:op));
 return {corrigidos:ausentes.size};
}
