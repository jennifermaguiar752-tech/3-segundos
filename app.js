// ===== 3 Segundos =====
const app = document.getElementById('app');
const $ = id => document.getElementById(id);
const ld = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };

const S = {
  players: ld('t3_jog', []).map(n => ({ name: n, cartas: [] })),
  alvo: 2, tempo: 3, som: ld('t3_som', true),
  master: 0, decks: { cerebro: [], corpo: [] }, r: null, emJogo: false, timer: null
};
const TIPO = {
  cerebro: { nome: 'CÉREBRO', ic: '🧠', cls: 'brain', cor: 'var(--brain)' },
  corpo:   { nome: 'CORPO',   ic: '💪', cls: 'phys',  cor: 'var(--phys)' }
};

// ---------- utilidades ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const vib = p => navigator.vibrate && navigator.vibrate(p);
const nome = i => esc(S.players[i].name);
const salvar = () => localStorage.setItem('t3_jog', JSON.stringify(S.players.map(p => p.name)));
const seg = t => t.toFixed(2).replace('.', ',');

function render(h) {
  if (S.timer) { S.timer.cancelar(); S.timer = null; }
  app.innerHTML = h; app.style.animation = 'none'; app.offsetHeight; app.style.animation = ''; scrollTo(0, 0);
}
function toast(m) { const t = $('toast'); t.innerHTML = m; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2400); }

let mcb = null;
function modal(html, ok, cb, cancel = 'Cancelar', cls = '') {
  const m = $('modal');
  m.innerHTML = `<div class="card">${html}<div class="col" style="margin-top:14px">
    ${ok ? `<button class="btn ${cls}" onclick="fechar(true)">${ok}</button>` : ''}
    ${cancel ? `<button class="btn ghost" onclick="fechar(false)">${cancel}</button>` : ''}</div></div>`;
  m.classList.remove('hidden'); mcb = cb;
}
function fechar(ok) { $('modal').classList.add('hidden'); const c = mcb; mcb = null; if (ok && c) c(); }

function confete() {
  const em = ['🎉', '⭐', '🧠', '💪', '🏆', '✨'];
  for (let k = 0; k < 50; k++) {
    const s = document.createElement('span'); s.className = 'confete'; s.textContent = em[k % em.length];
    s.style.left = Math.random() * 100 + 'vw'; s.style.fontSize = 16 + Math.random() * 22 + 'px'; s.style.animationDelay = Math.random() * 2 + 's';
    document.body.appendChild(s); setTimeout(() => s.remove(), 5500);
  }
}

// ---------- sons (gerados pelo navegador) ----------
let AC;
function ctx() { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; }
function tom(f, d = .12, tipo = 'sine', v = .2, at = 0) {
  if (!S.som) return;
  const a = ctx(), t = a.currentTime + at, o = a.createOscillator(), g = a.createGain();
  o.type = tipo; o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .02);
}
const SOM = {
  clique: () => tom(700, .05, 'triangle', .1),
  tick: () => tom(1500, .015, 'square', .04),
  soltar: () => { tom(300, .06, 'triangle', .15); tom(500, .08, 'triangle', .15, .05); },
  clack: () => { tom(2400, .03, 'square', .25); tom(110, .12, 'square', .3); },
  virar: () => { tom(400, .05, 'triangle', .12); tom(800, .07, 'triangle', .12, .05); },
  parar: () => { tom(988, .08, 'square', .15); tom(1319, .15, 'square', .15, .07); },
  falha: () => { tom(330, .2, 'sawtooth', .18); tom(220, .4, 'sawtooth', .18, .18); },
  ganhou: () => [659, 880, 1175].forEach((f, k) => tom(f, .18, 'triangle', .2, k * .1)),
  vitoria: () => [523, 659, 784, 1047, 784, 1047].forEach((f, k) => tom(f, .22, 'triangle', .2, k * .13)),
  bolha: () => { tom(300, .08); tom(600, .1, 'sine', .15, .06); }
};
document.addEventListener('click', e => { if (e.target.closest('button')) SOM.clique(); });
function togSom() {
  S.som = !S.som; localStorage.setItem('t3_som', S.som); toast(S.som ? '🔊 Som ligado' : '🔇 Som desligado');
  document.querySelectorAll('.somBtn').forEach(b => b.textContent = S.som ? '🔊' : '🔇');
}

