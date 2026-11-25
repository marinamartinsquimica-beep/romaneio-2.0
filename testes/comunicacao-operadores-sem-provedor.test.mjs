import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const main=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const central=readFileSync(new URL('../integracao/central-conexao.html',import.meta.url),'utf8');
const estoque=readFileSync(new URL('../integracao/estoques-SharePoint-ui.mjs',import.meta.url),'utf8');
const visibles=s=>[...s.matchAll(/>([^<>]+)</g)].map(x=>x[1]).filter(x=>/SharePoint/i.test(x));
test('nenhum texto visível de HTML menciona provedor técnico',()=>{assert.deepEqual(visibles(main),[]);assert.deepEqual(visibles(central),[])});
test('mensagens ao operador não mencionam provedor',()=>{for(const s of [main,central,estoque])for(const x of s.matchAll(/'([^'\r\n]*SharePoint[^'\r\n]*)'/gi)){const v=x[1];if(/\.(js|mjs)|\/|etapa4SharePoint|verificacaoSharePoint|SharePointConfig|SharePoint-|SharePoint_|SharePointAuth/i.test(v))continue;assert.ok(!/[\s:—.?]/.test(v),'Mensagem técnica visível: '+v)}});
test('identificadores internos de integração foram preservados',()=>{assert.match(main,/id="etapa4SharePoint"/);assert.match(main,/id="etapa4SharePointStatus"/);assert.match(central,/id="verificacaoSharePoint"/);assert.match(estoque,/import \{initializeApp,getApp,getApps\} from 'https:\/\/www\.gstatic\.com\/SharePointjs/);});
test('textos orientam publicação e conexão sem mencionar provedor',()=>{assert.match(main,/PUBLICAR ESTOQUE COMPARTILHADO/);assert.match(main,/Conexão do sistema/);assert.match(central,/TESTAR CONEXÃO/);});
