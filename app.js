'use strict';
const $ = id => document.getElementById(id);
const lessons = window.LESSONS;
const keyFor = id => `daily-python-${String(id).padStart(2, '0')}`;
let day = 1;
try { const n = Number(localStorage.getItem('daily-python-current')); if (lessons.some(l => l.id === n)) day = n; } catch {}
let worker = null, busy = false, timer = null, resolveRun = null, buffer = '';
let state = readState(day);
function lesson() { return lessons.find(l => l.id === day); }
function readState(id) {
  const item = lessons.find(l => l.id === id);
  const fallback = { page: 0, code: item.examples[0], answers: {}, checks: {}, done: false };
  try {
    const old = JSON.parse(localStorage.getItem(keyFor(id)));
    if (old && typeof old === 'object') return {
      page: Number.isInteger(old.page) ? Math.min(2, Math.max(0, old.page)) : 0,
      code: typeof old.code === 'string' ? old.code : fallback.code,
      answers: old.answers && typeof old.answers === 'object' ? old.answers : {},
      checks: old.checks && typeof old.checks === 'object' ? old.checks : {},
      done: old.done === true
    };
  } catch {}
  return fallback;
}
function save() {
  try { localStorage.setItem(keyFor(day), JSON.stringify(state)); localStorage.setItem('daily-python-current', String(day)); }
  catch { $('saveNote').textContent = '이 브라우저에서는 저장할 수 없어요. 페이지를 닫기 전에 답과 코드를 따로 복사해 주세요.'; }
}
function navigation() {
  const week = Math.ceil(day / 5);
  const weekLessons = lessons.filter(l => Math.ceil(l.id / 5) === week);
  $('weekTitle').textContent = `WEEK ${String(week).padStart(2, '0')}`;
  $('weekTopic').textContent = week === 1 ? '코드와 친해지기' : '여러 값을 다루기';
  document.querySelectorAll('[data-week]').forEach(el => {
    const selected = Number(el.dataset.week) === week;
    el.classList.toggle('selected', selected);
    el.setAttribute('aria-pressed', String(selected));
    el.onclick = () => selectDay((Number(el.dataset.week) - 1) * 5 + 1);
  });
  $('dayList').innerHTML = weekLessons.map(l => {
    const done = l.id === day ? state.done : readState(l.id).done;
    return `<button class="day ${l.id === day ? 'active' : ''}" data-day="${l.id}" ${l.id === day ? 'aria-current="step"' : ''}><b>${String(l.id).padStart(2, '0')}</b><span class="day-copy">${l.title}<span>${done ? '학습 완료 ✓' : `약 ${l.minutes}분 · 3쪽`}</span></span></button>`;
  }).join('');
  document.querySelectorAll('[data-day]').forEach(el => el.onclick = () => selectDay(Number(el.dataset.day)));
  $('daySelect').innerHTML = lessons.map(l => `<option value="${l.id}">${l.id}일 차 · ${l.title}</option>`).join('');
  $('daySelect').value = String(day);
  $('weekProgress').textContent = `${week}주차 ${weekLessons.filter(l => l.id === day ? state.done : readState(l.id).done).length} / 5일 완료`;
}
function pageMarkup(page) {
  return `<div class="paper-kicker"><span>DAY ${String(day).padStart(2, '0')} · ${lesson().title}</span><span>${lesson().minutes} MIN</span></div>${lesson().pages[page]}<div class="paper-bottom"><span>하루 파이썬 · ${Math.ceil(day / 5)}주차 데이터 노트</span><span>${page + 1} / 3</span></div>`;
}
function fillFields(root) {
  root.querySelectorAll('[data-answer]').forEach(el => { el.value = typeof state.answers[el.dataset.answer] === 'string' ? state.answers[el.dataset.answer] : ''; });
  root.querySelectorAll('[data-check]').forEach(el => { el.checked = !!state.checks[el.dataset.check]; });
}
function render() {
  $('paper').innerHTML = pageMarkup(state.page);
  $('pageLabel').textContent = `0${state.page + 1} / 03`;
  $('readingTitle').textContent = `${day}일 차 · ${lesson().title}`;
  $('editorFile').textContent = `day${String(day).padStart(2, '0')}.py`;
  $('labDay').textContent = `DAY ${String(day).padStart(2, '0')}`;
  $('prev').disabled = state.page === 0;
  $('next').disabled = state.page === 2;
  $('dots').innerHTML = [0, 1, 2].map(i => `<button aria-label="${i + 1}쪽으로 이동" ${i === state.page ? 'aria-current="page"' : ''} class="${i === state.page ? 'selected' : ''}" data-page="${i}"></button>`).join('');
  fillFields($('paper'));
  $('paper').querySelectorAll('[data-answer]').forEach(el => el.oninput = () => { state.answers[el.dataset.answer] = el.value; save(); });
  $('paper').querySelectorAll('[data-check]').forEach(el => el.onchange = () => {
    state.checks[el.dataset.check] = el.checked;
    if (!el.checked) state.done = false;
    save(); completion(); navigation();
  });
  $('paper').querySelectorAll('[data-example]').forEach(el => el.onclick = () => {
    setCode(lesson().examples[Number(el.dataset.example)]);
    $('code').focus();
    if (innerWidth < 801) $('code').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
  document.querySelectorAll('[data-page]').forEach(el => el.onclick = () => go(Number(el.dataset.page)));
  if ($('complete')) $('complete').onclick = () => {
    if (!['run', 'change', 'solve'].every(k => state.checks[k])) { $('completion').textContent = '위의 세 가지를 확인하고 체크해 주세요.'; return; }
    state.done = true; save(); completion(); navigation();
  };
  if ($('nextDay')) $('nextDay').onclick = () => selectDay(day + 1);
  completion(); navigation();
}
function completion() {
  if (!$('complete')) return;
  $('complete').textContent = state.done ? '학습 완료 ✓' : '오늘의 학습 마치기';
  $('completion').textContent = state.done ? (day === 10 ? '2주차를 마쳤어요. 다음 주에는 표 형태의 데이터를 다룰 준비를 해요.' : `${day}일 차 학습을 마쳤어요. 수고했어요!`) : '';
  if ($('nextDay')) $('nextDay').hidden = !state.done || day === lessons[lessons.length - 1].id;
}
function go(page) { if (page < 0 || page > 2) return; state.page = page; save(); render(); $('paper').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function selectDay(id) {
  if (!lessons.some(l => l.id === id) || id === day) return;
  if (busy) stop('날짜를 바꾸어 실행을 중지했어요.');
  save(); day = id; state = readState(day); save();
  $('code').value = state.code; lines(); render(); clearOutput('이 날짜의 코드를 실행해 보세요.');
  $('paper').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
function lines() {
  $('lineNums').textContent = $('code').value.split('\n').map((_, i) => i + 1).join('\n');
  $('lineNums').style.transform = `translateY(-${$('code').scrollTop}px)`;
}
function clearOutput(message) {
  $('output').classList.remove('error'); $('output').textContent = message; $('status').textContent = '실행 대기';
  $('help').querySelector('b').textContent = '실행할 때 기억해요';
  $('help').querySelector('p').textContent = '실행할 때마다 입력 칸 전체를 처음부터 계산해요. 필요한 변수도 같은 입력 칸에 넣어주세요. 첫 실행에는 준비 시간이 필요해요.';
}
function setCode(code) {
  if (busy) stop('예제를 바꾸어 실행을 중지했어요.');
  state.code = code; $('code').value = code; $('code').scrollTop = 0; lines(); save(); clearOutput('예제를 불러왔어요. 실행하기를 눌러보세요.');
}
$('prev').onclick = () => go(state.page - 1);
$('next').onclick = () => go(state.page + 1);
$('daySelect').onchange = e => selectDay(Number(e.target.value));
$('code').value = state.code;
$('code').oninput = () => { state.code = $('code').value; lines(); save(); };
$('code').onscroll = lines;
$('code').onkeydown = e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  if (e.key === 'Tab') { e.preventDefault(); const t = e.target; t.setRangeText('    ', t.selectionStart, t.selectionEnd, 'end'); t.dispatchEvent(new Event('input')); }
};
$('reset').onclick = () => setCode(lesson().examples[state.page]);
function finish() {
  busy = false; clearTimeout(timer); $('run').disabled = false; $('stop').hidden = true;
  if (resolveRun) { resolveRun({ status: $('status').textContent, output: $('output').textContent }); resolveRun = null; }
}
function stop(message) { if (worker) worker.terminate(); worker = null; $('status').textContent = '실행 중지'; $('output').textContent = message; finish(); }
$('stop').onclick = () => stop('실행을 중지했어요. 코드를 수정한 뒤 다시 실행할 수 있어요.');
function run() {
  if (busy) return Promise.resolve({ status: 'busy' });
  busy = true; $('run').disabled = true; $('stop').hidden = false;
  $('output').classList.remove('error'); buffer = ''; $('output').textContent = '';
  $('status').textContent = worker ? '실행 중' : '파이썬 준비 중…';
  const promise = new Promise(r => resolveRun = r);
  timer = setTimeout(() => stop('준비 또는 실행 시간이 길어져 중지했어요. 인터넷 연결과 코드를 확인한 뒤 다시 실행해 주세요.'), 90000);
  if (!worker) {
    worker = new Worker('worker.js', { type: 'module' });
    worker.onerror = () => {
      if (worker) worker.terminate(); worker = null;
      $('status').textContent = '연결 확인 필요';
      $('output').textContent = '파이썬을 불러오지 못했어요. 인터넷 연결을 확인한 후 실행하기를 다시 눌러주세요.';
      $('output').classList.add('error'); finish();
    };
    worker.onmessage = ({ data: d }) => {
      if (d.type === 'ready') $('status').textContent = '실행 중';
      if (d.type === 'stdout') {
        buffer += d.text + '\n'; if (buffer.length > 16000) buffer = buffer.slice(-16000);
        $('output').textContent = buffer;
      }
      if (d.type === 'done') {
        $('status').textContent = '실행 완료';
        if (!buffer) $('output').textContent = '실행은 끝났지만 출력이 없어요. print()를 사용해 보세요.';
        $('help').querySelector('b').textContent = '결과를 비교해 보세요';
        $('help').querySelector('p').textContent = '학습지의 예상 결과와 비교해요. 숫자를 바꾸었다면 어떤 값이 달라졌는지도 설명해 보세요.';
        finish();
      }
      if (d.type === 'error') {
        $('status').textContent = '코드 확인 필요'; $('output').classList.add('error');
        $('output').textContent = (buffer ? buffer + '\n' : '') + d.error;
        $('help').querySelector('b').textContent = '이 부분부터 살펴보세요';
        const hints = {
          SyntaxError: '따옴표와 괄호가 짝을 이루는지 확인하세요.',
          NameError: '변수에 값을 먼저 넣었나요? 이름의 철자와 대소문자도 확인하세요.',
          IndexError: '리스트의 첫 위치는 0이에요. 값이 5개라면 인덱스는 0~4인지 확인하세요.',
          IndentationError: 'if·else·for 줄 다음에는 들여쓰기가 필요해요. 안쪽으로 한 단계 들어갈 때마다 공백 네 칸을 넣어보세요.',
          TypeError: '문자열과 숫자를 함께 더했나요? 숫자로 계산하려면 자료형을 맞춰주세요.',
          ValueError: '숫자로 바꿀 수 있는 문자열인가요? 단위나 쉼표가 포함됐는지 확인하세요.',
          ZeroDivisionError: '0으로 나눌 수는 없어요. 나누는 숫자를 확인하세요.'
        };
        $('help').querySelector('p').textContent = Object.entries(hints).find(([k]) => d.error.includes(k))?.[1] || '오류의 마지막 줄을 읽고 예제와 다른 부분을 하나씩 확인해 보세요.';
        finish();
      }
    };
  }
  worker.postMessage({ code: $('code').value }); return promise;
}
$('run').onclick = run;
let printContainer = null;
function cleanupPrint() { printContainer?.remove(); printContainer = null; }
window.addEventListener('afterprint', cleanupPrint);
$('print').onclick = () => {
  cleanupPrint(); printContainer = document.createElement('div'); printContainer.id = 'printAll';
  for (let p = 0; p < 3; p++) {
    const sheet = document.createElement('article'); sheet.className = 'paper'; sheet.innerHTML = pageMarkup(p); fillFields(sheet);
    sheet.querySelectorAll('textarea').forEach(el => { const text = document.createElement('div'); text.className = 'printed-answer'; text.textContent = el.value || ' '; el.replaceWith(text); });
    sheet.querySelectorAll('details').forEach(el => { el.open = true; });
    sheet.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    printContainer.appendChild(sheet);
  }
  document.body.appendChild(printContainer); window.print();
};
render(); lines();
if (document.modelContext?.registerTool) {
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'set_practice_code', description: '현재 날짜의 파이썬 실습 코드를 변경합니다. 실행하지는 않습니다.',
      inputSchema: { type: 'object', properties: { code: { type: 'string', maxLength: 10000 } }, required: ['code'], additionalProperties: false },
      annotations: { readOnlyHint: false },
      execute(input) { if (typeof input?.code !== 'string' || input.code.length > 10000) throw new Error('코드는 10000자 이하 문자열이어야 합니다.'); setCode(input.code); return { updated: true, day }; }
    })).catch(() => {});
  } catch {}
}