// ---------- placar ----------
function placarHTML(destaque) {
  const ord = S.players.map((p, i) => ({ ...p, i })).sort((a, b) => b.cartas.length - a.cartas.length);
  return ord.map(p => `<div class="score ${p.i === destaque ? 'novo' : ''}">
    <span>${S.emJogo && p.i === S.master ? '👑 ' : ''}${esc(p.name)}</span>
    <span>${p.cartas.map(t => `<i class="mc ${TIPO[t].cls}">${TIPO[t].ic}</i>`).join('')}${'<i class="mc vazio"></i>'.repeat(Math.max(0, S.alvo - p.cartas.length))}</span>
  </div>`).join('');
}
const miniPlacar = () => `<div class="mini">${S.players.map(p => `<span>${esc(p.name)} <b>${p.cartas.length}/${S.alvo}</b></span>`).join('')}</div>`;
function verPlacar() { modal(`<h2>📊 Placar</h2><p class="sub2">🏆 Primeiro a juntar ${S.alvo} cartas vence</p>${placarHTML()}`, null, null, 'Fechar'); }

function barraTopo() {
  return `<div class="top">
    <button class="ic" onclick="verPlacar()">📊 Placar</button>
    <button class="ic" onclick="pular()">⏭️ Pular</button>
    <button class="ic" onclick="telaManual(true)">📖</button>
    <button class="ic somBtn" onclick="togSom()">${S.som ? '🔊' : '🔇'}</button>
    <button class="ic" onclick="encerrar()">⏹️ Fim</button></div>`;
}

// ---------- telas iniciais ----------
function telaInicio() {
  render(`<div class="centro">
    <div class="logo"><span class="n bob">3</span><span class="t">SEGUNDOS</span></div>
    <p class="sub">Prometa alto. Cumpra rápido. ⏱️</p>
    <div class="decks">
      <div class="deck brain-bg"><span>🧠</span>CÉREBRO<small>${CARTAS.cerebro.length} cartas</small></div>
      <div class="deck phys-bg"><span>💪</span>CORPO<small>${CARTAS.corpo.length} cartas</small></div>
    </div>
    <button class="btn" onclick="telaConfig()">🎮 Novo jogo</button>
    <button class="btn sec" onclick="telaManual()">📖 Manual de regras</button>
    <button class="btn sec" onclick="togSom();telaInicio()">${S.som ? '🔊 Som ligado' : '🔇 Som desligado'}</button>
  </div>`);
}

