import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const s=readFileSync(new URL('../firebase/firestore-novo-ambiente.rules',import.meta.url),'utf8');
test('regras de homologação não têm expressões truncadas e preservam permissões',()=>{
 assert.match(s,/match \/romaneio_ambientes\/\{ambiente\}/);
 assert.match(s,/get\(membroPath\(ambiente\)\)/);
 assert.match(s,/\['administrador', 'operador'\]/);
 assert.match(s,/allow update, delete: if false;/);
 assert.doesNotMatch(s,/Unexpected|&& id\.matches\('[^']*\n/);
 let balance=0;
 for(const c of s){if(c==='{')balance++;else if(c==='}')balance--;assert.ok(balance>=0);}
 assert.equal(balance,0);
});
