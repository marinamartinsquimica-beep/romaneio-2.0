const CHAVES=[
 "entradas",
 "romaneio2_movimentos_pendentes_v1",
 "romaneio2_ultimo_estado_movimentos_v1",
 "romaneio2_destinos_excluidos_v1",
 "romaneio2_expedicoes_excluidas_pendentes_v1",
 "romaneio2_intencoes_correcao_v1",
 "romaneio2_solicitar_sincronizacao_v1"
];
export async function resetarDadosTesteAntigos({
 storage=globalThis.localStorage,
 documento=globalThis.document,
 janela=globalThis.window,
 agora=()=>new Date()
}={}){
 const entradasRaw=storage.getItem("entradas");
 const filaRawOriginal=storage.getItem("romaneio2_movimentos_pendentes_v1");
 const filaRaw=filaRawOriginal||"[]";
 let entradas,fila;
 try{entradas=entradasRaw?JSON.parse(entradasRaw):[];fila=JSON.parse(filaRaw);}
 catch{throw Error("Os dados locais não puderam ser lidos.");}
 if(!Array.isArray(entradas)||!Array.isArray(fila))throw Error("Os dados locais estão em formato inesperado.");
 const caixas=entradas.reduce((s,x)=>s+Number(x?.caixas||0),0);
 const confirmado=janela.confirm(
  "REINICIAR DADOS DESTE APARELHO?\n\nSerão removidos "+entradas.length+" registro(s), "+caixas+" caixa(s) e "+fila.length+" movimento(s) pendentes locais.\n\nAntes será baixada uma cópia JSON. O estoque importado, a conta e o histórico remoto do computador serão preservados."
 );
 if(!confirmado)return {cancelado:true};
 const backup={versao:"2.0.141",criadoEm:agora().toISOString(),dados:{}};
 for(const chave of CHAVES)backup.dados[chave]=storage.getItem(chave);
 const texto=JSON.stringify(backup,null,2);
 const checado=JSON.parse(texto);
 if(CHAVES.some(chave=>checado.dados[chave]!==storage.getItem(chave)))throw Error("A cópia de segurança ficou incompleta.");
 const url=janela.URL.createObjectURL(new Blob([texto],{type:"application/json"}));
 const a=documento.createElement("a");a.href=url;a.download="romaneio-backup-antes-reset-"+agora().toISOString().replace(/[:.]/g,"-")+".json";
 documento.body.appendChild(a);a.click();a.remove();setTimeout(()=>janela.URL.revokeObjectURL(url),3000);
 for(const chave of CHAVES)storage.removeItem(chave);
 storage.setItem("romaneio2_ultimo_estado_movimentos_v1","[]");
 storage.setItem("romaneio2_ultimo_reinicio_local_v1",agora().toISOString());
 return {cancelado:false,registros:entradas.length,caixas,movimentos:fila.length};
}