function telaManual(noJogo) {
  const h = `<div class="manual">
  <h2>📖 Manual de Regras</h2>
  <h3>🏆 Objetivo</h3>
  <p>Ser o primeiro a juntar <b>${S.alvo} cartas</b>. Você ganha uma carta quando cumpre o desafio que prometeu, dentro de ${S.tempo} segundos.</p>
  <h3>🃏 Os baralhos</h3>
  <p>🧠 <b>Cérebro:</b> dizer coisas (ex.: "Quantas frutas você consegue dizer?").<br>💪 <b>Corpo:</b> fazer movimentos (ex.: "Quantos polichinelos você consegue fazer?").</p>
  <h3>🔄 Como é uma rodada</h3>
  <p><b>1. Mestre 👑:</b> o Mestre da vez escolhe Cérebro ou Corpo, e o app vira uma carta.</p>
  <p><b>2. Lances 📣:</b> o Mestre toca em "Soltar a bolinha". Enquanto ela desce (${S.tempo}s), <b>todos gritam</b> quantas vezes conseguem cumprir o desafio.<br>
  • Cada lance precisa ser <b>maior</b> que o último que foi gritado.<br>
  • <b>Não pode repetir</b> o número de outra pessoa.<br>
  • Vale gritar várias vezes. É um vale-tudo! Vale o último lance de cada um.</p>
  <p><b>3. Registrar:</b> quando a bolinha chega, digitem no app o lance de cada um. Quem não falou nada fica em branco.</p>
  <p><b>4. Tentativa ⏱️:</b> quem deu o <b>maior lance</b> tenta primeiro. Deixem o celular na mesa ao alcance dele. Alguém solta a bolinha, ele cumpre o desafio e aperta <b>PARAR</b> antes de a bolinha chegar ao fim.</p>
  <p><b>5. Julgamento ⚖️:</b> se ele parou a tempo, o grupo decide se ele realmente fez tudo o que prometeu. Se fez, <b>ganha a carta!</b></p>
  <p><b>6. Falhou? ❌</b> Se a bolinha chegou ao fim ou o desafio ficou incompleto, quem deu o <b>segundo maior lance</b> tenta cumprir o próprio número, e assim por diante. Nas cartas de Cérebro, <b>não vale repetir</b> respostas que já foram ditas na rodada.</p>
  <p><b>7. Ninguém conseguiu?</b> A carta é descartada.</p>
  <p><b>8.</b> O papel de Mestre passa para o próximo jogador.</p>
  <h3>💡 Estratégia</h3>
  <p>Lance alto dá a chance de tentar primeiro, mas é arriscado. Lance baixo pode ganhar a carta se todos os outros falharem!</p>
  <h3>🛠️ Botões</h3>
  <p>📊 <b>Placar</b> a qualquer momento · ⏭️ <b>Pular</b> descarta a carta atual e o Mestre escolhe outra · ⏹️ <b>Fim</b> encerra o jogo (vence quem tiver mais cartas) · ✍️ <b>Inventar carta</b> cria um desafio na hora.</p>
  </div>`;
  if (noJogo) return modal(h, null, null, 'Fechar');
  render(`<div class="card">${h}</div><button class="btn" onclick="telaConfig()">Bora jogar!</button><button class="btn sec" onclick="telaInicio()">Voltar</button>`);
}

function telaConfig() {
  render(`<h2>👥 Jogadores</h2>
  <div class="card"><div class="row">
    <input id="nome" type="text" placeholder="Nome do jogador" maxlength="14" onkeydown="if(event.key==='Enter')addJ()">
    <button class="btn" style="width:auto;padding:0 20px" onclick="addJ()">＋</button></div>
    <ul class="plist" id="plist"></ul><small id="pmsg"></small></div>
  <h2>🏆 Cartas para vencer</h2>
  <div class="card"><div class="chips" id="alvo"></div></div>
  <h2>⏱️ Tempo da bolinha</h2>
  <div class="card"><div class="chips" id="tempo"></div><p class="sub2" style="margin-top:8px">3 segundos é o oficial. Use 4 ou 5 com crianças ou para um jogo mais tranquilo.</p></div>
  <button class="btn" id="go" onclick="iniciar()">Começar ⏱️</button>
  <button class="btn sec" onclick="telaInicio()">Voltar</button>`);
  desenhar();
}
function desenhar() {
  $('plist').innerHTML = S.players.map((p, i) => `<li><span>🙂 ${esc(p.name)}</span><button class="x" onclick="remJ(${i})">✕</button></li>`).join('');
  const f = 3 - S.players.length;
  $('pmsg').textContent = f > 0 ? `Faltam ${f} jogador(es). O mínimo é 3.` : `✅ ${S.players.length} jogadores prontos!`;
  $('alvo').innerHTML = [2, 3, 4, 5].map(n => `<button class="chip ${S.alvo === n ? 'on' : ''}" onclick="S.alvo=${n};desenhar()">${n} cartas${n === 2 ? ' (oficial)' : ''}</button>`).join('');
  $('tempo').innerHTML = [3, 4, 5].map(n => `<button class="chip ${S.tempo === n ? 'on' : ''}" onclick="S.tempo=${n};desenhar()">${n}s</button>`).join('');
  $('go').disabled = S.players.length < 3;
}
function addJ() {
  const inp = $('nome'), n = inp.value.trim(); if (!n) return;
  if (S.players.some(p => norm(p.name) === norm(n))) return toast('Esse nome já existe!');
  if (S.players.length >= 10) return toast('Máximo de 10 jogadores');
  S.players.push({ name: n, cartas: [] }); inp.value = ''; inp.focus(); SOM.bolha(); salvar(); desenhar();
}
function remJ(i) { S.players.splice(i, 1); salvar(); desenhar(); }

