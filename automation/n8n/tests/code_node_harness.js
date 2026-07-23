#!/usr/bin/env node
const fs=require('fs');
const payload=JSON.parse(fs.readFileSync(0,'utf8'));
const code=fs.readFileSync(payload.script,'utf8');
const input={all:()=>payload.inputs,first:()=>payload.inputs[0]};
const dollar=(name)=>({all:()=>payload.refs?.[name]??[],first:()=>payload.refs?.[name]?.[0]});
const now={
  toISO:()=>"2026-07-20T07:00:00.000Z",
  setZone:()=>payload.now??{weekday:7,day:5},
};
const result=new Function('$input','$','$now','$execution','URL',code)(input,dollar,now,{id:"test-run"},undefined);
process.stdout.write(JSON.stringify(result));
