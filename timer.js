'use strict';

/**
 * Timer module — manages reading session timing.
 * Exposed globally as window.Timer.
 */
const Timer = (() => {
  let _interval   = null;
  let _startTime  = null;
  let _elapsed    = 0;       // seconds accumulated before last stop
  let _isRunning  = false;
  let _duration   = null;    // max seconds, null = unlimited
  let _onTick     = null;
  let _onComplete = null;

  /**
   * Start (or resume) the timer.
   * @param {object} opts
   * @param {number|null} opts.duration  - seconds until onComplete fires (null = unlimited)
   * @param {function}    opts.onTick    - called every ~100ms with elapsed seconds
   * @param {function}    opts.onComplete - called when duration is reached
   */
  function start({ duration = null, onTick = null, onComplete = null } = {}) {
    if (_isRunning) return;
    _duration   = duration;
    _onTick     = onTick;
    _onComplete = onComplete;
    _startTime  = Date.now() - _elapsed * 1000;
    _isRunning  = true;

    _interval = setInterval(() => {
      _elapsed = (Date.now() - _startTime) / 1000;
      if (_onTick) _onTick(_elapsed);

      if (_duration !== null && _elapsed >= _duration) {
        const finalElapsed = stop();
        if (_onComplete) _onComplete(finalElapsed);
      }
    }, 100);
  }

  /** Stop the timer and return elapsed seconds. */
  function stop() {
    if (!_isRunning) return _elapsed;
    clearInterval(_interval);
    _interval  = null;
    _isRunning = false;
    _elapsed   = (Date.now() - _startTime) / 1000;
    return _elapsed;
  }

  /** Reset timer to zero without starting it. */
  function reset() {
    stop();
    _elapsed    = 0;
    _startTime  = null;
    _duration   = null;
    _onTick     = null;
    _onComplete = null;
  }

  /** Return elapsed seconds (works while running too). */
  function getElapsed() {
    if (_isRunning) return (Date.now() - _startTime) / 1000;
    return _elapsed;
  }

  function isRunning() { return _isRunning; }

  /**
   * Format seconds as M:SS string.
   * @param {number} seconds
   * @returns {string}
   */
  function formatTime(seconds) {
    const totalSec = Math.floor(seconds);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  return { start, stop, reset, getElapsed, isRunning, formatTime };
})();