// ---------- fluxo ----------
function iniciar() {
  S.players.forEach(p => p.cartas = []);
  S.decks = { cerebro: shuffle(CARTAS.cerebro), corpo: shuffle(CARTAS.corpo) };
  S.master = Math.random() * S.players.length | 0;
  S.emJogo = true; S.r = null; salvar();
  telaMestre();
  toast(`🎲 ${nome(S.master)} começa como Mestre!`);
}
function comprar(tipo) {
  if (!S.decks[tipo].length) S.decks[tipo] = shuffle(CARTAS[tipo]);
  return S.decks[tipo].pop();
}

function telaMestre() {
  render(`${barraTopo()}
  <div class="center"><div class="big"><span class="bob">👑</span></div>
    <p class="sub">Mestre da rodada</p><h1>${nome(S.master)}</h1>
    <p class="sub">Escolha um baralho</p></div>
  <div class="decks">
    <button class="deck brain-bg" onclick="virar('cerebro')"><span>🧠</span>CÉREBRO<small>Dizer coisas</small></button>
    <button class="deck phys-bg" onclick="virar('corpo')"><span>💪</span>CORPO<small>Fazer movimentos</small></button>
  </div>
  <button class="btn sec" onclick="cartaPropria()">✍️ Inventar uma carta</button>
  ${miniPlacar()}`);
}

function cartaPropria() {
  modal(`<h2>✍️ Inventar carta</h2><p class="sub2">Escreva um desafio que dê para contar em ${S.tempo} segundos.</p>
    <select id="cpTipo"><option value="cerebro">🧠 Cérebro (dizer coisas)</option><option value="corpo">💪 Corpo (fazer movimentos)</option></select>
    <textarea id="cpTxt" rows="3" maxlength="120" placeholder="Ex: Quantos nomes de cachorro você consegue dizer?"></textarea>`,
    'Usar esta carta ✅', () => {
      const t = $('cpTxt').value.trim();
      if (!t) return toast('Escreva o desafio!');
      virar($('cpTipo').value, t);
    });
}

function virar(tipo, texto) {
  S.r = { tipo, carta: texto || comprar(tipo), lances: {}, fila: [], pos: 0, falhas: [], t: 0 };
  SOM.virar(); vib(30); telaCarta();
}

const cartaHTML = r => `<div class="carta"><div class="faixa ${TIPO[r.tipo].cls}-bg">${TIPO[r.tipo].ic} ${TIPO[r.tipo].nome}</div><p class="ct">${esc(r.carta)}</p></div>`;

function telaCarta() {
  render(`${barraTopo()}
  ${cartaHTML(S.r)}
  <div class="glass"><b>📣 Hora dos lances!</b><br>Quando a bolinha for solta, todos gritam quantas vezes conseguem cumprir o desafio em ${S.tempo}s.<br>
  • Cada lance tem que ser <b>maior</b> que o anterior<br>• <b>Não pode</b> repetir número</div>
  <button class="btn" onclick="telaPista('lance')">🔵 Soltar a bolinha</button>
  <p class="sub">${nome(S.master)} solta a bolinha</p>`);
}

