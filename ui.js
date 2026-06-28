'use strict';

/**
 * UI module — pure rendering helpers, modal control, toast notifications.
 * Depends on: Assessment (for norm comparison colours).
 * Exposed globally as window.UI.
 */
const UI = (() => {

  const LOGO = 'https://raw.githubusercontent.com/onlinetochilka/theme/main/tochilka-logo.svg';

  // ── Utils ─────────────────────────────────────────────────────────────────

  function formatWordsCount(n) {
    if (n == null) n = 0;
    let count = Math.abs(n);
    let n10 = count % 10;
    let n100 = count % 100;
    let word = 'слов';
    if (n10 === 1 && n100 !== 11) word = 'слово';
    else if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) word = 'слова';
    return `${n} ${word}`;
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(String(str ?? '')));
    return d.innerHTML;
  }

  function show(el) { if (el) el.style.display = ''; }
  function hide(el) { if (el) el.style.display = 'none'; }
  function showFlex(el) { if (el) el.style.display = 'flex'; }

  // ── Toast ─────────────────────────────────────────────────────────────────

  function showToast(message, type = 'success', undoCallback = null) {
    const t = document.createElement('div');
    t.className = `toast toast--${type}`;
    t.textContent = message;
    if (undoCallback) {
      const btn = document.createElement('button');
      btn.className = 'toast-undo-btn';
      btn.textContent = 'Отменить';
      btn.onclick = () => { undoCallback(); t.remove(); };
      t.appendChild(btn);
    }
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('toast--visible')));
    setTimeout(() => {
      t.classList.remove('toast--visible');
      setTimeout(() => t.remove(), 350);
    }, undoCallback ? 5000 : 2800);
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

  function getStudentDeclension(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod100 >= 11 && mod100 <= 19) return count + ' учеников';
    if (mod10 === 1) return count + ' ученик';
    if (mod10 >= 2 && mod10 <= 4) return count + ' ученика';
    return count + ' учеников';
  }

  function renderClasses(classes, container, { onDeleteClass, onDeleteStudent, onAddStudent, onEditClass, onMoveStudent } = {}) {
    container.innerHTML = '';
    if (classes.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48" style="opacity:0.4;margin-bottom:12px;">
            <path d="M12 4v16m8-8H4"></path>
          </svg>
          <p>Нет классов. Создайте свой первый класс!</p>
        </div>`;
      return;
    }

    classes.forEach(cls => {
      const card = document.createElement('div');
      card.className = 'class-card card';
      card.innerHTML = `
        <div class="class-card__header">
          <div class="class-card__info">
            <h3 class="class-card__name">${escapeHtml(cls.name)}</h3>
            <span class="badge">${getStudentDeclension(cls.students.length)}</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="btn-icon btn--ghost" data-action="edit-class" data-class-id="${cls.id}" title="Переименовать класс" aria-label="Переименовать класс">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/></svg>
            </button>
            <button class="btn-icon btn--ghost" data-action="add-student" data-class-id="${cls.id}" title="Добавить ученика" aria-label="Добавить ученика">
              <svg viewBox="0 0 20 20" fill="currentColor" width="18" height="18"><path fill-rule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clip-rule="evenodd"/></svg>
            </button>
            <button class="btn-icon btn--danger" data-action="delete-class" data-class-id="${cls.id}" title="Удалить класс" aria-label="Удалить">
              <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zm-2 7a1 1 0 012 0v4a1 1 0 11-2 0V9zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V9a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
            </button>
          </div>
        </div>
        <div class="class-card__students">
          ${cls.students.map((s, i) => `
            <div class="student-list-item" tabindex="0">
              <span class="student-list-item__name">${i + 1}. ${escapeHtml(s.name)}</span>
              <div style="display: flex; gap: 6px;">
                <button class="btn-icon btn--ghost btn-move-student" data-action="move-student" data-class-id="${cls.id}" data-student-id="${s.id}" title="Перевести в другой класс" style="width: 24px; height: 24px; font-size: 10px;">
                  <svg viewBox="0 0 20 20" fill="currentColor" width="14" height="14"><path d="M8 5a1 1 0 100 2h5.586l-1.293 1.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L13.586 5H8zM12 15a1 1 0 100-2H6.414l1.293-1.293a1 1 0 10-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L6.414 15H12z"/></svg>
                </button>
                <button class="btn-del-student" data-action="delete-student" data-class-id="${cls.id}" data-student-id="${s.id}" title="Удалить ученика" style="width: 24px; height: 24px;">×</button>
              </div>
            </div>`).join('')}
        </div>
      `;
      if (onDeleteClass) {
        card.querySelector('.btn--danger').addEventListener('click', e => {
          onDeleteClass(e.currentTarget.dataset.classId);
        });
      }
      if (onEditClass) {
        card.querySelector('.btn-icon[data-action="edit-class"]').addEventListener('click', e => {
          onEditClass(e.currentTarget.dataset.classId);
        });
      }
      if (onDeleteStudent) {
        card.querySelectorAll('.btn-del-student').forEach(btn => {
          btn.addEventListener('click', e => {
            onDeleteStudent(e.currentTarget.dataset.classId, e.currentTarget.dataset.studentId);
          });
        });
      }
      if (onMoveStudent) {
        card.querySelectorAll('.btn-move-student').forEach(btn => {
          btn.addEventListener('click', e => {
            onMoveStudent(e.currentTarget.dataset.classId, e.currentTarget.dataset.studentId);
          });
        });
      }
      if (onAddStudent) {
        card.querySelector('.btn-icon[data-action="add-student"]').addEventListener('click', e => {
          onAddStudent(e.currentTarget.dataset.classId);
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

    // Render questions if available
    if (textData.questions && textData.questions.length > 0) {
      const qContainer = document.createElement('div');
      qContainer.className = 'text-questions-container';
      qContainer.style.marginTop = '24px';
      qContainer.style.paddingTop = '16px';
      qContainer.style.borderTop = '2px dashed #e2e8f0';

      const qTitle = document.createElement('h3');
      qTitle.textContent = 'Вопросы по тексту:';
      qTitle.style.fontSize = '1.1rem';
      qTitle.style.marginBottom = '12px';
      qTitle.style.color = 'var(--blue)';
      qContainer.appendChild(qTitle);

      textData.questions.forEach((q, i) => {
        const qBlock = document.createElement('div');
        qBlock.style.marginBottom = '12px';
        qBlock.style.background = '#f8fafc';
        qBlock.style.padding = '12px';
        qBlock.style.borderRadius = '8px';
        qBlock.style.border = '1px solid #e2e8f0';

        const qText = document.createElement('div');
        qText.style.fontWeight = '500';
        qText.style.color = '#334155';
        qText.textContent = `${i + 1}. ${q.q}`;
        qBlock.appendChild(qText);

        if (q.a) {
          const btn = document.createElement('button');
          btn.className = 'btn btn--ghost btn--small';
          btn.textContent = 'Показать ответ';
          btn.style.marginTop = '8px';
          btn.style.fontSize = '0.8rem';
          btn.style.padding = '4px 8px';

          const ansText = document.createElement('div');
          ansText.style.opacity = '0.7';
          ansText.style.fontStyle = 'italic';
          ansText.style.fontSize = '0.85rem';
          ansText.style.marginTop = '8px';
          ansText.style.display = 'none';
          ansText.style.transition = 'all 0.3s ease';
          ansText.textContent = q.a;

          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (ansText.style.display === 'none') {
              ansText.style.display = 'block';
              btn.textContent = 'Скрыть ответ';
            } else {
              ansText.style.display = 'none';
              btn.textContent = 'Показать ответ';
            }
          });

          qBlock.appendChild(btn);
          qBlock.appendChild(ansText);
        }

        qContainer.appendChild(qBlock);
      });

      container.appendChild(qContainer);
    }
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

  function renderStatistics(results, selectedSet = new Set()) {
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
      tr.style.cursor = 'pointer'; // Make row clickable for modal
      tr.dataset.rid = r.id;       // Add ID to row for easy access
      
      const date = new Date(r.date).toLocaleDateString('ru-RU');

      const totalErrors =
        (r.errors?.distortion || 0) +
        (r.errors?.accent     || 0) +
        (r.errors?.ending     || 0) +
        (r.errors?.regression || 0);

      const normResult = r.grade ? Assessment.compareWithNorm(r.wpm, r.grade, r.date) : 'unknown';
      const statusClass = normResult === 'above' ? 'status-high' :
                          normResult === 'normal' ? 'status-ok' :
                          normResult === 'below' ? 'status-low' : '';

      const comp = r.comprehensionScore ? r.comprehensionScore :
                   Array.isArray(r.comprehension) && r.comprehension.length
                     ? `${r.comprehension.filter(c => c.correct).length} / ${r.comprehension.length}`
                     : '—';

      const modeLabel = r.mode === 'self' ? '<span class="badge badge--self">Экран</span>' : '<span class="badge badge--teacher">Бумага</span>';

      tr.innerHTML = `
        <td style="text-align: center;">
          <input type="checkbox" class="row-checkbox" value="${r.id}" ${selectedSet.has(String(r.id)) ? 'checked' : ''}>
        </td>
        <td>${date}</td>
        <td>${escapeHtml(r.studentName || '—')}</td>
        <td style="text-align: center;">
          ${r.studentId ? `<button class="btn-icon btn--ghost btn-chart" style="width:24px;height:24px;font-size:14px;color:var(--blue);" data-student-id="${r.studentId}" data-student-name="${escapeHtml(r.studentName || '')}" title="График динамики">📈</button>` : ''}
        </td>
        <td>${escapeHtml(r.className  || '—')}</td>
        <td>${escapeHtml(r.textTitle  || '—')}</td>
        <td class="wpm-cell">
          <div style="display:flex; align-items:center; gap:6px;">
            ${r.wpm || 0}
          </div>
        </td>
        <td style="text-align: center;">
          ${statusClass ? `<span class="status-dot ${statusClass}"></span>` : '—'}
        </td>
        <td>${totalErrors > 0 ? totalErrors : '—'}</td>
        <td>${comp}</td>
        <td style="text-align: center;">
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

    // WPM block
    const wpmDisplay = document.getElementById('modal-wpm-display');
    document.getElementById('modal-wpm-value').textContent   = session.wpm || 0;
    document.getElementById('modal-words-value').textContent = session.wordCount || 0;
    document.getElementById('modal-time-value').textContent  = Timer.formatTime(session.elapsed);
    show(wpmDisplay);

    // summarySection has been removed

    // Reset errors if they exist in UI
    ['distortion','accent','regression'].forEach(k => {
      const el = document.getElementById(`counter-${k}-modal`);
      if (el) el.textContent = session.errors?.[k] || 0;
    });

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
        row.style.display = 'flex';
        row.style.justifyContent = 'space-between';
        row.style.alignItems = 'center';
        row.style.marginBottom = '8px';
        row.style.gap = '12px';
        row.innerHTML = `
          <span class="question-text" style="flex:1; font-size:0.9rem; line-height:1.3;">
            ${i + 1}. ${escapeHtml(q.q)} 
            ${q.a ? `<span style="opacity:0.7; font-style:italic; font-size:0.85rem;"><br>${escapeHtml(q.a)}</span>` : ''}
          </span>
          <div class="question-btns" style="display:flex; gap:8px; flex-shrink:0;">
            <button class="btn-answer btn-yes${cur?.correct === true  ? ' active' : ''}" data-action="answer-yes" data-qi="${i}" data-ans="true"  title="Верно">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button class="btn-answer btn-no ${cur?.correct === false ? ' active' : ''}" data-action="answer-no" data-qi="${i}" data-ans="false" title="Неверно">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="20" height="20" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
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
          <div class="print-text" style="white-space: pre-wrap;">${escapeHtml(textData.content)}</div>
        </div>
      </div>
    `;
  }

  function renderPrintBlank(container) {
    container.innerHTML = `
      <div class="print-preview card" style="max-width: 100%; margin: 0; padding: 0;">
        <div style="padding: 0 !important; font-family: 'Inter', system-ui, sans-serif !important; color: #1e293b !important; display: block !important;">
          
          <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom: 32px;">
            <div style="flex: 1;">
              <div style="display:flex; align-items:center; gap: 16px; margin-bottom: 24px;">
                <img src="${LOGO}" alt="Точилка" style="width: 48px; height: 48px;" />
                <h2 class="print-title" style="margin: 0; font-size: 22pt !important; font-family: 'Inter', system-ui, sans-serif !important; font-weight: 700; color: var(--blue, #1b3a6b) !important; letter-spacing: -0.5px;">Бланк проверки техники чтения</h2>
              </div>
              <div style="display:flex; gap: 48px;">
                <div style="display:flex; align-items:baseline; width: 240px;">
                  <span style="font-weight: 600; color: #64748b; margin-right: 12px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px;">Класс</span>
                  <div style="border-bottom: 2px solid #e2e8f0; flex: 1;"></div>
                </div>
                <div style="display:flex; align-items:baseline; width: 240px;">
                  <span style="font-weight: 600; color: #64748b; margin-right: 12px; font-size: 11pt; text-transform: uppercase; letter-spacing: 0.5px;">Дата</span>
                  <div style="border-bottom: 2px solid #e2e8f0; flex: 1;"></div>
                </div>
              </div>
            </div>
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 11pt; font-family: 'Inter', system-ui, sans-serif !important;">
            <thead>
              <tr>
                <th style="border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 14px 16px; width: 40%; text-align: left; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; background: #f8fafc;">ФИО ученика</th>
                <th style="border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 14px 16px; width: 12%; text-align: center; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; background: #f8fafc;">Сл/мин</th>
                <th style="border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 14px 16px; width: 18%; text-align: center; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; background: #f8fafc;">Ошибки</th>
                <th style="border: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; padding: 14px 16px; width: 30%; text-align: left; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 9pt; letter-spacing: 0.5px; background: #f8fafc;">Осознанность / Выразительность</th>
              </tr>
            </thead>
            <tbody>
              ${Array(18).fill('<tr><td style="border: 1px solid #cbd5e1; height: 44px;"></td><td style="border: 1px solid #cbd5e1;"></td><td style="border: 1px solid #cbd5e1;"></td><td style="border: 1px solid #cbd5e1;"></td></tr>').join('')}
            </tbody>
          </table>

        </div>
      </div>
    `;
  }

  // ── Student List for Check Column ─────────────────────────────────────────

  /**
   * Render the student list in the left check column as Accordions.
   * @param {Array}       classes          - all classes array
   * @param {string|null} currentStudentId - id of selected student
   * @param {Element}     container
   * @param {Function}    onSelect         - callback when student is selected
   */
  function renderStudentListForCheck(classes, currentStudentId, container, onSelect) {
    container.innerHTML = '';
    if (!classes || !classes.length) {
      container.innerHTML = '<p class="muted" style="font-size:0.8rem;padding:4px 0">Создайте класс на вкладке «Ученики»</p>';
      return;
    }
    
    classes.forEach((cls, idx) => {
      const item = document.createElement('div');
      item.className = 'accordion-item';
      
      const isSelectedClass = cls.students.some(s => s.id === currentStudentId);
      // Open first class by default if none selected, or open the selected one
      const isOpen = isSelectedClass || (!currentStudentId && idx === 0);
      if (isOpen) item.classList.add('open');
      
      item.innerHTML = `
        <div class="accordion-header" data-action="toggle-accordion" tabindex="0">
          <span>${escapeHtml(cls.name)}</span>
          <svg class="chevron" viewBox="0 0 20 20" fill="currentColor" width="16" height="16" style="transition:transform 0.3s; transform: rotate(${isOpen ? '180deg' : '0deg'})"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </div>
        <div class="accordion-content">
          ${cls.students.map(s => `
            <div class="student-check-item ${s.id === currentStudentId ? 'current' : ''}" data-action="select-student" data-class-id="${cls.id}" data-student-id="${s.id}" tabindex="0">
              ${escapeHtml(s.name)}
            </div>
          `).join('')}
        </div>
      `;
      
      item.querySelector('.accordion-header').addEventListener('click', (e) => {
        const currentlyOpen = item.classList.contains('open');
        // Close all
        container.querySelectorAll('.accordion-item').forEach(i => {
          i.classList.remove('open');
          i.querySelector('.chevron').style.transform = 'rotate(0deg)';
        });
        if (!currentlyOpen) {
          item.classList.add('open');
          item.querySelector('.chevron').style.transform = 'rotate(180deg)';
        }
      });
      
      if (onSelect) {
        item.querySelectorAll('.student-check-item').forEach(el => {
          el.addEventListener('click', () => {
            onSelect(el.dataset.classId, el.dataset.studentId);
            // Visual update
            container.querySelectorAll('.student-check-item').forEach(i => i.classList.remove('current'));
            el.classList.add('current');
          });
        });
      }
      
      container.appendChild(item);
    });
  }

  // ── Student Card Dialog (Journal) ─────────────────────────────────────────

  let modalChartInstance = null;

  function showStudentCardModal(result) {
    const dialog = document.getElementById('student-card-modal');
    if (!dialog) return;
    
    document.getElementById('student-card-name').textContent = result.studentName || 'Неизвестный ученик';
    document.getElementById('student-card-wpm').textContent = result.wpm || 0;
    
    const textInfo = document.getElementById('student-card-text-info');
    if (textInfo) {
      if (result.textTitle && result.wordCount) {
        textInfo.textContent = `«${result.textTitle}» · ${result.wordCount} слов`;
      } else {
        textInfo.textContent = '';
      }
    }
    
    let statusClass = '';
    const norm = Assessment.getNorm(result.grade, result.date);
    if (norm) {
      statusClass = (result.wpm >= norm.min) ? 'status-ok' : 'status-low';
      document.getElementById('student-card-norm-text').textContent = `Норма: ${norm.min}-${norm.good} сл/мин`;
    } else {
      document.getElementById('student-card-norm-text').textContent = 'Норма не задана';
    }
    const statusDot = document.getElementById('student-card-status');
    statusDot.className = 'status-dot'; // reset
    if (statusClass) statusDot.classList.add(statusClass);

    const errorsList = document.getElementById('student-card-errors');
    errorsList.innerHTML = '';
    
    const errors = [];
    if (result.errors?.distortion) errors.push(`Искажения: ${result.errors.distortion}`);
    if (result.errors?.accent) errors.push(`Неверные ударения: ${result.errors.accent}`);
    if (result.errors?.ending) errors.push(`Ошибки в окончаниях: ${result.errors.ending}`);
    if (result.errors?.regression) errors.push(`Повторы: ${result.errors.regression}`);
    
    if (errors.length === 0) {
      errorsList.innerHTML = '<li>Технических ошибок не зафиксировано</li>';
    } else {
      errors.forEach(e => {
        const li = document.createElement('li');
        li.textContent = e;
        errorsList.appendChild(li);
      });
    }

    let comp = '—';
    if (Array.isArray(result.comprehension) && result.comprehension.length) {
      comp = `${result.comprehension.filter(c => c.correct).length} из ${result.comprehension.length}`;
    } else if (result.comprehensionScore && typeof result.comprehensionScore === 'object') {
      comp = `${result.comprehensionScore.correct} из ${result.comprehensionScore.total}`;
    } else if (result.comprehensionScore !== undefined) {
      comp = String(result.comprehensionScore);
    }
    document.getElementById('student-card-comp').textContent = comp;
    
    document.getElementById('student-card-method').textContent = result.readingMethod || 'Целыми словами';
    
    const expText = result.expressiveness?.monotone ? 'Монотонно' : 
                    result.expressiveness?.ignoreSigns ? 'Игнорирует знаки препинания' : '—';
    document.getElementById('student-card-expressiveness').textContent = expText;
    
    // Store result id on the print button for single card printing
    document.getElementById('btn-print-single-card').dataset.rid = result.id;

    // Render Progress Chart
    const chartContainer = document.querySelector('.student-card-chart-container');
    const ctx = document.getElementById('student-card-chart');
    if (modalChartInstance) {
      modalChartInstance.destroy();
    }
    
    const allResults = Assessment.getResults()
      .filter(r => r.studentId === result.studentId)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
      
    if (allResults.length >= 2 && ctx) {
      chartContainer.style.display = 'block';
      const labels = allResults.map(r => new Date(r.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
      const wpmData = allResults.map(r => r.wpm || 0);
      
      modalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Сл/мин',
            data: wpmData,
            borderColor: '#2952A3',
            backgroundColor: 'rgba(41, 82, 163, 0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 4,
            borderWidth: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true } }
        }
      });
    } else if (chartContainer) {
      chartContainer.style.display = 'none';
    }

    dialog.showModal();

    // Light-dismiss logic
    dialog.addEventListener('click', function onClickOutside(e) {
      const rect = dialog.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || 
          e.clientY < rect.top || e.clientY > rect.bottom) {
        dialog.close();
        dialog.removeEventListener('click', onClickOutside);
      }
    });
  }

  function renderPrintJournalCards(results) {
    const container = document.getElementById('print-container');
    if (!container) return;
    
    const wrapper = document.getElementById('print-content-wrapper');
    if (wrapper) wrapper.innerHTML = '';
    
    container.innerHTML = '<div class="print-cards-grid"></div>';
    const grid = container.querySelector('.print-cards-grid');
    
    results.forEach((r, index) => {
      const card = document.createElement('div');
      card.className = 'print-card';
      
      const errorsList = [];
      if (r.errors?.distortion) errorsList.push(`Искажения: ${r.errors.distortion}`);
      if (r.errors?.accent) errorsList.push(`Ударения: ${r.errors.accent}`);
      if (r.errors?.ending) errorsList.push(`Окончания: ${r.errors.ending}`);
      if (r.errors?.regression) errorsList.push(`Повторы: ${r.errors.regression}`);
      const errorsStr = errorsList.length > 0 ? errorsList.join(', ') : 'Ошибок нет';
      
      let comp = '—';
      if (Array.isArray(r.comprehension) && r.comprehension.length) {
        comp = `${r.comprehension.filter(c => c.correct).length} из ${r.comprehension.length}`;
      } else if (r.comprehensionScore && typeof r.comprehensionScore === 'object') {
        comp = `${r.comprehensionScore.correct} из ${r.comprehensionScore.total}`;
      } else if (r.comprehensionScore !== undefined) {
        comp = String(r.comprehensionScore);
      }

      const dateStr = new Date(r.date).toLocaleDateString('ru-RU');
      const norm = Assessment.getNorm(r.grade, r.date);
      let normHtml = '<div style="font-size: 10pt; color: #64748b; margin-top: 8px;">Норма не задана</div>';
      if (norm) {
        normHtml = `<div style="font-size: 10pt; color: #64748b; margin-top: 8px;">Норма:<br><span style="font-weight: 500;">${norm.min}-${norm.good} сл/мин</span></div>`;
      }
      
      let methodStr = r.readingMethod || 'Целыми словами';
      if (r.orthographicReading) {
        methodStr += '<br><span style="font-size:10pt; color:#64748b;">(орфографическое)</span>';
      }
      const expText = r.expressiveness?.monotone ? 'Монотонно' : 
                      r.expressiveness?.ignoreSigns ? 'Игнорирует знаки' : '—';

      const allResults = Assessment.getResults()
        .filter(hist => hist.studentId === r.studentId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const hasHistory = allResults.length >= 2;
      const chartId = `print-chart-${index}`;

      const textInfoStr = (r.textTitle && r.wordCount) ? `«${r.textTitle}» · ${formatWordsCount(r.wordCount)}` : '';

      card.innerHTML = `
        <div class="print-card-header">
          <div>
            <h2 class="print-card-name">${escapeHtml(r.studentName || '—')}</h2>
            ${textInfoStr ? `<div style="font-size: 14pt; color: #444; margin-top: 4px; font-weight: 500;">${textInfoStr}</div>` : ''}
          </div>
          <span class="print-card-date">${dateStr}</span>
        </div>
        <div class="print-card-body">
          <div class="print-card-speed-box">
            <div class="print-card-speed">${r.wpm || 0}</div>
            <div class="print-card-speed-label">сл/мин</div>
            ${normHtml}
          </div>
          <div class="print-card-stats">
            <div>
              <div class="print-card-section">Способ чтения</div>
              <div class="print-card-text" style="font-size:12pt;">${methodStr}</div>
            </div>
            <div>
              <div class="print-card-section">Выразительность</div>
              <div class="print-card-text" style="font-size:12pt;">${expText}</div>
            </div>
            <div>
              <div class="print-card-section">Ошибки</div>
              <div class="print-card-text" style="font-size:12pt;">${errorsStr}</div>
            </div>
            <div>
              <div class="print-card-section">Ответы на вопросы</div>
              <div class="print-card-text" style="font-size:12pt;">${comp}</div>
            </div>
          </div>
        </div>
        ${hasHistory ? `<div class="print-card-chart"><canvas id="${chartId}"></canvas></div>` : ''}
      `;
      grid.appendChild(card);
      
      if (hasHistory) {
        setTimeout(() => {
          const ctx = document.getElementById(chartId);
          if (ctx) {
            const labels = allResults.map(hist => new Date(hist.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }));
            const wpmData = allResults.map(hist => hist.wpm || 0);
            
            new Chart(ctx, {
              type: 'line',
              data: {
                labels,
                datasets: [{
                  label: 'Сл/мин',
                  data: wpmData,
                  borderColor: '#111',
                  backgroundColor: 'transparent',
                  tension: 0.3,
                  pointRadius: 3,
                  borderWidth: 2
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { display: false } },
                scales: { 
                  y: { beginAtZero: true, ticks: { font: { size: 10 } } },
                  x: { ticks: { font: { size: 10 } } }
                }
              }
            });
          }
        }, 0);
      }
    });
  }

  // ── Library List ──────────────────────────────────────────────────────────

  function renderLibraryList(texts, container, selectedIds = []) {
    container.innerHTML = '';
    
    if (!texts || !texts.length) {
      return;
    }

    texts.forEach(t => {
      const isChecked = selectedIds.includes(String(t.id)) || selectedIds.includes(t.id) ? 'checked' : '';
      const card = document.createElement('div');
      card.className = 'text-card';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding: 12px;">
          <div style="display:flex; align-items:center; gap: 12px;">
            <input type="checkbox" class="text-checkbox" value="${t.id}" ${isChecked} style="width:18px; height:18px; cursor:pointer;" />
            <div>
              <h3 style="margin-bottom:2px; font-size:1rem;">${escapeHtml(t.title)}</h3>
              <p class="muted" style="font-size:0.8rem">${t.grade} класс · ~${formatWordsCount(t.words || t.wordCount || 0)}</p>
            </div>
          </div>
          <svg class="chevron" viewBox="0 0 20 20" fill="currentColor" width="18" height="18" style="transition:transform 0.3s; color:var(--blue);"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        </div>
        <div class="accordion-content">
          <div style="padding: 0 14px 14px 44px; font-size:0.95rem; line-height:1.6; color:var(--blue); white-space: pre-wrap;">${escapeHtml(t.content)}</div>
        </div>
      `;
      
      const cb = card.querySelector('.text-checkbox');
      cb.addEventListener('click', (e) => {
        e.stopPropagation();
      });

      card.addEventListener('click', (e) => {
        if (e.target.tagName.toLowerCase() === 'input') return;
        const isOpen = card.classList.toggle('open');
        card.querySelector('.chevron').style.transform = isOpen ? 'rotate(180deg)' : 'rotate(0deg)';
      });

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
    renderPrintBlank,
    renderStudentListForCheck,
    renderLibraryList,
    showStudentCardModal,
    renderPrintJournalCards,
  };
})();
