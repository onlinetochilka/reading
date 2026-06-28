'use strict';

// ── Firebase Configuration ────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyB0Rn1j_PFIl3XlJiT_JvjFSySWHiur01w",
  authDomain: "tochilka-reading.firebaseapp.com",
  projectId: "tochilka-reading",
  storageBucket: "tochilka-reading.firebasestorage.app",
  messagingSenderId: "137874579843",
  appId: "1:137874579843:web:ece2aa6e6182f6362456b6"
};
// Initialize Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

// Temporary Auto-Seeding Logic removed

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
    selectedTextIds: [], // array of string IDs
    checkMode:    'teacher',  // 'teacher' | 'self'
    checkState:   'setup',    // 'setup' | 'reading' | 'word-select'
    printLayout:  'portrait', // 'portrait' | 'landscape'
    session:      null,
    chartInstance: null,
    checkedStudents: new Set(),
    activeClassIdForStudent: null,
    selectedResults: new Set(),
    lastFilteredResults: [],
  };

  function freshSession(mode) {
    return {
      mode,
      studentId:      null, studentName: null,
      classId:        null, className:   null,
      grade:          null,
      textId:         null, textTitle:   null,
      elapsed:        0, wordCount: 0, wpm: 0,
      readingMethod:  'Целыми словами',
      errors:         { distortion: 0, accent: 0, ending: 0, regression: 0 },
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
      onDeleteClass: classId => {
        if (!confirm('Удалить класс и всех учеников?')) return;
        state.classes = state.classes.filter(c => c.id !== classId);
        saveClasses();
        renderStudents();
        UI.showToast('Класс удалён');
      },
      onEditClass: classId => {
        const cls = state.classes.find(c => c.id === classId);
        if (!cls) return;
        const newName = prompt('Введите новое название класса', cls.name);
        if (newName && newName.trim() && newName.trim() !== cls.name) {
          cls.name = newName.trim();
          saveClasses();
          renderStudents();
          UI.showToast('Класс переименован');
        }
      },
      onDeleteStudent: (classId, studentId) => {
        const cls = state.classes.find(c => c.id === classId);
        if (!cls) return;
        const studentIndex = cls.students.findIndex(s => s.id === studentId);
        if (studentIndex === -1) return;
        
        const removedStudent = cls.students[studentIndex];
        cls.students.splice(studentIndex, 1);
        saveClasses();
        renderStudents();
        
        // Undo pattern
        UI.showToast(`Ученик удален`, 'info', () => {
          cls.students.splice(studentIndex, 0, removedStudent);
          saveClasses();
          renderStudents();
        });
      },
      onMoveStudent: (classId, studentId) => {
        if (state.classes.length < 2) {
          UI.showToast('Создайте еще один класс для перевода', 'error');
          return;
        }
        state.moveStudentData = { classId, studentId };
        
        const select = document.getElementById('move-student-select');
        select.innerHTML = '<option value="">— Выберите класс —</option>';
        state.classes.forEach(c => {
          if (c.id !== classId) {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            select.appendChild(opt);
          }
        });
        
        document.getElementById('modal-move-student').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
      },
      onAddStudent: classId => {
        openAddStudentModal(classId);
      }
    });
  }

  function openAddClassModal() {
    document.getElementById('class-name').value = '';
    document.getElementById('students-list').value = '';
    document.getElementById('btn-save-class').disabled = true;
    document.getElementById('modal-add-class').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeAddClassModal() {
    document.getElementById('modal-add-class').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function handleClassNameInput() {
    const name = document.getElementById('class-name').value.trim();
    document.getElementById('btn-save-class').disabled = !name;
  }

  function saveNewClass() {
    const name = document.getElementById('class-name').value.trim();
    if (!name) return;

    const rawLines = document.getElementById('students-list').value.split('\n');
    const students = rawLines
      .map(s => s.replace(/^\s*[\d.)]+\s*/, '').trim())
      .filter(Boolean)
      .map((n, i) => ({ id: `s${Date.now()}_${i}`, name: n }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    state.classes.push({ id: `c${Date.now()}`, name, students });
    saveClasses();
    closeAddClassModal();
    renderStudents();
    UI.showToast(`Класс «${name}» сохранен (${students.length} уч.)`);
  }

  function openAddStudentModal(classId) {
    state.activeClassIdForStudent = classId;
    document.getElementById('student-name').value = '';
    document.getElementById('btn-save-student').disabled = true;
    document.getElementById('modal-add-student').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    setTimeout(() => document.getElementById('student-name').focus(), 100);
  }

  function closeAddStudentModal() {
    state.activeClassIdForStudent = null;
    document.getElementById('modal-add-student').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function handleStudentNameInput() {
    const name = document.getElementById('student-name').value.trim();
    document.getElementById('btn-save-student').disabled = !name;
  }

  function saveNewStudent() {
    if (!state.activeClassIdForStudent) return;
    const name = document.getElementById('student-name').value.trim();
    if (!name) return;

    const cls = state.classes.find(c => c.id === state.activeClassIdForStudent);
    if (!cls) return;

    const newStudent = { id: `s${Date.now()}`, name: name };
    cls.students.push(newStudent);
    cls.students.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    saveClasses();
    closeAddStudentModal();
    renderStudents();
    UI.showToast(`Ученик «${name}» добавлен`);
  }

  function closeMoveStudentModal() {
    state.moveStudentData = null;
    document.getElementById('modal-move-student').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function saveMoveStudent() {
    if (!state.moveStudentData) return;
    const { classId, studentId } = state.moveStudentData;
    const targetClassId = document.getElementById('move-student-select').value;
    if (!targetClassId) return;

    const sourceClass = state.classes.find(c => c.id === classId);
    const targetClass = state.classes.find(c => c.id === targetClassId);
    if (!sourceClass || !targetClass) return;

    const studentIndex = sourceClass.students.findIndex(s => s.id === studentId);
    if (studentIndex === -1) return;

    const [student] = sourceClass.students.splice(studentIndex, 1);
    targetClass.students.push(student);
    targetClass.students.sort((a, b) => a.name.localeCompare(b.name, 'ru'));

    saveClasses();
    closeMoveStudentModal();
    renderStudents();
    UI.showToast(`Ученик «${student.name}» переведен в «${targetClass.name}»`);
  }

  // ── LIBRARY TAB ───────────────────────────────────────────────────────────

  function getFilteredLibraryTexts() {
    let filtered = [...state.texts];
    const classFilter = document.getElementById('lib-filter-class')?.value;
    const sortFilter = document.getElementById('lib-sort')?.value;
    const searchFilter = document.getElementById('lib-search')?.value.toLowerCase().trim();

    if (classFilter) {
      filtered = filtered.filter(t => t.grade === parseInt(classFilter));
    }
    if (searchFilter) {
      filtered = filtered.filter(t => t.title.toLowerCase().includes(searchFilter));
    }
    if (sortFilter === 'short') {
      filtered.sort((a, b) => a.words - b.words);
    } else if (sortFilter === 'long') {
      filtered.sort((a, b) => b.words - a.words);
    }
    return filtered;
  }

  function renderLibrary() {
    const textsToRender = getFilteredLibraryTexts();
    const countSpan = document.getElementById('found-texts-count');
    if (countSpan) countSpan.textContent = `Найдено текстов: ${textsToRender.length}`;
    
    const emptyState = document.getElementById('library-empty-state');
    if (textsToRender.length === 0) {
      if (emptyState) emptyState.style.display = 'flex';
    } else {
      if (emptyState) emptyState.style.display = 'none';
    }

    UI.renderLibraryList(textsToRender, document.getElementById('library-list'), state.selectedTextIds);
    updateSelectAllCheckboxState(textsToRender);
    updateContextActionBar();
  }

  function toggleTextSelection(id) {
    const idx = state.selectedTextIds.indexOf(String(id));
    if (idx > -1) {
      state.selectedTextIds.splice(idx, 1);
    } else {
      state.selectedTextIds.push(String(id));
    }
    updateContextActionBar();
    updateSelectAllCheckboxState(getFilteredLibraryTexts());
  }

  function handleSelectAll() {
    const textsToRender = getFilteredLibraryTexts();
    const cb = document.getElementById('select-all-texts');
    const checked = cb.checked;
    
    if (checked) {
      textsToRender.forEach(t => {
        if (!state.selectedTextIds.includes(String(t.id))) {
          state.selectedTextIds.push(String(t.id));
        }
      });
    } else {
      const visibleIds = textsToRender.map(t => String(t.id));
      state.selectedTextIds = state.selectedTextIds.filter(id => !visibleIds.includes(id));
    }
    
    const checkboxes = document.querySelectorAll('.text-checkbox');
    checkboxes.forEach(c => c.checked = checked);
    
    updateContextActionBar();
    updateSelectAllCheckboxState(textsToRender);
  }

  function updateSelectAllCheckboxState(visibleTexts) {
    const cb = document.getElementById('select-all-texts');
    if (!cb) return;
    
    if (visibleTexts.length === 0) {
      cb.checked = false;
      cb.indeterminate = false;
      return;
    }

    let selectedVisibleCount = 0;
    visibleTexts.forEach(t => {
      if (state.selectedTextIds.includes(String(t.id))) selectedVisibleCount++;
    });

    if (selectedVisibleCount === 0) {
      cb.checked = false;
      cb.indeterminate = false;
    } else if (selectedVisibleCount === visibleTexts.length) {
      cb.checked = true;
      cb.indeterminate = false;
    } else {
      cb.checked = false;
      cb.indeterminate = true;
    }
  }

  function clearSelection() {
    state.selectedTextIds = [];
    document.querySelectorAll('.text-checkbox').forEach(c => c.checked = false);
    updateSelectAllCheckboxState(getFilteredLibraryTexts());
    updateContextActionBar();
  }

  function updateContextActionBar() {
    const bar = document.getElementById('context-action-bar');
    const countSpan = document.getElementById('selection-counter');
    if (!bar || !countSpan) return;

    if (state.selectedTextIds.length > 0) {
      countSpan.textContent = state.selectedTextIds.length;
      countSpan.classList.add('pulse-anim');
      setTimeout(() => countSpan.classList.remove('pulse-anim'), 250);
      bar.classList.add('visible');
    } else {
      bar.classList.remove('visible');
    }
  }

  function printSelectedTexts() {
    if (state.selectedTextIds.length === 0) return;

    if (state.selectedTextIds.length > 15) {
      if (!confirm(`Вы собираетесь отправить на печать ${state.selectedTextIds.length} текстов. Это может занять много бумаги. Продолжить?`)) {
        return;
      }
    }

    const wrapper = document.getElementById('print-content-wrapper');
    wrapper.innerHTML = '';
    
    const layoutRadio = document.querySelector('input[name="cab-print-layout"]:checked');
    const layout = layoutRadio ? layoutRadio.value : 'portrait';
    
    const container = document.createElement('div');
    container.className = 'print-container';
    if (layout === 'landscape') {
      container.style.columnCount = '2';
      container.style.columnGap = '40px';
    }

    const textsToPrint = state.texts.filter(t => state.selectedTextIds.includes(String(t.id)));
      
    textsToPrint.forEach(t => {
      const item = document.createElement('div');
      item.className = 'print-text-block';
      if (t.grade) {
        item.dataset.grade = t.grade;
      }
      
      const title = document.createElement('h2');
      title.textContent = t.title;
      item.appendChild(title);

      const content = document.createElement('div');
      content.style.whiteSpace = 'pre-wrap';
      content.textContent = t.content;
      item.appendChild(content);

      container.appendChild(item);
    });
    
    if (layout === 'landscape') {
      document.body.classList.add('print-landscape');
      const landscapeStyle = document.createElement('style');
      landscapeStyle.id = 'print-landscape-style';
      landscapeStyle.textContent = '@media print { @page { size: landscape !important; margin: 15mm; } }';
      document.head.appendChild(landscapeStyle);
    } else {
      document.body.classList.remove('print-landscape');
    }

    wrapper.appendChild(container);

    // Fallback cleanup
    setTimeout(globalCleanupPrint, 300000); 

    window.print();
  }

  function printBlank() {
    const wrapper = document.getElementById('print-content-wrapper');
    wrapper.innerHTML = '';
    const div = document.createElement('div');
    UI.renderPrintBlank(div);
    wrapper.appendChild(div.firstElementChild);
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
    const container = document.getElementById('tab-check');
    // Clear previous empty state if exists
    const existingEmpty = container.querySelector('.empty-state');
    if (existingEmpty) existingEmpty.remove();

    if (!state.classes.length) {
      document.querySelector('.mode-toggle')?.style.setProperty('display', 'none');
      UI.hide(document.getElementById('check-teacher'));
      UI.hide(document.getElementById('check-self'));
      
      const empty = UI.emptyState(
        'Для запуска проверки нужен хотя бы один класс',
        'Добавьте первый класс и список учеников',
        'Добавить класс',
        openAddClassModal
      );
      // Insert after mode toggle
      const modeToggle = container.querySelector('.mode-toggle');
      if (modeToggle) {
        modeToggle.after(empty);
      } else {
        container.prepend(empty);
      }
      return;
    }

    document.querySelector('.mode-toggle')?.style.removeProperty('display');

    const mode = state.checkMode;
    document.getElementById('toggle-teacher')?.classList.toggle('active', mode === 'teacher');
    document.getElementById('toggle-self')?.classList.toggle('active',    mode === 'self');

    // Populate selects
    UI.renderTextSelect(state.texts, document.getElementById('text-select-teacher'));
    UI.renderTextSelect(state.texts, document.getElementById('text-select-self'));
    UI.renderStudentSelect(state.classes, document.getElementById('student-select-self'));

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

    // Reset reading method (no default)
    document.querySelectorAll('input[name="reading-method"]').forEach(r => r.checked = false);

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
    if (selfText) {
      selfText.innerHTML = `
        <div class="text-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="36" height="36" stroke-width="1.2"><path d="M9 12h6M9 16h6M17 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V4a2 2 0 00-2-2z"/></svg>
          <p>Выберите текст и нажмите «Старт»</p>
        </div>`;
      selfText.classList.remove('text-blurred');
      if (selfText.parentElement) selfText.parentElement.classList.remove('is-evaluating');
    }
    const blurMsg = document.getElementById('blur-msg');
    if (blurMsg) blurMsg.classList.remove('visible');

    // Reset student list column (render accordion)
    const activeClasses = state.classes.map(cls => ({
      ...cls,
      students: cls.students.filter(s => !state.checkedStudents.has(`${cls.id}::${s.id}`))
    })).filter(cls => cls.students.length > 0);

    UI.renderStudentListForCheck(activeClasses, state.session?.studentId, document.getElementById('check-student-list'), onStudentAccordionSelect);

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

    // Error counter buttons active only while reading (excluding modal buttons)
    document.querySelectorAll('.error-counter-btn').forEach(btn => {
      if (!btn.id.includes('-modal')) {
        btn.disabled = (cs !== 'reading');
      }
    });

    // Reading method toggle active only while reading (excluding modal)
    document.querySelectorAll('input[name="reading-method"]').forEach(radio => {
      radio.disabled = (cs !== 'reading');
    });

    // ── Self mode panels ─────────────────────────────────────────────────
    UI.show(document.getElementById('check-setup-self'));
    
    const readingSelf = document.getElementById('check-reading-self');
    if (readingSelf) {
      if (cs !== 'setup') {
        readingSelf.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // prevent background scrolling
      } else {
        readingSelf.classList.add('hidden');
        document.body.style.overflow = '';
      }
    }

    const startSelfBtn = document.getElementById('btn-start-self');
    const stopSelfBtn  = document.getElementById('btn-stop-self');

    if (startSelfBtn) startSelfBtn.disabled = (cs !== 'setup');
    if (stopSelfBtn) {
      if (cs === 'reading') {
        stopSelfBtn.style.display = '';
      } else {
        stopSelfBtn.style.display = 'none';
      }
    }
  }

  // ── CHECK TAB — TEACHER MODE ──────────────────────────────────────────────

  function onStudentAccordionSelect(classId, studentId) {
    if (state.checkState !== 'setup') return; // Can't switch while reading
    const cls = state.classes.find(c => c.id === classId);
    const student = cls?.students.find(s => s.id === studentId);
    if (student) {
      state.session.classId = classId;
      state.session.className = cls.name;
      state.session.studentId = studentId;
      state.session.studentName = student.name;
      state.session.grade = gradeFromClassName(cls.name);
    }
  }

  function startTeacherCheck() {
    const textId = document.getElementById('text-select-teacher').value;
    if (!state.session.studentId) { UI.showToast('Выберите ученика в левой панели', 'error'); return; }
    if (!textId) { UI.showToast('Выберите текст', 'error'); return; }

    const textData = state.texts.find(t => t.id === textId);
    if (!textData) { UI.showToast('Текст не найден', 'error'); return; }

    Object.assign(state.session, {
      textId, textTitle: textData.title,
    });

    state.checkState = 'reading';

    // Render clean text in right column
    UI.renderTextForReading(textData, document.getElementById('text-display-teacher'));

    // Reset counters
    ['distortion','accent','ending','regression'].forEach(k => {
      state.session.errors[k] = 0;
      const el = document.getElementById(`counter-${k}`);
      if (el) el.textContent = '0';
    });
    document.querySelectorAll('input[name="reading-method"]').forEach(r => r.checked = false);

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
    state.session.wpm = Math.round((state.session.wordCount / Math.max(state.session.elapsed, 1)) * 60);

    const container = document.getElementById(`text-display-${state.checkMode}`);
    if (state.checkMode === 'self') {
      UI.clearWordSelection(container);
      word.classList.add('selected-word');
      const evalBtnContainer = document.getElementById('eval-button-container');
      if (evalBtnContainer) {
        evalBtnContainer.style.display = 'block';
        evalBtnContainer.classList.add('slide-up-anim');
      }
    } else {
      UI.highlightWordsUpTo(container, idx);
    }

    const wcd = document.getElementById('words-count-display');
    if (wcd) wcd.textContent = `${state.session.wordCount} слов → ${state.session.wpm} сл/мин`;
    
    updateCheckUI();
  }

  function openTeacherAnalysis() {
    if (!state.session.wordCount) {
      UI.showToast('Кликните на последнее слово перед анализом', 'error');
      return;
    }
    // Collect reading method
    const rmChecked = document.querySelector('input[name="reading-method"]:checked');
    state.session.readingMethod = rmChecked ? rmChecked.value : 'Целыми словами';
    
    // Expressiveness is now checked in the modal, we don't collect it here.
    
    UI.showModal(state.session, state.texts);
  }



  // ── CHECK TAB — SELF MODE ─────────────────────────────────────────────────

  function startSelfCheck() {
    const textId = document.getElementById('text-select-self').value;
    const studentCompositeId = document.getElementById('student-select-self').value;
    
    if (!textId) { UI.showToast('Выберите текст', 'error'); return; }
    if (!studentCompositeId) { UI.showToast('Выберите ученика', 'error'); return; }

    const textData = state.texts.find(t => t.id === textId);
    if (!textData) { UI.showToast('Текст не найден', 'error'); return; }

    const targetStudentId = studentCompositeId.includes('::') ? studentCompositeId.split('::')[1] : studentCompositeId;
    let foundStudent = null;
    let foundClass = null;
    for (const c of state.classes) {
      const s = c.students.find(st => String(st.id) === String(targetStudentId));
      if (s) { foundStudent = s; foundClass = c; break; }
    }

    Object.assign(state.session, {
      textId, textTitle: textData.title,
      studentId: foundStudent?.id,
      studentName: foundStudent?.name,
      classId: foundClass?.id,
      className: foundClass?.name,
      grade: foundClass ? gradeFromClassName(foundClass.name) : null,
    });
    
    ['distortion','accent','ending','regression'].forEach(k => {
      state.session.errors[k] = 0;
    });
    document.querySelectorAll('input[name="reading-method"]').forEach(r => r.checked = false);

    state.checkState = 'reading';
    const container = document.getElementById('text-display-self');
    UI.renderTextForReading(textData, container, { large: true });
    container.parentElement.classList.remove('is-evaluating');

    // Hide eval button
    const evalBtnContainer = document.getElementById('eval-button-container');
    if (evalBtnContainer) {
      evalBtnContainer.style.display = 'none';
      evalBtnContainer.classList.remove('slide-up-anim');
    }

    updateCheckUI();

    const blurMsg = document.getElementById('blur-msg');
    if (blurMsg) blurMsg.textContent = '';

    Timer.start({
      onTick: elapsed => {
        const td = document.getElementById('timer-display-self');
        if (td) td.textContent = Timer.formatTime(elapsed);
      }
    });
  }

  function stopSelfCheck() {
    state.session.elapsed = Timer.stop();
    state.checkState = 'word-select';
    updateCheckUI();

    const textContainer = document.getElementById('text-display-self');
    const textData      = state.texts.find(t => t.id === state.session.textId);
    UI.renderTextForReading(textData, textContainer, { clickable: true, large: true });
    textContainer.parentElement.classList.add('is-evaluating');

    const blurMsg = document.getElementById('blur-msg');
    if (blurMsg) { blurMsg.textContent = 'Кликните на последнее слово, которое прочёл ученик'; blurMsg.classList.add('visible'); }
  }

  function openSelfAnalysis() { 
    if (!state.session.wordCount) {
      UI.showToast('Кликните на последнее слово перед оценкой', 'error');
      return;
    }
    UI.showModal(state.session, state.texts); 
  }

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
    const isModal = (state.checkMode === 'self' || session.checkMode === 'self' || document.getElementById('modal-overlay').classList.contains('hidden') === false);
    
    let rmChecked;
    let isMonotone;
    let ignoreSigns;
    let orthographic;

    if (isModal) {
      rmChecked = document.querySelector('input[name="reading-method-modal"]:checked');
      isMonotone = document.querySelector('input[name="exp-monotone-radio-modal"]:checked')?.value === 'true';
      ignoreSigns = document.getElementById('exp-ignore-signs-modal')?.checked ?? false;
      orthographic = document.getElementById('rm-orthographic-modal')?.checked ?? false;
    } else {
      rmChecked = document.querySelector('input[name="reading-method"]:checked');
      isMonotone = document.querySelector('input[name="exp-monotone-radio"]:checked')?.value === 'true';
      ignoreSigns = document.getElementById('exp-ignore-signs')?.checked ?? false;
      orthographic = document.getElementById('rm-orthographic')?.checked ?? false;
    }

    if (!rmChecked) {
      const rmSection = document.getElementById('reading-method-container');
      if (rmSection) {
        rmSection.classList.remove('has-error');
        void rmSection.offsetWidth; // trigger reflow
        rmSection.classList.add('has-error');
      }
      UI.showToast('Пожалуйста, выберите способ чтения', 'error');
      return;
    }
    session.readingMethod = rmChecked.value;

    session.expressiveness = {
      ignoreSigns:  ignoreSigns,
      monotone:     isMonotone,
    };
    session.orthographicReading = orthographic;

    if (session.comprehension && session.comprehension.length > 0) {
      const correct = session.comprehension.filter(c => c && c.correct).length;
      const total = session.comprehension.length;
      session.comprehensionScore = { correct, total };
      delete session.comprehension;
    }

    Assessment.saveResult({ ...session });
    
    if (session.classId && session.studentId) {
      state.checkedStudents.add(`${session.classId}::${session.studentId}`);
    }

    UI.hideModal();
    UI.showToast('Результат сохранён!');
    resetCheck();
  }

  // ── MANUAL ENTRY ──────────────────────────────────────────────────────────
  
  function openManualEntry() {
    const d = new Date();
    // YYYY-MM-DD
    const pad = n => n.toString().padStart(2, '0');
    document.getElementById('manual-date').value = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    
    UI.renderStudentSelect(state.classes, document.getElementById('manual-student'));
    UI.renderTextSelect(state.texts, document.getElementById('manual-text'));
    
    document.getElementById('manual-wpm').value = '';
    document.getElementById('manual-method').value = 'Целыми словами';
    document.getElementById('manual-err-dist').value = '0';
    document.getElementById('manual-err-acc').value = '0';
    document.getElementById('manual-err-end').value = '0';
    document.getElementById('manual-err-reg').value = '0';
    document.getElementById('manual-exp-ignore').checked = false;
    document.getElementById('manual-exp-mono').checked = false;

    document.getElementById('modal-manual-entry').classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeManualEntry() {
    document.getElementById('modal-manual-entry').classList.add('hidden');
    document.body.style.overflow = '';
  }

  function saveManualEntry() {
    const dateStr = document.getElementById('manual-date').value;
    const studentVal = document.getElementById('manual-student').value;
    const textId = document.getElementById('manual-text').value;
    const wpm = parseInt(document.getElementById('manual-wpm').value);

    if (!dateStr || !studentVal || !textId || isNaN(wpm)) {
      UI.showToast('Заполните обязательные поля (Дата, Ученик, Текст, Скорость)', 'error');
      return;
    }

    const [classId, studentId] = studentVal.split('::');
    const cls = state.classes.find(c => c.id === classId);
    const student = cls?.students.find(s => s.id === studentId);
    const textData = state.texts.find(t => t.id === textId);

    const record = {
      mode: 'teacher',
      date: new Date(dateStr).toISOString(),
      classId,
      className: cls.name,
      grade: gradeFromClassName(cls.name),
      studentId,
      studentName: student.name,
      textId,
      textTitle: textData.title,
      wpm,
      elapsed: 60,
      wordCount: wpm,
      readingMethod: document.getElementById('manual-method').value,
      errors: {
        distortion: parseInt(document.getElementById('manual-err-dist').value) || 0,
        accent: parseInt(document.getElementById('manual-err-acc').value) || 0,
        ending: parseInt(document.getElementById('manual-err-end').value) || 0,
        regression: parseInt(document.getElementById('manual-err-reg').value) || 0,
      },
      expressiveness: {
        ignoreSigns: document.getElementById('manual-exp-ignore').checked,
        monotone: document.getElementById('manual-exp-mono').checked,
      },
      comprehension: [],
    };

    Assessment.saveResult(record);
    closeManualEntry();
    UI.showToast('Результат добавлен вручную');
    renderStats();
  }

  // ── STATISTICS TAB ────────────────────────────────────────────────────────

  function updateStatsFilters() {
    const classFilter = document.getElementById('stats-filter-class');
    const studentFilter = document.getElementById('stats-filter-student');
    if (!classFilter || !studentFilter) return;

    // Populate classes
    const savedClassVal = classFilter.value;
    classFilter.innerHTML = '<option value="">Все классы</option>';
    state.classes.forEach(c => {
      classFilter.appendChild(new Option(c.name, c.id));
    });
    if (state.classes.some(c => c.id === savedClassVal)) {
      classFilter.value = savedClassVal;
    }

    // Populate students based on class (or all classes if none selected)
    const savedStudentVal = studentFilter.value;
    studentFilter.innerHTML = '<option value="">Все ученики</option>';
    studentFilter.disabled = false;

    let studentsToDisplay = [];

    if (classFilter.value) {
      const cls = state.classes.find(c => c.id === classFilter.value);
      if (cls) {
        studentsToDisplay = cls.students.map(s => ({ ...s, displayName: s.name }));
      }
    } else {
      state.classes.forEach(c => {
        c.students.forEach(s => {
          studentsToDisplay.push({ ...s, displayName: `${s.name} (${c.name})` });
        });
      });
      studentsToDisplay.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    }

    studentsToDisplay.forEach(s => {
      studentFilter.appendChild(new Option(s.displayName, s.id));
    });

    if (studentsToDisplay.some(s => s.id === savedStudentVal)) {
      studentFilter.value = savedStudentVal;
    }
  }

  function updateJournalActionBar() {
    const actionBar = document.getElementById('action-bar');
    const countSpan = document.getElementById('selected-students-count');
    if (!actionBar || !countSpan) return;
    
    const count = state.selectedResults.size;
    countSpan.textContent = count;
    
    if (count > 0) {
      actionBar.classList.remove('hidden');
    } else {
      actionBar.classList.add('hidden');
    }
    
    const selectAllCb = document.getElementById('stats-select-all');
    if (selectAllCb) {
      if (state.lastFilteredResults.length === 0) {
        selectAllCb.checked = false;
        selectAllCb.disabled = true;
      } else {
        selectAllCb.disabled = false;
        selectAllCb.checked = state.lastFilteredResults.every(r => state.selectedResults.has(String(r.id)));
      }
    }
    
    const btnExport = document.getElementById('btn-export-csv');
    if (btnExport) {
      btnExport.disabled = state.lastFilteredResults.length === 0;
    }
  }

  function renderStats() {
    const emptyTitle = document.querySelector('#stats-empty .empty-title');
    const emptySub = document.querySelector('#stats-empty .empty-sub');
    const emptyBtn = document.getElementById('btn-go-check');
    
    if (!state.classes.length) {
      if (emptyTitle) emptyTitle.textContent = 'Здесь появится статистика после первых проверок';
      if (emptySub) emptySub.textContent = 'Добавьте учеников, чтобы начать.';
      if (emptyBtn) emptyBtn.style.display = 'none';
    } else {
      if (emptyTitle) emptyTitle.textContent = 'Результатов пока нет';
      if (emptySub) emptySub.textContent = 'Проведите первую проверку, чтобы здесь появились данные';
      if (emptyBtn) emptyBtn.style.display = '';
    }

    const classFilter = document.getElementById('stats-filter-class')?.value;
    const studentFilter = document.getElementById('stats-filter-student')?.value;

    let results = Assessment.getResults();
    if (classFilter)   results = results.filter(r => r.classId === classFilter);
    if (studentFilter) results = results.filter(r => r.studentId === studentFilter);

    state.lastFilteredResults = results;
    UI.renderStatistics(results, state.selectedResults);
    updateJournalActionBar();

    document.querySelectorAll('.btn-del-result').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm('Удалить запись?')) return;
        Assessment.deleteResult(btn.dataset.rid);
        state.selectedResults.delete(String(btn.dataset.rid));
        renderStats();
        UI.showToast('Запись удалена');
      });
    });
    document.querySelectorAll('.btn-chart').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openChart(btn.dataset.studentId, btn.dataset.studentName);
      });
    });

    const tbody = document.querySelector('#stats-table tbody');
    if (tbody) {
      tbody.querySelectorAll('tr').forEach(tr => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('input[type="checkbox"]') || e.target.closest('button')) {
            return;
          }
          const rid = tr.dataset.rid;
          const result = Assessment.getResults().find(r => String(r.id) === rid);
          if (result) {
            UI.showStudentCardModal(result);
          }
        });
        
        const cb = tr.querySelector('.row-checkbox');
        if (cb) {
          cb.addEventListener('click', (e) => {
            e.stopPropagation();
            if (cb.checked) {
              state.selectedResults.add(cb.value);
            } else {
              state.selectedResults.delete(cb.value);
            }
            updateJournalActionBar();
          });
        }
      });
    }
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
      (r.errors?.regression || 0)
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
      if (db) {
        const querySnapshot = await db.collection('texts_for_reading').get();
        const firebaseTexts = [];
        querySnapshot.forEach((doc) => {
          firebaseTexts.push({ id: doc.id, ...doc.data() });
        });
        state.texts = firebaseTexts;
      } else {
        console.warn('Firebase not initialized. Cannot load texts.');
        state.texts = [];
      }
    } catch (error) {
      console.error('Error loading texts from Firebase:', error);
      state.texts = [];
    }

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

  function globalCleanupPrint() {
    document.body.classList.remove('print-landscape');
    const style = document.getElementById('print-landscape-style');
    if (style) style.remove();
    const wrapper = document.getElementById('print-content-wrapper');
    if (wrapper) wrapper.innerHTML = '';
    const container = document.getElementById('print-container');
    if (container) container.innerHTML = '';
  }

  function bindEvents() {
    window.addEventListener('afterprint', globalCleanupPrint);
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn =>
      btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    );

    // Base
    document.getElementById('btn-open-add-class-modal')?.addEventListener('click', openAddClassModal);
    document.getElementById('btn-cancel-add-class')?.addEventListener('click', closeAddClassModal);
    document.getElementById('btn-cancel-add-class-2')?.addEventListener('click', closeAddClassModal);
    document.getElementById('btn-save-class')?.addEventListener('click', saveNewClass);
    document.getElementById('class-name')?.addEventListener('input', handleClassNameInput);
    document.getElementById('modal-add-class')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeAddClassModal();
    });

    document.getElementById('btn-cancel-add-student')?.addEventListener('click', closeAddStudentModal);
    document.getElementById('btn-cancel-add-student-2')?.addEventListener('click', closeAddStudentModal);
    document.getElementById('btn-save-student')?.addEventListener('click', saveNewStudent);
    document.getElementById('student-name')?.addEventListener('input', handleStudentNameInput);
    document.getElementById('modal-add-student')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeAddStudentModal();
    });

    document.getElementById('btn-cancel-move-student')?.addEventListener('click', closeMoveStudentModal);
    document.getElementById('btn-cancel-move-student-2')?.addEventListener('click', closeMoveStudentModal);
    document.getElementById('btn-save-move-student')?.addEventListener('click', saveMoveStudent);
    document.getElementById('modal-move-student')?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeMoveStudentModal();
    });

    // Print tab
    document.getElementById('btn-print-blank')?.addEventListener('click', printBlank);
    document.getElementById('btn-add-text')?.addEventListener('click', openAddTextModal);
    document.getElementById('btn-cancel-add-text')?.addEventListener('click', closeAddTextModal);
    document.getElementById('btn-cancel-add-text-2')?.addEventListener('click', closeAddTextModal);
    document.getElementById('btn-save-new-text')?.addEventListener('click', saveNewText);
    
    // Context Action Bar events
    document.getElementById('select-all-texts')?.addEventListener('change', handleSelectAll);
    document.getElementById('btn-clear-selection')?.addEventListener('click', clearSelection);
    document.getElementById('btn-cab-print')?.addEventListener('click', printSelectedTexts);
    
    // Delegation for individual checkboxes
    document.getElementById('library-list')?.addEventListener('change', e => {
      if (e.target.classList.contains('text-checkbox')) {
        toggleTextSelection(e.target.value);
      }
    });
    
    // Library filters
    document.getElementById('lib-filter-class')?.addEventListener('change', renderLibrary);
    document.getElementById('lib-sort')?.addEventListener('change', renderLibrary);
    let searchTimeout;
    document.getElementById('lib-search')?.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(renderLibrary, 250);
    });

    // Check mode toggle
    document.getElementById('toggle-teacher')?.addEventListener('click', () => { state.checkMode = 'teacher'; renderCheck(); });
    document.getElementById('toggle-self')?.addEventListener('click',    () => { state.checkMode = 'self';    renderCheck(); });

    // Teacher check flow
    document.getElementById('btn-start-teacher')?.addEventListener('click',   startTeacherCheck);
    document.getElementById('btn-stop-teacher')?.addEventListener('click',    stopTeacherCheck);
    document.getElementById('btn-analyze-teacher')?.addEventListener('click', openTeacherAnalysis);
    document.getElementById('btn-reset-teacher')?.addEventListener('click',   resetCheck);

    // Error counter buttons
    ['distortion','accent','ending','regression'].forEach(key => {
      // Main screen (Teacher)
      const btn = document.getElementById(`btn-${key}`);
      if (btn) {
        btn.addEventListener('click', () => {
          if (state.checkState !== 'reading') return;
          state.session.errors[key]++;
          const el = document.getElementById(`counter-${key}`);
          if (el) el.textContent = state.session.errors[key];
        });
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (state.checkState !== 'reading') return;
          if (state.session.errors[key] > 0) state.session.errors[key]--;
          const el = document.getElementById(`counter-${key}`);
          if (el) el.textContent = state.session.errors[key];
        });
      }
      
      // Modal (Self)
      const btnModal = document.getElementById(`btn-${key}-modal`);
      if (btnModal) {
        btnModal.addEventListener('click', (e) => {
          e.preventDefault();
          state.session.errors[key]++;
          const el = document.getElementById(`counter-${key}-modal`);
          if (el) el.textContent = state.session.errors[key];
        });
        btnModal.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          if (state.session.errors[key] > 0) state.session.errors[key]--;
          const el = document.getElementById(`counter-${key}-modal`);
          if (el) el.textContent = state.session.errors[key];
        });
      }
    });

    // Text class filter in check tab
    document.getElementById('text-class-filter')?.addEventListener('change', (e) => {
      const val = e.target.value;
      const filtered = val ? state.texts.filter(t => t.grade === parseInt(val)) : state.texts;
      const selectEl = document.getElementById('text-select-teacher');
      UI.renderTextSelect(filtered, selectEl);
      if (filtered.length === 0) {
        selectEl.innerHTML = '<option value="" disabled selected>Тексты не найдены</option>';
      }
    });

    // Word click delegation (registered once on the stable container)
    document.getElementById('text-display-teacher')?.addEventListener('click', onWordClick);
    document.getElementById('text-display-self')?.addEventListener('click', onWordClick);

    // Self check flow
    document.getElementById('btn-start-self')?.addEventListener('click',  startSelfCheck);
    document.getElementById('btn-stop-self')?.addEventListener('click', stopSelfCheck);
    document.getElementById('btn-reset-self')?.addEventListener('click',  resetCheck);
    document.getElementById('btn-close-reading-self')?.addEventListener('click', resetCheck);
    document.getElementById('btn-proceed-eval')?.addEventListener('click', openSelfAnalysis);

    document.getElementById('text-class-filter-self')?.addEventListener('change', (e) => {
      const val = e.target.value;
      // Filter texts
      const filteredTexts = val ? state.texts.filter(t => t.grade === parseInt(val)) : state.texts;
      const textSelectEl = document.getElementById('text-select-self');
      UI.renderTextSelect(filteredTexts, textSelectEl);
      if (filteredTexts.length === 0) {
        textSelectEl.innerHTML = '<option value="" disabled selected>Тексты не найдены</option>';
      }
      
      // Filter students
      const filteredClasses = val ? state.classes.filter(c => gradeFromClassName(c.name) === parseInt(val)) : state.classes;
      const studentSelectEl = document.getElementById('student-select-self');
      UI.renderStudentSelect(filteredClasses, studentSelectEl);
      if (filteredClasses.length === 0 || filteredClasses.every(c => c.students.length === 0)) {
        studentSelectEl.innerHTML = '<option value="" disabled selected>Ученики не найдены</option>';
      }
    });

    // Modal
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') UI.hideModal();
    });
    document.getElementById('btn-cancel-modal')?.addEventListener('click', UI.hideModal);
    document.getElementById('btn-cancel-modal-2')?.addEventListener('click', UI.hideModal);
    document.getElementById('modal-chart')?.addEventListener('click', e => {
      if (e.target.id === 'modal-chart') closeChart();
    });
    document.getElementById('modal-add-text')?.addEventListener('click', e => {
      if (e.target.id === 'modal-add-text') closeAddTextModal();
    });
    document.getElementById('btn-cancel-chart')?.addEventListener('click', closeChart);
    
    // Manual entry modal
    document.getElementById('btn-manual-entry')?.addEventListener('click', openManualEntry);
    document.getElementById('btn-cancel-manual')?.addEventListener('click', closeManualEntry);
    document.getElementById('btn-cancel-manual-2')?.addEventListener('click', closeManualEntry);
    document.getElementById('btn-save-manual')?.addEventListener('click', saveManualEntry);
    document.getElementById('modal-manual-entry')?.addEventListener('click', e => {
      if (e.target.id === 'modal-manual-entry') closeManualEntry();
    });

    document.getElementById('modal-questions')?.addEventListener('click', e => {
      const btn = e.target.closest('.btn-answer');
      if (btn) handleAnswerBtn(btn);
    });
    document.getElementById('btn-save-result')?.addEventListener('click', saveResult);
    document.getElementById('btn-cancel-modal')?.addEventListener('click', UI.hideModal);

    // Statistics
    document.getElementById('btn-export-csv')?.addEventListener('click', () => {
      Assessment.exportCSV(state.lastFilteredResults);
    });
    document.getElementById('btn-go-check')?.addEventListener('click',   () => switchTab('check'));
    document.getElementById('stats-filter-class')?.addEventListener('change', () => {
      updateStatsFilters();
      renderStats();
    });
    document.getElementById('stats-filter-student')?.addEventListener('change', renderStats);

    // Journal specific events
    document.getElementById('stats-select-all')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const isChecked = e.target.checked;
      state.lastFilteredResults.forEach(r => {
        if (isChecked) {
          state.selectedResults.add(String(r.id));
        } else {
          state.selectedResults.delete(String(r.id));
        }
      });
      renderStats();
    });

    document.querySelector('[data-action="print-cards"]')?.addEventListener('click', () => {
      if (state.selectedResults.size === 0) return;
      const resultsToPrint = Assessment.getResults().filter(r => state.selectedResults.has(String(r.id)));
      UI.renderPrintJournalCards(resultsToPrint);
      
      document.body.classList.add('print-landscape');
      const landscapeStyle = document.createElement('style');
      landscapeStyle.id = 'print-landscape-style';
      landscapeStyle.textContent = '@media print { @page { size: landscape !important; margin: 15mm; } }';
      document.head.appendChild(landscapeStyle);
      
      window.print();
    });

    document.getElementById('btn-print-single-card')?.addEventListener('click', (e) => {
      const rid = e.target.dataset.rid;
      if (!rid) return;
      const result = Assessment.getResults().find(r => String(r.id) === rid);
      if (result) {
        UI.renderPrintJournalCards([result]);
        
        document.body.classList.add('print-landscape');
        const landscapeStyle = document.createElement('style');
        landscapeStyle.id = 'print-landscape-style';
        landscapeStyle.textContent = '@media print { @page { size: landscape !important; margin: 15mm; } }';
        document.head.appendChild(landscapeStyle);
        
        window.print();
      }
    });

    document.getElementById('btn-close-student-card')?.addEventListener('click', () => {
      document.getElementById('student-card-modal')?.close();
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  async function init() {
    loadClasses();
    await loadTexts();
    updateStatsFilters();
    bindEvents();

    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;
        
        e.preventDefault();
        const startBtn = document.getElementById(`btn-start-${state.checkMode}`);
        const stopBtn = document.getElementById(`btn-stop-${state.checkMode}`);

        if (state.checkState === 'setup' && startBtn && !startBtn.disabled) {
          startBtn.click();
        } else if (state.checkState === 'reading' && stopBtn && !stopBtn.disabled) {
          stopBtn.click();
        }
      }
    });

    switchTab('students');
  }

  return { init, switchTab };
})();

document.addEventListener('DOMContentLoaded', App.init);