// ---------- pista / timer ----------
function pistaSVG() {
  return `<svg id="pista" viewBox="0 0 200 420">
    <defs><radialGradient id="metal" cx="35%" cy="30%"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#9aa3ad"/><stop offset="1" stop-color="#2b3036"/></radialGradient></defs>
    <rect x="10" y="5" width="180" height="410" rx="18" fill="#27c3e6"/>
    <path id="trilho" d="M100 30 L165 95 L35 175 L165 255 L35 335 L100 385" fill="none" stroke="#fff" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="78" y="390" width="44" height="16" rx="4" fill="#4b5563"/>
    <circle id="bola" cx="100" cy="30" r="12" fill="url(#metal)"/>
  </svg>`;
}

function rodarPista(dur, onEnd) {
  const path = $('trilho'), bola = $('bola'), cont = $('cont');
  const L = path.getTotalLength(), t0 = performance.now();
  let ativo = true, ult = 0;
  function f(now) {
    if (!ativo) return;
    const el = (now - t0) / 1000, fr = Math.min(1, el / dur);
    const p = path.getPointAtLength(L * Math.pow(fr, 1.35)); // acelera, como a gravidade
    bola.setAttribute('cx', p.x); bola.setAttribute('cy', p.y);
    cont.textContent = Math.max(0, dur - el).toFixed(1).replace('.', ',');
    if (el - ult > .25) { ult = el; SOM.tick(); }
    if (fr >= 1) { ativo = false; S.timer = null; SOM.clack(); vib(200); onEnd(); return; }
    requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
  return {
    parar() { if (!ativo) return null; ativo = false; S.timer = null; return (performance.now() - t0) / 1000; },
    cancelar() { ativo = false; }
  };
}

function telaPista(modo) {
  const r = S.r, desafio = modo === 'desafio', i = r.fila[r.pos];
  render(`<div class="center">
    ${desafio
      ? `<span class="tag">${nome(i)} está tentando!</span><div class="meta">${r.lances[i]}</div><p class="sub">${esc(r.carta)}</p>`
      : `<h1>📣 GRITEM OS LANCES!</h1><p class="sub">${esc(r.carta)}</p>`}
  </div>
  <div class="pistaBox">${pistaSVG()}<div id="cont" class="cont">${S.tempo},0</div></div>
  ${desafio ? `<button class="btn red parar" onpointerdown="parar()">✋ PARAR!</button>` : ''}`);
  SOM.soltar();
  S.timer = rodarPista(S.tempo, desafio ? fimTempoDesafio : fimTempoLance);
}

function fimTempoLance() {
  $('cont').textContent = '⏰';
  const tk = S.r;
  setTimeout(() => { if (S.r === tk && $('pista')) telaLances(); }, 700);
}

// ---------- lances ----------
function telaLances() {
  const r = S.r;
  render(`${barraTopo()}
  <div class="card"><h2>📝 Quais foram os lances?</h2>
    <p class="sub2">Digite o último número que cada um gritou. Deixe em branco quem não deu lance.</p>
    ${S.players.map((p, i) => `<div class="lance"><span>${i === S.master ? '👑 ' : ''}${nome(i)}</span>
      <div class="step"><button onclick="ajLance(${i},-1)">−</button>
      <input id="l${i}" type="number" inputmode="numeric" min="1" max="99" placeholder="—" value="${r.lances[i] || ''}">
      <button onclick="ajLance(${i},1)">+</button></div></div>`).join('')}
  </div>
  <button class="btn green" onclick="confirmarLances()">Confirmar lances ✅</button>
  <button class="btn sec" onclick="telaPista('lance')">🔁 Repetir os lances</button>
  <button class="btn sec" onclick="descartar('Ninguém deu lance.')">🗑️ Ninguém deu lance</button>`);
}
function ajLance(i, d) {
  const inp = $('l' + i), v = Math.max(0, Math.min(99, (parseInt(inp.value) || 0) + d));
  inp.value = v || ''; inp.classList.remove('dup');
}
function confirmarLances() {
  const r = S.r, lances = {}, porValor = {};
  document.querySelectorAll('.step input').forEach(x => x.classList.remove('dup'));
  S.players.forEach((_, i) => {
    const v = parseInt($('l' + i).value);
    if (v > 0) { lances[i] = v; (porValor[v] = porValor[v] || []).push(i); }
  });
  if (!Object.keys(lances).length) return toast('Ninguém deu lance? Use o botão 🗑️');
  const dup = Object.entries(porValor).find(([, l]) => l.length > 1);
  if (dup) {
    dup[1].forEach(i => $('l' + i).classList.add('dup'));
    SOM.falha();
    return toast(`⚠️ ${dup[1].map(nome).join(' e ')} deram ${dup[0]}. Não pode repetir!`);
  }
  r.lances = lances;
  r.fila = Object.keys(lances).map(Number).sort((a, b) => lances[b] - lances[a]);
  r.pos = 0; r.falhas = [];
  telaDesafio();
}

// ---------- desafio ----------
function telaDesafio() {
  const r = S.r, i = r.fila[r.pos];
  render(`${barraTopo()}
  <div class="center"><span class="tag">${r.pos === 0 ? '🥇 Maior lance' : `Tentativa ${r.pos + 1} de ${r.fila.length}`}</span>
    <h1>${nome(i)}</h1><p class="sub">prometeu</p><div class="meta">${r.lances[i]}</div></div>
  ${cartaHTML(r)}
  ${r.falhas.length ? `<div class="glass">❌ Já falharam: ${r.falhas.map(f => `${nome(f.i)} (${f.n})`).join(', ')}
    ${r.tipo === 'cerebro' ? '<br>⚠️ <b>Não vale repetir</b> respostas que já foram ditas!' : ''}</div>` : ''}
  <div class="glass">👉 Deixem o celular na mesa, ao alcance de <b>${nome(i)}</b>. Quando a bolinha for solta, cumpra o desafio e aperte <b>PARAR</b> antes de ela chegar ao fim!</div>
  <button class="btn" onclick="telaPista('desafio')">🔵 Soltar a bolinha</button>`);
}

function parar() {
  const t = S.timer && S.timer.parar();
  if (t == null) return;
  if (t >= S.tempo) return fimTempoDesafio();
  S.r.t = t; SOM.parar(); vib(60); telaJulgar();
}

function fimTempoDesafio() {
  SOM.falha(); vib([200, 80, 200]);
  if ($('cont')) $('cont').textContent = '💥';
  const tk = S.r;
  setTimeout(() => { if (S.r === tk) falhou('tempo'); }, 800);
}

function telaJulgar() {
  const r = S.r, i = r.fila[r.pos];
  render(`<div class="center"><div class="big">✋</div><h2>Parou em ${seg(r.t)}s!</h2></div>
  <div class="card center"><p class="sub2">O grupo decide:</p>
    <h2>${nome(i)} conseguiu fazer <span style="color:var(--brain)">${r.lances[i]}</span>?</h2>
    <p class="sub2">${esc(r.carta)}</p></div>
  <button class="btn green" onclick="sucesso()">✅ Conseguiu!</button>
  <button class="btn red" onclick="falhou('incompleto')">❌ Não conseguiu</button>`);
}

function sucesso() {
  const r = S.r, i = r.fila[r.pos];
  S.players[i].cartas.push(r.tipo);
  if (S.players[i].cartas.length >= S.alvo) return telaFinal();
  SOM.ganhou(); vib([80, 40, 80]); confete();
  render(`<div class="center"><div class="big"><span class="bob">🎉</span></div>
    <h1>${nome(i)} ganhou a carta!</h1><p class="sub">Fez ${r.lances[i]} em ${seg(r.t)}s</p></div>
  ${cartaHTML(r)}
  <div class="card"><h2>📊 Placar</h2><p class="sub2">🏆 Primeiro a ${S.alvo} cartas vence</p>${placarHTML(i)}</div>
  <button class="btn" onclick="proxMestre()">Próxima rodada ➜</button>
  <button class="btn sec" onclick="encerrar()">⏹️ Encerrar o jogo</button>`);
}

function falhou(motivo) {
  const r = S.r, i = r.fila[r.pos];
  r.falhas.push({ i, n: r.lances[i] });
  r.pos++;
  if (r.pos >= r.fila.length) return descartar('Ninguém conseguiu cumprir o desafio.');
  const prox = r.fila[r.pos];
  document.body.classList.add('shake'); setTimeout(() => document.body.classList.remove('shake'), 400);
  render(`<div class="centro">
    <div class="big">${motivo === 'tempo' ? '💥' : '❌'}</div>
    <h1>${motivo === 'tempo' ? 'A bolinha chegou!' : 'Não deu!'}</h1>
    <p class="sub">${nome(i)} não conseguiu fazer ${r.lances[i]}.</p>
    <div class="glass center">Agora é a vez de <b>${nome(prox)}</b>, que prometeu <b>${r.lances[prox]}</b>.
      ${r.tipo === 'cerebro' ? '<br>⚠️ Não vale repetir o que já foi dito!' : ''}</div>
    <button class="btn" onclick="telaDesafio()">Próximo desafiante ➜</button>
  </div>`);
}

function descartar(msg) {
  SOM.falha();
  render(`<div class="center"><div class="big">🗑️</div><h1>Carta descartada</h1><p class="sub">${msg}</p></div>
  ${cartaHTML(S.r)}
  <div class="card"><h2>📊 Placar</h2>${placarHTML()}</div>
  <button class="btn" onclick="proxMestre()">Próxima rodada ➜</button>
  <button class="btn sec" onclick="encerrar()">⏹️ Encerrar o jogo</button>`);
}

function proxMestre() {
  S.master = (S.master + 1) % S.players.length; S.r = null;
  telaMestre(); toast(`👑 ${nome(S.master)} é o novo Mestre`);
}

function pular() {
  if (!S.r) return toast('Escolha uma carta primeiro');
  modal('<div class="big">⏭️</div><h2 class="center">Pular esta carta?</h2><p class="center">Ela é descartada e o mesmo Mestre escolhe outra. Ninguém ganha nada.</p>',
    'Pular', () => { S.r = null; telaMestre(); toast('⏭️ Carta pulada'); });
}

function encerrar() {
  modal('<div class="big">⏹️</div><h2 class="center">Encerrar o jogo?</h2><p class="center">Vence quem tiver mais cartas.</p>',
    'Encerrar e ver vencedor', () => telaFinal(true), 'Continuar jogando', 'red');
}

function telaFinal(forcado) {
  const max = Math.max(...S.players.map(p => p.cartas.length));
  const lista = S.players.filter(p => p.cartas.length === max);
  const titulo = max === 0 ? 'Ninguém ganhou cartas!' : lista.length === 1 ? `${esc(lista[0].name)} venceu!` : `Empate: ${lista.map(p => esc(p.name)).join(' e ')}!`;
  S.emJogo = false; S.r = null;
  render(`<div class="center"><div class="big"><span class="bob">🏆</span></div><h1>${titulo}</h1>
    <p class="sub">com ${max} carta(s)${forcado ? ' · jogo encerrado' : ''}</p></div>
  <div class="card">${placarHTML()}</div>
  <button class="btn" onclick="iniciar()">🔁 Jogar de novo</button>
  <button class="btn sec" onclick="telaConfig()">⚙️ Novo jogo</button>
  <button class="btn sec" onclick="telaInicio()">🏠 Início</button>`);
  if (max > 0) { confete(); SOM.vitoria(); vib([100, 50, 100, 50, 300]); }
}

addEventListener('beforeunload', e => { if (S.emJogo) { e.preventDefault(); e.returnValue = ''; } });
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
telaInicio();
