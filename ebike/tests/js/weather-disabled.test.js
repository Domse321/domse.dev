import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const app=fs.readFileSync(new URL('../../app.js',import.meta.url),'utf8');const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
test('weather is fail closed and has no runtime provider',()=>{assert.doesNotMatch(app,/open-meteo|temperature_2m|loadWeather/);assert.match(html,/Wetter\/Fahrbarkeit nicht verfügbar/)});
