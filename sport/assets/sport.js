const exercises = [
  {id:'goblet', n:1, title:'Goblet Squat', img:'01-goblet-squat.png', weight:'10 kg', cls:'kg10', sets:'2–3 × 8–12', area:'Beine · Po · Core', cue:'Hantel vor der Brust, Brust hoch, Knie folgen den Zehen. Unten kurz kontrollieren, dann über den ganzen Fuß hochdrücken.', form:['Fersen bleiben am Boden','Rücken neutral','Nicht in die Knie fallen']},
  {id:'rdl', n:2, title:'Romanian Deadlift', img:'02-romanian-deadlift.png', weight:'10 kg', cls:'kg10', sets:'2–3 × 8–12', area:'Hintere Kette', cue:'Hüfte nach hinten schieben, Hanteln eng am Bein, Rücken wie ein Tresorbalken gerade halten.', form:['Knie leicht gebeugt','Bewegung aus der Hüfte','Stoppen, bevor der Rücken rund wird']},
  {id:'row', n:3, title:'One-Arm Row', img:'03-one-arm-row.png', weight:'10 kg', cls:'kg10', sets:'2–3 × 8–12/Seite', area:'Rücken · Lat', cue:'Abstützen, flacher Rücken, Ellbogen Richtung Hüfte ziehen. Kein Reißen, kein Schulter-an-Ohr-Gemogel.', form:['Schulterblatt zieht mit','Hals lang','Langsam ablassen']},
  {id:'press', n:4, title:'Floor Press', img:'04-floor-press.png', weight:'10 kg', cls:'kg10', sets:'2–3 × 8–12', area:'Brust · Trizeps', cue:'Auf dem Boden drücken, Ellbogen berühren kontrolliert den Boden. Sicherer als Bankdrücken ohne Bank.', form:['Handgelenke stabil','Ellbogen ca. 45°','Nicht auf den Boden knallen']},
  {id:'lunge', n:5, title:'Reverse Lunge', img:'05-reverse-lunge.png', weight:'7,5 kg', cls:'kg75', sets:'2–3 × 8–10/Seite', area:'Beine · Balance', cue:'Rückwärts ausfallschreiten, vorderes Bein arbeitet. 7,5 kg ist hier kein Rückzug, sondern saubere Buchführung.', form:['Oberkörper aufrecht','Frontfuß voll belastet','Erst stabil, dann schwerer']},
  {id:'ohp', n:6, title:'Shoulder Press', img:'06-shoulder-press.png', weight:'7,5 kg', cls:'kg75', sets:'2–3 × 8–10', area:'Schulter · Trizeps', cue:'Aus Schulterhöhe über Kopf drücken, Rippen unten halten. Wenn der Rücken ausweicht: Gewicht runter.', form:['Po/Core anspannen','Kein Hohlkreuz','Hanteln kontrolliert senken']},
  {id:'latraise', n:7, title:'Lateral Raise', img:'07-lateral-raise.png', weight:'5 kg', cls:'kg5', sets:'2–3 × 10–15', area:'Seitliche Schulter', cue:'Leicht, langsam, ehrlich. Arme bis Schulterhöhe, keine Schwung-Zinsen aufnehmen.', form:['Leichte Ellbogenbeuge','Schultern unten','2 Sekunden ablassen']},
  {id:'curl', n:8, title:'Biceps Curl', img:'08-biceps-curl.png', weight:'10 kg', cls:'kg10', sets:'2–3 × 8–12', area:'Bizeps', cue:'Oberarme bleiben am Körper. Wenn die Hüfte hilft, war der Handel schlecht.', form:['Handflächen nach vorn/oben','Nicht schaukeln','Oben kurz anspannen']},
  {id:'triceps', n:9, title:'Overhead Triceps Extension', img:'09-triceps-extension.png', weight:'10 kg · 1 Hantel', cls:'kg10', sets:'2–3 × 10–12', area:'Trizeps', cue:'Eine Hantel mit beiden Händen. Ellbogen eng, langsam hinter den Kopf, sauber strecken.', form:['Rippen unten','Ellbogen zeigen nach vorn','Nicht ins Hohlkreuz']},
  {id:'revfly', n:10, title:'Reverse Fly', img:'10-reverse-fly.png', weight:'5 kg', cls:'kg5', sets:'2–3 × 10–15', area:'Hintere Schulter · oberer Rücken', cue:'Hinge-Position, Arme öffnen wie ein T. Klein, sauber, wertvoll gegen Schreibtischhaltung.', form:['Nacken entspannt','Schulterblätter arbeiten','Kein Schwung']}
];

const $ = s => document.querySelector(s);
const storageKey = 'domse-sport-done-v1';
let done = JSON.parse(localStorage.getItem(storageKey) || '{}');

function renderExercises(){
  const grid = $('#exerciseGrid');
  grid.innerHTML = exercises.map(e => `
    <article class="exercise-card reveal" id="${e.id}">
      <img src="assets/exercises/${e.img}" alt="${e.title} Anleitung">
      <div class="exercise-body">
        <div class="exercise-top"><div><p class="eyebrow">${e.area}</p><h3>${e.title}</h3></div><span class="num">${String(e.n).padStart(2,'0')}</span></div>
        <div class="badges"><span class="badge ${e.cls}">${e.weight}</span><span class="badge">${e.sets}</span></div>
        <p class="cue">${e.cue}</p>
        <ul class="form-list">${e.form.map(x=>`<li>${x}</li>`).join('')}</ul>
        <label class="done-row"><span>Heute erledigt</span><input type="checkbox" data-done="${e.id}" ${done[e.id]?'checked':''}></label>
      </div>
    </article>`).join('');
  grid.querySelectorAll('[data-done]').forEach(input => input.addEventListener('change', e => {
    done[e.target.dataset.done] = e.target.checked;
    localStorage.setItem(storageKey, JSON.stringify(done));
    updateProgress();
  }));
  setupReveal();
  updateProgress();
}

function updateProgress(){
  const count = exercises.filter(e => done[e.id]).length;
  $('#doneCount').textContent = `${count}/10`;
  $('#progress').value = count;
}

$('#resetChecks')?.addEventListener('click', () => {
  done = {}; localStorage.setItem(storageKey, '{}');
  document.querySelectorAll('[data-done]').forEach(i => i.checked = false);
  updateProgress();
});

let timer = 0, timerHandle = null;
function drawTimer(){ const m=String(Math.floor(timer/60)).padStart(2,'0'); const s=String(timer%60).padStart(2,'0'); $('#timer').textContent=`${m}:${s}`; }
document.querySelectorAll('[data-timer]').forEach(btn => btn.addEventListener('click', () => {
  const action = btn.dataset.timer;
  if(action === 'start' && !timerHandle) timerHandle = setInterval(()=>{timer++; drawTimer();},1000);
  if(action === 'pause'){ clearInterval(timerHandle); timerHandle = null; }
  if(action === 'reset'){ clearInterval(timerHandle); timerHandle = null; timer = 0; drawTimer(); }
}));

function setupReveal(){
  const items = document.querySelectorAll('.reveal:not(.visible)');
  if(!('IntersectionObserver' in window)){ items.forEach(i=>i.classList.add('visible')); return; }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if(entry.isIntersecting){ entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), {threshold:.12});
  items.forEach(i=>observer.observe(i));
}

renderExercises();
setupReveal();
drawTimer();
