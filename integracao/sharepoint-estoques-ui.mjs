import {refreshSharePointStocks,downloadUpdatedSharePointEmbalado,publishConfirmedSharePointBaixa} from './sharepoint-stock.mjs';
const $=id=>document.getElementById(id);
async function atualizar(){
 const button=$('etapa4Publicar'),status=$('etapa4SharePointStatus');
 if(button)button.disabled=true;
 if(status)status.textContent='Consultando os arquivos configurados no SharePoint...';
 try{const result=await refreshSharePointStocks();if(status)status.textContent=result.message;}
 catch(error){if(status)status.textContent='Estoques não atualizados: '+String(error?.message||error);}
 finally{if(button)button.disabled=false;}
}
async function baixar(){
 const button=$('etapa4BaixarEstoque'),status=$('etapa4SharePointStatus');
 if(button)button.disabled=true;
 try{await downloadUpdatedSharePointEmbalado();if(status)status.textContent='Download do Estoque Embalado atualizado iniciado.';}
 catch(error){if(status)status.textContent='Download não concluído: '+String(error?.message||error);}
 finally{if(button)button.disabled=false;}
}
$('etapa4Publicar')?.addEventListener('click',atualizar);
$('etapa4BaixarEstoque')?.addEventListener('click',baixar);
window.registrarBaixaConferida=async({resultado,versaoInicial}={})=>{
 const status=$('etapa4SharePointStatus');
 if(status)status.textContent='Publicando a baixa confirmada no arquivo oficial do Estoque Embalado...';
 const result=await publishConfirmedSharePointBaixa({resultado,versaoInicial});
 if(status)status.textContent='Baixa confirmada e arquivo oficial atualizado no SharePoint: '+result.name+'.';
 return true;
};
window.atualizarEstoquesSharePoint=atualizar;
