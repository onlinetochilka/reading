'use strict';

/**
 * App — main application orchestrator.
 * Depends on: Timer, Assessment, UI (loaded before this file).
 */
const App = (() => {

  // ── Application State ─────────────────────────────────────────────────────

  const state = {
    currentTab:   'students',
    classes:      [],
    texts:        [],
    checkMode:    'teacher',  // 'teacher' | 'self'
    checkState:   'setup',    // 'setup' | 'reading' | 'word-select'
    printLayout:  'portrait', // 'portrait' | 'landscape'
    session:      null,
    chartInstance: null,
  };

  function freshSession(mode) {
    return {
      mode,
      studentId:      null, studentName: null,
      classId:        null, className:   null,
      grade:          null,
      textId:         null, textTitle:   null,
      elapsed:        0, wordCount: 0, wpm: 0,
      errors:         { distortion: 0, accent: 0, ending: 0, regression: 0, syllabic: 0 },
      expressiveness: { ignoreSigns: false, monotone: false, wrongAccents: false },
      comprehension:  [],
    };
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  function loadClasses() {
    try { state.classes = JSON.parse(localStorage.getItem('tochilka_classes')) || []; }
    catch { state.classes = []; }
  }
  function saveClasses() {
    localStorage.setItem('tochilka_classes', JSON.stringify(state.classes));
  }
  function gradeFromClassName(name) {
    const m = String(name || '').match(/^(\d+)/);
    return m ? parseInt(m[1]) : null;
  }

  // ── Tab Switching ─────────────────────────────────────────────────────────

  function switchTab(tab) {
    state.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn =>
      btn.classList.toggle('active', btn.dataset.tab === tab)
    );
    document.querySelectorAll('.tab-content').forEach(el =>
      el.classList.toggle('active', el.id === `tab-${tab}`)
    );
    if (tab === 'students')   renderStudents();
    if (tab === 'library')    renderLibrary();
    if (tab === 'check')      renderCheck();
    if (tab === 'statistics') renderStats();
  }

  // ── STUDENTS TAB ──────────────────────────────────────────────────────────

  function renderStudents() {
    UI.renderClasses(state.classes, document.getElementById('classes-list'), {
      onDelete: classId => {
        if (!confirm('Удалить класс и всех учеников?')) return;
        state.classes = state.classes.filter(c => c.id !== classId);
        saveClasses();
        renderStudents();
        UI.showToast('Класс удалён');
      },
    });
  }

  function createClass() {
    const nameEl     = document.getElementById('class-name');
    const studentsEl = document.getElementById('students-list');
    const name       = nameEl.value.trim();
    if (!name) { UI.showToast('Введите название класса', 'error'); return; }

    const students = studentsEl.value.split('\n').map(s => s.trim()).filter(Boolean)
      .map((n, i) => ({ id: `s${Date.now()}_${i}`, name: n }));
    if (!students.length) { UI.showToast('Добавьте хотя бы одного ученика', 'error'); return; }

    state.classes.push({ id: `c${Date.now()}`, name, students });
    saveClasses();
    nameEl.value = ''; studentsEl.value = '';
    renderStudents();
    UI.showToast(`Класс «${name}» создан (${students.length} уч.)`);
  }

  // ── LIBRARY TAB ───────────────────────────────────────────────────────────

  function renderLibrary() {
    UI.renderLibraryList(state.texts, document.getElementById('library-list'), printSingleText);
    applyPrintLayout(state.printLayout);
  }

  function printSingleText(id) {
    const textData = state.texts.find(t => t.id === id);
    if (!textData) return;
    const wrapper = document.getElementById('print-content-wrapper');
    wrapper.innerHTML = '';
    const div = document.createElement('div');
    UI.renderPrintPreview(textData, div);
    wrapper.appendChild(div.firstElementChild);
    window.print();
  }

  function printAllTexts() {
    const wrapper = document.getElementById('print-content-wrapper');
    wrapper.innerHTML = '';
    state.texts.forEach(t => {
      const div = document.createElement('div');
      UI.renderPrintPreview(t, div);
      wrapper.appendChild(div.firstElementChild);
    });
    window.print();
  }

  function openAddTextModal() {
    document.getElementById('add-text-title').value = '';
    document.getElementById('add-text-content').value = '';
    document.getElementById('add-text-q1').value = '';
    document.getElementById('add-text-q2').value = '';
    document.getElementById('add-text-q3').value = '';
    document.getElementById('modal-add-text').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeAddTextModal() {
    document.getElementById('modal-add-text').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function saveNewText() {
    const title = document.getElementById('add-text-title').value.trim();
    const grade = parseInt(document.getElementById('add-text-grade').value);
    const content = document.getElementById('add-text-content').value.trim();
    
    if (!title || !content) {
      UI.showToast('Название и текст обязательны', 'error');
      return;
    }

    const q1 = document.getElementById('add-text-q1').value.trim();
    const q2 = document.getElementById('add-text-q2').value.trim();
    const q3 = document.getElementById('add-text-q3').value.trim();
    const questions = [];
    if (q1) questions.push({ id: 1, q: q1 });
    if (q2) questions.push({ id: 2, q: q2 });
    if (q3) questions.push({ id: 3, q: q3 });

    const newText = {
      id: `t_custom_${Date.now()}`,
      title,
      grade,
      words: content.split(/(\s+)/).filter(s => s.trim().length > 0).length,
      content,
      questions
    };

    state.texts.push(newText);
    
    // Save to localStorage
    const customTexts = JSON.parse(localStorage.getItem('tochilka_custom_texts') || '[]');
    customTexts.push(newText);
    localStorage.setItem('tochilka_custom_texts', JSON.stringify(customTexts));

    closeAddTextModal();
    UI.showToast('Текст добавлен!');
    renderLibrary();
  }

  function setPrintLayout(layout) {
    state.printLayout = layout;
    applyPrintLayout(layout);
  }

  function applyPrintLayout(layout) {
    // Toggle body class for column preview and print page orientation
    document.body.classList.toggle('print-landscape', layout === 'landscape');

    // Dynamically inject @page size into the print style tag
    const styleTag = document.getElementById('print-page-style');
    if (styleTag) {
      styleTag.textContent = layout === 'landscape'
        ? '@media print { @page { size: A4 landscape; } }'
        : '@media print { @page { size: A4 portrait; } }';
    }

    // Update toggle buttons
    document.getElementById('btn-layout-portrait')?.classList.toggle('active',  layout === 'portrait');
    document.getElementById('btn-layout-landscape')?.classList.toggle('active', layout === 'landscape');
  }

  // ── CHECK TAB — shared ────────────────────────────────────────────────────

  function renderCheck() {
    const mode = state.checkMode;
    document.getElementById('toggle-teacher').classList.toggle('active', mode === 'teacher');
    document.getElementById('toggle-self').classList.toggle('active',    mode === 'self');

    // Populate selects
    UI.renderStudentSelect(state.classes, document.getElementById('student-select'));
    UI.renderTextSelect(state.texts, document.getElementById('text-select-teacher'));
    UI.renderTextSelect(state.texts, document.getElementById('text-select-self'));

    // Show correct mode panel
    UI[mode === 'teacher' ? 'show' : 'hide'](document.getElementById('check-teacher'));
    UI[mode === 'self'    ? 'show' : 'hide'](document.getElementById('check-self'));

    resetCheck();
  }

  function resetCheck() {
    Timer.reset();
    state.checkState = 'setup';
    state.session    = freshSession(state.checkMode);

    // Reset timer display
    const td = document.getElementById('timer-display');
    if (td) td.textContent = '0:00';

    // Reset error counter displays
    ['distortion','accent','ending','regression'].forEach(k => {
      const el = document.getElementById(`counter-${k}`);
      if (el) el.textContent = '0';
    });

    // Reset syllabic toggle
    const syllabic = document.getElementById('toggle-syllabic');
    if (syllabic) syllabic.checked = false;

    // Reset expressiveness
    ['exp-ignore-signs','exp-monotone','exp-wrong-accents'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = false;
    });

    // Clear words count display
    const wcd = document.getElementById('words-count-display');
    if (wcd) wcd.textContent = '';

    // Clear text column — restore placeholder
    const textContainer = document.getElementById('text-display-teacher');
    if (textContainer) {
      textContainer.innerHTML = `
        <div class="text-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="36" height="36" stroke-width="1.2"><path d="M9 12h6M9 16h6M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>
          <p>Выберите ученика и текст, затем нажмите «Старт»</p>
        </div>`;
      textContainer.classList.remove('text-blurred');
    }

    // Clear self text
    const selfText = document.getElementById('text-display-self');
    if (selfText) { selfText.innerHTML = ''; selfText.classList.remove('text-blurred'); }
    const blurMsg = document.getElementById('blur-msg');
    if (blurMsg) { blurMsg.textContent = ''; blurMsg.classList.remove('visible'); }

    // Reset student list column
    UI.renderStudentListForCheck(null, null,
      document.getElementById('check-student-list'),
      document.getElementById('check-class-label')
    );

    updateCheckUI();
  }

  function updateCheckUI() {
    const cs = state.checkState;

    // ── Teacher buttons ──────────────────────────────────────────────────
    const startBtn   = document.getElementById('btn-start-teacher');
    const stopBtn    = document.getElementById('btn-stop-teacher');
    const analyzeBtn = document.getElementById('btn-analyze-teacher');

    if (startBtn)   startBtn.disabled   = (cs !== 'setup');
    if (stopBtn)    stopBtn.disabled    = (cs !== 'reading');
    if (analyzeBtn) analyzeBtn.disabled = (cs !== 'word-select');

    // Error counter buttons active only while reading
    document.querySelectorAll('.error-counter-btn').forEach(btn => {
      btn.disabled = (cs !== 'reading');
    });

    // Syllabic toggle active only while reading
    const syllabicToggle = document.getElementById('toggle-syllabic');
    if (syllabicToggle) syllabicToggle.disabled = (cs !== 'reading');

    // ── Self mode panels ─────────────────────────────────────────────────
    UI[cs === 'setup' ? 'show' : 'hide'](document.getElementById('check-setup-self'));
    UI[cs !== 'setup' ? 'show' : 'hide'](document.getElementById('check-reading-self'));

    const finishBtn = document.getElementById('btn-finish-self');
    if (finishBtn) {
      const unlim = document.getElementById('duration-select')?.value !== '60';
      UI[cs === 'reading' && unlim ? 'show' : 'hide'](finishBtn);
    }
  }

  // ── CHECK TAB — TEACHER MODE ──────────────────────────────────────────────

  function startTeacherCheck() {
    const studentVal = document.getElementById('student-select').value;
    const textId     = document.getElementById('text-select-teacher').value;
    if (!studentVal) { UI.showToast('Выберите ученика', 'error'); return; }
    if (!textId)     { UI.showToast('Выберите текст',   'error'); return; }

    const [classId, studentId] = studentVal.split('::');
    const cls      = state.classes.find(c => c.id === classId);
    const student  = cls?.students.find(s => s.id === studentId);
    const textData = state.texts.find(t => t.id === textId);
    if (!textData) { UI.showToast('Текст не найден', 'error'); return; }

    Object.assign(state.session, {
      classId, className:   cls?.name    ?? '—',
      studentId, studentName: student?.name ?? '—',
      grade:    gradeFromClassName(cls?.name),
      textId,   textTitle: textData.title,
    });

    state.checkState = 'reading';

    // Populate left column with class students
    UI.renderStudentListForCheck(
      cls, studentId,
      document.getElementById('check-student-list'),
      document.getElementById('check-class-label')
    );

    // Render clean text in right column
    UI.renderTextForReading(textData, document.getElementById('text-display-teacher'));

    // Reset counters
    ['distortion','accent','ending','regression'].forEach(k => {
      state.session.errors[k] = 0;
      const el = document.getElementById(`counter-${k}`);
      if (el) el.textContent = '0';
    });
    const syllabic = document.getElementById('toggle-syllabic');
    if (syllabic) syllabic.checked = false;

    updateCheckUI();

    Timer.start({
      onTick: elapsed => {
        const td = document.getElementById('timer-display');
        if (td) td.textContent = Timer.formatTime(elapsed);
      },
    });
  }

  function stopTeacherCheck() {
    state.session.elapsed = Timer.stop();
    state.checkState = 'word-select';
    updateCheckUI();

    const textContainer = document.getElementById('text-display-teacher');
    const textData      = state.texts.find(t => t.id === state.session.textId);
    UI.renderTextForReading(textData, textContainer, { clickable: true });
    UI.showToast('Кликните на последнее слово, которое прочёл ученик', 'info');
  }

  // Delegated click for word selection (registered once in bindEvents)
  function onWordClick(e) {
    if (state.checkState !== 'word-select') return;
    const word = e.target.closest('.word--clickable');
    if (!word) return;

    const idx = parseInt(word.dataset.index);
    state.session.wordCount = idx + 1;
    state.session.wpm = Math.round((state.session.wordCount / state.session.elapsed) * 60);

    UI.highlightWordsUpTo(document.getElementById('text-display-teacher'), idx);

    const wcd = document.getElementById('words-count-display');
    if (wcd) wcd.textContent = `${state.session.wordCount} слов → ${state.session.wpm} сл/мин`;
  }

  function openTeacherAnalysis() {
    if (!state.session.wordCount) {
      UI.showToast('Кликните на последнее слово перед анализом', 'error');
      return;
    }
    // Collect syllabic from toggle (boolean → number)
    state.session.errors.syllabic = document.getElementById('toggle-syllabic')?.checked ? 1 : 0;
    // Collect expressiveness
    state.session.expressiveness = {
      ignoreSigns:  document.getElementById('exp-ignore-signs')?.checked  ?? false,
      monotone:     document.getElementById('exp-monotone')?.checked      ?? false,
      wrongAccents: document.getElementById('exp-wrong-accents')?.checked ?? false,
    };
    UI.showModal(state.session, state.texts);
  }

  // Student select → update student list column immediately
  function onStudentSelectChange() {
    const val = document.getElementById('student-select')?.value;
    if (!val) {
      UI.renderStudentListForCheck(null, null,
        document.getElementById('check-student-list'),
        document.getElementById('check-class-label')
      );
      return;
    }
    const [classId, studentId] = val.split('::');
    const cls = state.classes.find(c => c.id === classId);
    UI.renderStudentListForCheck(
      cls, studentId,
      document.getElementById('check-student-list'),
      document.getElementById('check-class-label')
    );
  }

  // ── CHECK TAB — SELF MODE ─────────────────────────────────────────────────

  function startSelfCheck() {
    const textId   = document.getElementById('text-select-self').value;
    const duration = document.getElementById('duration-select').value;
    const grade    = document.getElementById('grade-select-self')?.value;
    if (!textId) { UI.showToast('Выберите текст', 'error'); return; }

    const textData = state.texts.find(t => t.id === textId);
    if (!textData) { UI.showToast('Текст не найден', 'error'); return; }

    Object.assign(state.session, {
      textId, textTitle: textData.title,
      grade: grade ? parseInt(grade) : null,
    });

    state.checkState = 'reading';
    const container  = document.getElementById('text-display-self');
    UI.renderTextForReading(textData, container, { large: true });
    container.classList.remove('text-blurred');
    updateCheckUI();

    const durSecs = duration === '60' ? 60 : null;
    const blurMsg = document.getElementById('blur-msg');
    if (blurMsg) blurMsg.textContent = '';

    Timer.start({
      duration: durSecs,
      onComplete: elapsed => {
        state.session.elapsed = elapsed;
        const blurMsg = document.getElementById('blur-msg');
        if (blurMsg) { blurMsg.textContent = 'Время вышло! Выберите последнее прочитанное слово.'; blurMsg.classList.add('visible'); }
        transitionSelfToCheckWord();
      },
    });
  }

  function finishSelfCheck() {
    state.session.elapsed = Timer.stop();
    const blurMsg = document.getElementById('blur-msg');
    if (blurMsg) { blurMsg.textContent = 'Выберите последнее прочитанное слово.'; blurMsg.classList.add('visible'); }
    transitionSelfToCheckWord();
  }

  function transitionSelfToCheckWord() {
    state.checkState = 'word-select';
    updateCheckUI();
    const textContainer = document.getElementById('text-display-self');
    const textData      = state.texts.find(t => t.id === state.session.textId);
    UI.renderTextForReading(textData, textContainer, { clickable: true, large: true });
    // Delegate word click locally or via the global listener if ID matches.
    // We already have a global listener, let's just make sure it also covers self mode.
    UI.showToast('Кликните на последнее слово', 'info');
  }

  function openSelfAnalysis() { UI.showModal(state.session, state.texts); }

  // ── MODAL ─────────────────────────────────────────────────────────────────

  function handleAnswerBtn(btn) {
    const qi  = parseInt(btn.dataset.qi);
    const ans = btn.dataset.ans === 'true';
    if (!state.session.comprehension) state.session.comprehension = [];
    state.session.comprehension[qi] = { correct: ans };
    const row = btn.closest('.question-row');
    row.querySelectorAll('.btn-answer').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }

  function saveResult() {
    const session = state.session;
    if (session.mode === 'self' && !session.wpm) {
      const inp   = document.getElementById('modal-words-input');
      const words = inp ? parseInt(inp.value) : 0;
      if (words > 0) {
        session.wordCount = words;
        session.wpm = Math.round((words / Math.max(session.elapsed, 1)) * 60);
      }
    }
    Assessment.saveResult({ ...session });
    UI.hideModal();
    UI.showToast('Результат сохранён!');
    setTimeout(() => switchTab('statistics'), 600);
  }

  // ── STATISTICS TAB ────────────────────────────────────────────────────────

  function renderStats() {
    UI.renderStatistics(Assessment.getResults());
    document.querySelectorAll('.btn-del-result').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Удалить запись?')) return;
        Assessment.deleteResult(btn.dataset.rid);
        renderStats();
        UI.showToast('Запись удалена');
      });
    });
    document.querySelectorAll('.btn-chart').forEach(btn => {
      btn.addEventListener('click', () => {
        openChart(btn.dataset.studentId, btn.dataset.studentName);
      });
    });
  }

  // ── CHART.JS ──────────────────────────────────────────────────────────────

  function openChart(studentId, studentName) {
    const results = Assessment.getResults()
      .filter(r => r.studentId === studentId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (results.length === 0) return;

    document.getElementById('chart-modal-title').textContent = `Динамика: ${studentName}`;
    document.getElementById('modal-chart').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const ctx = document.getElementById('stats-chart').getContext('2d');
    if (state.chartInstance) {
      state.chartInstance.destroy();
    }

    const labels = results.map(r => new Date(r.date).toLocaleDateString('ru-RU'));
    const wpmData = results.map(r => r.wpm || 0);
    const errorsData = results.map(r => 
      (r.errors?.distortion || 0) +
      (r.errors?.accent     || 0) +
      (r.errors?.ending     || 0) +
      (r.errors?.regression || 0) +
      (r.errors?.syllabic   || 0)
    );

    state.chartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Сл/мин (Скорость)',
            data: wpmData,
            borderColor: '#2952A3',
            backgroundColor: 'rgba(41, 82, 163, 0.1)',
            tension: 0.3,
            fill: true,
            yAxisID: 'y'
          },
          {
            label: 'Суммарно ошибок',
            data: errorsData,
            borderColor: '#A83256',
            backgroundColor: 'transparent',
            borderDash: [5, 5],
            tension: 0.3,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'Слов в минуту' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'Ошибки' },
            grid: { drawOnChartArea: false },
            min: 0
          }
        }
      }
    });
  }

  function closeChart() {
    document.getElementById('modal-chart').classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Text Loading ──────────────────────────────────────────────────────────

  async function loadTexts() {
    try {
      const res   = await fetch('texts.json');
      state.texts = await res.json();
    } catch {
      console.warn('texts.json not loaded — using fallback.');
      state.texts = [{
        id: 't001', title: 'Весна', grade: 1, words: 10,
        content: 'Пришла весна. Снег тает. Бегут ручьи. Птицы поют. Дети рады.',
        questions: [
          { id: 1, q: 'Что происходит со снегом?' },
          { id: 2, q: 'Кто поёт?' },
          { id: 3, q: 'Кто рад весне?' },
        ],
      }];
    }
    
    // Load custom texts from localStorage
    try {
      const customTexts = JSON.parse(localStorage.getItem('tochilka_custom_texts') || '[]');
      if (Array.isArray(customTexts)) {
        state.texts = [...state.texts, ...customTexts];
      }
    } catch (e) {
      console.warn('Could not load custom texts', e);
    }
  }

  // ── Event Binding ─────────────────────────────────────────────────────────

  function bindEvents() {
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn =>
      btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    );

    // Base
    document.getElementById('btn-create-class')?.addEventListener('click', createClass);
    document.getElementById('students-list')?.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.ctrlKey) createClass();
    });

    // Print tab
    document.getElementById('btn-print-all')?.addEventListener('click', printAllTexts);
    document.getElementById('btn-add-text')?.addEventListener('click', openAddTextModal);
    document.getElementById('btn-cancel-add-text')?.addEventListener('click', closeAddTextModal);
    document.getElementById('btn-cancel-add-text-2')?.addEventListener('click', closeAddTextModal);
    document.getElementById('btn-save-new-text')?.addEventListener('click', saveNewText);
    document.getElementById('btn-layout-portrait')?.addEventListener('click',  () => setPrintLayout('portrait'));
    document.getElementById('btn-layout-landscape')?.addEventListener('click', () => setPrintLayout('landscape'));

    // Check mode toggle
    document.getElementById('toggle-teacher')?.addEventListener('click', () => { state.checkMode = 'teacher'; renderCheck(); });
    document.getElementById('toggle-self')?.addEventListener('click',    () => { state.checkMode = 'self';    renderCheck(); });

    // Teacher check flow
    document.getElementById('btn-start-teacher')?.addEventListener('click',   startTeacherCheck);
    document.getElementById('btn-stop-teacher')?.addEventListener('click',    stopTeacherCheck);
    document.getElementById('btn-analyze-teacher')?.addEventListener('click', openTeacherAnalysis);
    document.getElementById('btn-reset-teacher')?.addEventListener('click',   resetCheck);

    // Student select → update student list column
    document.getElementById('student-select')?.addEventListener('change', onStudentSelectChange);

    // Error counter buttons
    ['distortion','accent','ending','regression'].forEach(key => {
      document.getElementById(`btn-${key}`)?.addEventListener('click', () => {
        if (state.checkState !== 'reading') return;
        state.session.errors[key]++;
        const el = document.getElementById(`counter-${key}`);
        if (el) el.textContent = state.session.errors[key];
      });
    });

    // Word click delegation (registered once on the stable container)
    document.getElementById('text-display-teacher')?.addEventListener('click', onWordClick);
    document.getElementById('text-display-self')?.addEventListener('click', onWordClick);

    // Self check flow
    document.getElementById('btn-start-self')?.addEventListener('click',  startSelfCheck);
    document.getElementById('btn-finish-self')?.addEventListener('click', finishSelfCheck);
    document.getElementById('btn-reset-self')?.addEventListener('click',  resetCheck);
    document.getElementById('duration-select')?.addEventListener('change', updateCheckUI);

    // Modal
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') UI.hideModal();
    });
    document.getElementById('modal-chart')?.addEventListener('click', e => {
      if (e.target.id === 'modal-chart') closeChart();
    });
    document.getElementById('modal-add-text')?.addEventListener('click', e => {
      if (e.target.id === 'modal-add-text') closeAddTextModal();
    });
    document.getElementById('btn-cancel-chart')?.addEventListener('click', closeChart);

    document.getElementById('modal-questions')?.addEventListener('click', e => {
      const btn = e.target.closest('.btn-answer');
      if (btn) handleAnswerBtn(btn);
    });
    document.getElementById('btn-save-result')?.addEventListener('click', saveResult);
    document.getElementById('btn-cancel-modal')?.addEventListener('click', UI.hideModal);

    // Statistics
    document.getElementById('btn-export-csv')?.addEventListener('click', Assessment.exportCSV);
    document.getElementById('btn-go-check')?.addEventListener('click',   () => switchTab('check'));
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    loadClasses();
    await loadTexts();
    bindEvents();
    switchTab('students');
  }

  return { init, switchTab };
})();

document.addEventListener('DOMContentLoaded', App.init);
