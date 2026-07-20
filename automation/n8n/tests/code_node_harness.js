#!/usr/bin/env node
const fs=require('fs');
const payload=JSON.parse(fs.readFileSync(0,'utf8'));
const code=fs.readFileSync(payload.script,'utf8');
const input={all:()=>payload.inputs,first:()=>payload.inputs[0]};
const dollar=(name)=>({all:()=>payload.refs?.[name]??[],first:()=>payload.refs?.[name]?.[0]});
const result=new Function('$input','$','$now','$execution',code)(input,dollar,{toISO:()=>"2026-07-20T07:00:00.000Z"},{id:"test-run"});
process.stdout.write(JSON.stringify(result));
