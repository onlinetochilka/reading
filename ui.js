'use strict';

/**
 * UI module — pure rendering helpers, modal control, toast notifications.
 * Depends on: Assessment (for norm comparison colours).
 * Exposed globally as window.UI.
 */
const UI = (() => {

  const LOGO = 'https://raw.githubusercontent.com/onlinetochilka/theme/main/tochilka-logo.svg';

  // ── Helpers ───────────────────────────────────────────────────────────────

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str ?? '')));
    return d.innerHTML;
  }

  function show(el) { if (el) el.style.display = ''; }
  function hide(el) { if (el) el.style.display = 'none'; }
  function showFlex(el) { if (el) el.style.display = 'flex'; }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(message, type = 'success') {
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = message;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('toast--visible')));
    setTimeout(() => {
      t.classList.remove('toast--visible');
      setTimeout(() => t.remove(), 350);
    }, 2800);
  }

  // ── Empty State ───────────────────────────────────────────────────────────

  function emptyState(title, subtitle, actionLabel, actionCb) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <img src="${LOGO}" alt="Точилка" class="empty-logo" />
      <h3 class="empty-title">${escapeHtml(title)}</h3>
      <p class="empty-sub">${escapeHtml(subtitle)}</p>
      ${actionLabel ? `<button class="btn btn--primary empty-action">${escapeHtml(actionLabel)}</button>` : ''}
    `;
    if (actionLabel && actionCb) {
      div.querySelector('.empty-action').addEventListener('click', actionCb);
    }
    return div;
  }

  // ── Base Tab ──────────────────────────────────────────────────────────────

  function renderClasses(classes, container, { onDelete } = {}) {
    container.innerHTML = '';
    if (!classes.length) {
      container.appendChild(emptyState(
        'Классов пока нет',
        'Создайте первый класс, чтобы начать работу',
      ));
      return;
    }

    classes.forEach(cls => {
      const card = document.createElement('div');
      card.className = 'class-card card';
      card.innerHTML = `
        <div class="class-card__header">
          <div class="class-card__info">
            <h3 class="class-card__name">${escapeHtml(cls.name)}</h3>
            <span class="badge">${cls.students.length} уч.</span>
          </div>
          <button class="btn-icon btn--danger" data-class-id="${cls.id}" title="Удалить класс" aria-label="Удалить">
            <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-2 7a1 1 0 012 0v4a1 1 0 11-2 0V9zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          </button>
        </div>
        <div class="class-card__students">
          ${cls.students.map((s, i) => `<span class="student-chip">${i + 1}. ${escapeHtml(s.name)}</span>`).join('')}
        </div>
      `;
      if (onDelete) {
        card.querySelector('.btn-icon').addEventListener('click', e => {
          onDelete(e.currentTarget.dataset.classId);
        });
      }
      container.appendChild(card);
    });
  }

  // ── Selects ───────────────────────────────────────────────────────────────

  function renderStudentSelect(classes, selectEl) {
    selectEl.innerHTML = '<option value="">— Выберите ученика —</option>';
    classes.forEach(cls => {
      const group = document.createElement('optgroup');
      group.label = cls.name;
      cls.students.forEach(s => {
        const opt = document.createElement('option');
        opt.value = `${cls.id}::${s.id}`;
        opt.textContent = s.name;
        group.appendChild(opt);
      });
      selectEl.appendChild(group);
    });
  }

  function renderTextSelect(texts, selectEl) {
    selectEl.innerHTML = '<option value="">— Выберите текст —</option>';
    texts.forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = `${t.title} · ${t.grade} кл. · ~${t.words} сл.`;
      selectEl.appendChild(opt);
    });
  }

  // ── Text Display ──────────────────────────────────────────────────────────

  /**
   * Render text into container, wrapping each word in a <span class="word">.
   * @param {object}  textData
   * @param {Element} container
   * @param {object}  opts
   * @param {boolean} opts.clickable  - add word--clickable class
   * @param {boolean} opts.large      - add text-display--large class
   */
  function renderTextForReading(textData, container, { clickable = false, large = false } = {}) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = `text-display${large ? ' text-display--large' : ''}`;

    let wordIdx = 0;
    // Split preserving whitespace tokens
    const tokens = textData.content.split(/(\s+)/);
    tokens.forEach(token => {
      if (/^\s+$/.test(token)) {
        wrap.appendChild(document.createTextNode(token));
      } else {
        const span = document.createElement('span');
        span.className = 'word' + (clickable ? ' word--clickable' : '');
        span.dataset.index = wordIdx++;
        span.textContent = token;
        wrap.appendChild(span);
      }
    });

    container.appendChild(wrap);
  }

  /** Highlight all words up to (and including) the given index. */
  function highlightWordsUpTo(container, index) {
    container.querySelectorAll('.word').forEach(w => {
      w.classList.toggle('word--selected', parseInt(w.dataset.index) <= index);
    });
  }

  /** Clear word selections. */
  function clearWordSelection(container) {
    container.querySelectorAll('.word').forEach(w => w.classList.remove('word--selected'));
  }

  // ── Statistics Table ──────────────────────────────────────────────────────

  function renderStatistics(results) {
    const emptyEl   = document.getElementById('stats-empty');
    const wrapperEl = document.getElementById('stats-table-wrapper');
    const tbody     = document.querySelector('#stats-table tbody');

    if (!results.length) {
      if (emptyEl)   { emptyEl.style.display = 'flex'; }
      if (wrapperEl) hide(wrapperEl);
      return;
    }

    if (emptyEl)   hide(emptyEl);
    if (wrapperEl) show(wrapperEl);

    tbody.innerHTML = '';

    const sorted = [...results].sort((a, b) => new Date(b.date) - new Date(a.date));

    sorted.forEach(r => {
      const tr   = document.createElement('tr');
      const date = new Date(r.date).toLocaleDateString('ru-RU');

      const totalErrors =
        (r.errors?.distortion || 0) +
        (r.errors?.accent     || 0) +
        (r.errors?.ending     || 0) +
        (r.errors?.regression || 0) +
        (r.errors?.syllabic   || 0);

      const normResult = r.grade ? Assessment.compareWithNorm(r.wpm, r.grade) : 'unknown';
      const wpmClass   =
        normResult === 'above'  ? 'wpm--above'  :
        normResult === 'below'  ? 'wpm--below'  :
        normResult === 'normal' ? 'wpm--normal' : '';

      const comp = Array.isArray(r.comprehension) && r.comprehension.length
        ? `${r.comprehension.filter(c => c.correct).length} / ${r.comprehension.length}`
        : '—';

      const modeLabel = r.mode === 'self' ? '<span class="badge badge--self">Экран</span>' : '<span class="badge badge--teacher">Бумага</span>';

      tr.innerHTML = `
        <td>${date}</td>
        <td>
          ${escapeHtml(r.studentName || '—')}
          ${r.studentId ? `<button class="btn-icon btn--ghost btn-chart" style="width:24px;height:24px;margin-left:4px;font-size:12px;" data-student-id="${r.studentId}" data-student-name="${escapeHtml(r.studentName || '')}" title="График динамики">📈</button>` : ''}
        </td>
        <td>${escapeHtml(r.className  || '—')}</td>
        <td>${escapeHtml(r.textTitle  || '—')}</td>
        <td class="wpm-cell ${wpmClass}">${r.wpm || 0}</td>
        <td>${totalErrors > 0 ? totalErrors : '—'}</td>
        <td>${comp}</td>
        <td>${modeLabel}</td>
        <td>
          <button class="btn-icon btn--danger btn-del-result" data-rid="${r.id}" title="Удалить">
            <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-2 7a1 1 0 012 0v4a1 1 0 11-2 0V9zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ── Modal ─────────────────────────────────────────────────────────────────

  /**
   * Open the post-analysis modal.
   * @param {object}   session  - current session state
   * @param {object[]} texts    - loaded texts array
   */
  function showModal(session, texts) {
    const overlay  = document.getElementById('modal-overlay');
    const textData = texts.find(t => t.id === session.textId);

    // Header info
    document.getElementById('modal-student').textContent    = session.studentName || 'Самопроверка';
    document.getElementById('modal-text-title').textContent = textData?.title ?? (session.textId || '—');
    document.getElementById('modal-elapsed').textContent    = Timer.formatTime(session.elapsed);

    // WPM block — teacher: pre-calculated; self: input
    const wpmDisplay = document.getElementById('modal-wpm-display');
    const wpmInput   = document.getElementById('modal-wpm-input-section');

    if (session.mode === 'teacher') {
      document.getElementById('modal-wpm-value').textContent   = session.wpm || 0;
      document.getElementById('modal-words-value').textContent = session.wordCount || 0;
      document.getElementById('modal-time-value').textContent  = Timer.formatTime(session.elapsed);
      show(wpmDisplay);
      hide(wpmInput);
    } else {
      hide(wpmDisplay);
      show(wpmInput);
      const inp = document.getElementById('modal-words-input');
      if (inp) inp.value = '';
    }

    // Teacher-only expressiveness section
    const teacherSection = document.getElementById('modal-teacher-section');
    if (session.mode === 'teacher') {
      show(teacherSection);
    } else {
      hide(teacherSection);
    }

    // Comprehension questions
    const qContainer = document.getElementById('modal-questions');
    qContainer.innerHTML = '';

    if (textData?.questions?.length) {
      // Initialise comprehension array if needed
      if (!session.comprehension) session.comprehension = [];

      textData.questions.forEach((q, i) => {
        const row = document.createElement('div');
        row.className = 'question-row';
        const cur = session.comprehension[i];
        row.innerHTML = `
          <span class="question-text">${i + 1}. ${escapeHtml(q.q)}</span>
          <div class="question-btns">
            <button class="btn-answer btn-yes${cur?.correct === true  ? ' active' : ''}" data-qi="${i}" data-ans="true"  title="Верно">👍</button>
            <button class="btn-answer btn-no ${cur?.correct === false ? ' active' : ''}" data-qi="${i}" data-ans="false" title="Неверно">👎</button>
          </div>
        `;
        qContainer.appendChild(row);
      });
    } else {
      qContainer.innerHTML = '<p class="muted">Вопросы для этого текста не заданы.</p>';
    }

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function hideModal() {
    document.getElementById('modal-overlay').classList.add('hidden');
    document.body.style.overflow = '';
  }

  // ── Print Preview (clean — no word markers) ──────────────────────────────

  /**
   * Render a clean print-ready preview.
   * The #print-content element is the only thing shown when window.print() is called.
   */
  function renderPrintPreview(textData, container) {
    container.innerHTML = '';
    if (!textData) return;

    container.innerHTML = `
      <div class="print-preview card">
        <div class="print-body-inner">
          <h2 class="print-title">${escapeHtml(textData.title)}</h2>
          <p class="print-meta">${textData.grade} класс &nbsp;·&nbsp; ~${textData.words} слов</p>
          <div class="print-text">${escapeHtml(textData.content)}</div>
          <div class="print-footer">
            <div class="print-footer__field">
              <span class="print-label">Ученик</span>
              <span class="print-line"></span>
            </div>
            <div class="print-footer__field">
              <span class="print-label">Дата</span>
              <span class="print-line print-line--short"></span>
            </div>
            <div class="print-footer__field">
              <span class="print-label">Слов/мин</span>
              <span class="print-line print-line--short"></span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ── Student List for Check Column ─────────────────────────────────────────

  /**
   * Render the student list in the left check column.
   * @param {object|null} cls              - class object
   * @param {string|null} currentStudentId - id of selected student
   * @param {Element}     container
   * @param {Element}     labelEl          - the h4 label element to update
   */
  function renderStudentListForCheck(cls, currentStudentId, container, labelEl) {
    container.innerHTML = '';
    if (!cls) {
      container.innerHTML = '<p class="muted" style="font-size:0.8rem;padding:4px 0">Выберите ученика</p>';
      if (labelEl) labelEl.textContent = 'Список класса';
      return;
    }
    if (labelEl) labelEl.textContent = cls.name;
    cls.students.forEach(s => {
      const el = document.createElement('div');
      el.className = 'student-check-item' + (s.id === currentStudentId ? ' current' : '');
      el.textContent = s.name;
      container.appendChild(el);
    });
  }

  // ── Library List ──────────────────────────────────────────────────────────

  function renderLibraryList(texts, container, onPrintClick) {
    container.innerHTML = '';
    texts.forEach(t => {
      const card = document.createElement('div');
      card.className = 'card';
      card.style.display = 'flex';
      card.style.justifyContent = 'space-between';
      card.style.alignItems = 'center';
      card.innerHTML = `
        <div>
          <h3 style="margin-bottom:4px">${escapeHtml(t.title)}</h3>
          <p class="muted">${t.grade} класс · ~${t.words} слов</p>
        </div>
        <button class="btn btn--secondary btn-print-single" data-id="${t.id}">
          <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v5a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9a1 1 0 100 2 1 1 0 000-2zm10 0a1 1 0 100 2 1 1 0 000-2zm-8 3v-2h4v2H8z" clip-rule="evenodd"/></svg>
          Печать
        </button>
      `;
      if (onPrintClick) {
        card.querySelector('.btn-print-single').addEventListener('click', () => onPrintClick(t.id));
      }
      container.appendChild(card);
    });
  }

  return {
    escapeHtml,
    show, hide, showFlex,
    showToast,
    emptyState,
    renderClasses,
    renderStudentSelect,
    renderTextSelect,
    renderTextForReading,
    highlightWordsUpTo,
    clearWordSelection,
    renderStatistics,
    showModal,
    hideModal,
    renderPrintPreview,
    renderStudentListForCheck,
    renderLibraryList,
  };
})();
