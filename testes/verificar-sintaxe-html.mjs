import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const arquivos=['index.html','integracao/central-conexao.html','integracao/backup-pre-migracao.html'],folder=mkdtempSync(join(tmpdir(),'romaneio-inline-'));
let total=0,errors=0;
try{
 for(const arquivo of arquivos){const html=readFileSync(arquivo,'utf8');
 for(const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
  const attrs=m[1],source=m[2];if(/\bsrc\s*=/.test(attrs)||!source.trim())continue;
  const ext=/type\s*=\s*["']module["']/i.test(attrs)?'mjs':'js',path=join(folder,'inline-'+(++total)+'.'+ext);
  writeFileSync(path,source,'utf8');
  const result=spawnSync(process.execPath,['--check',path],{encoding:'utf8'});
  if(result.status!==0){errors++;process.stderr.write('ERRO em '+arquivo+' script '+total+':\n'+result.stderr+'\n');}
 }
 }
 console.log('Scripts inline verificados:',total,'| Erros:',errors);
 if(errors)process.exitCode=1;
}finally{rmSync(folder,{recursive:true,force:true})}
