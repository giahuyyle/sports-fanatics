import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const code = ts.transpileModule(fs.readFileSync(new URL('../src/game.ts',import.meta.url),'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const game = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
test('snake order gives every manager five picks across 4–8 teams',()=>{for(let size=4;size<=8;size++){const owners=Array.from({length:size*5},(_,i)=>game.ownerAt(i,size));assert.deepEqual(owners.slice(0,size),Array.from({length:size},(_,i)=>i));assert.deepEqual(owners.slice(size,size*2),Array.from({length:size},(_,i)=>size-1-i));for(let i=0;i<size;i++)assert.equal(owners.filter(o=>o===i).length,5);}});
test('grid detects all win lines and draws',()=>{for(const line of [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]){const board=Array(9).fill(null);line.forEach(i=>board[i]={id:i,name:'Player',mark:'O'});assert.equal(game.outcome(board),'O');}assert.equal(game.outcome(game.freshGrid().board),null);assert.equal(game.outcome(['X','O','X','X','O','O','O','X','X'].map((mark,id)=>({id,name:'Player',mark}))),'draw');});
test('setup requires unique trimmed names',()=>{const entries=game.freshState().setup.entries.slice(0,4);assert.ok(game.validSetup('League',entries));assert.ok(!game.validSetup(' ',entries));entries[1].team=' team 1 ';assert.ok(!game.validSetup('League',entries));});
test('draft filtering excludes taken players and combines search and position',()=>{const players=[{id:1,name:'Nikola Jokić',team:'DEN',position:'C',rank:1},{id:2,name:'LeBron James',team:'LAL',position:'F',rank:2}];assert.equal(game.filterPlayers(players,[],'jokic','C').length,1);assert.equal(game.filterPlayers(players,[],'LAL','F').length,1);assert.equal(game.filterPlayers(players,[{player:players[0]}],'','all').length,1);assert.equal(game.filterPlayers(players,[],'jokic','G').length,0);});
test('storage restores a complete session and recovers malformed or unavailable storage',()=>{const state=game.freshState();state.grid.board[0]={id:1,name:'Player',mark:'X'};state.progress.played=4;state.draft={name:'League',entries:state.setup.entries.slice(0,4),picks:[{player:{id:1,name:'Player',team:'LAL',position:'F',rank:1},owner:0,pick:0}],ready:false};globalThis.localStorage={getItem:()=>JSON.stringify(state)};assert.deepEqual(game.loadState(),state);for(const raw of ['{','null',JSON.stringify({...state,guess:{round:999}}),JSON.stringify({...state,draft:{}})]){globalThis.localStorage={getItem:()=>raw};assert.deepEqual(game.loadState(),game.freshState());}globalThis.localStorage={getItem:()=>{throw new Error('blocked');}};assert.deepEqual(game.loadState(),game.freshState());});
test('a partial imported board draws after every available square is filled',()=>{const board=Array(9).fill(null);[0,1,2,3,5,6,8].forEach((cell,i)=>board[cell]={id:i,name:'Player',mark:['X','O','X','O','O','X','X'][i]});assert.equal(game.outcome(board,[4,7]),'draw');});

test('saved random grid survives refresh and legacy grid resets without losing progress',()=>{
 const state=game.freshState();
 state.grid.layout={rows:[1,2,3].map(id=>({id,name:'Team '+id,abbreviation:'T'+id})),columns:[4,5,6].map(id=>({id,name:'Team '+id,abbreviation:'T'+id}))};
 state.grid.board[0]={id:7,name:'Player',mark:'X'};
 state.progress.played=9;
 globalThis.localStorage={getItem:()=>JSON.stringify(state)};
 assert.deepEqual(game.loadState().grid,state.grid);
 delete state.grid.layout;
 globalThis.localStorage={getItem:()=>JSON.stringify(state)};
 assert.deepEqual(game.loadState().grid,game.freshGrid());
 assert.equal(game.loadState().progress.played,9);
});
