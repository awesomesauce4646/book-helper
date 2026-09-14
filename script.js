const XP_PER_MINUTE = 10;
const XP_PER_LEVEL = 100;
const MIN_MINUTES = 1;
const MAX_MINUTES = 120;
const DEFAULT_MINUTES = 15;
const STORAGE_KEY = 'reader_stats';
const DEFAULT_STATS = { streak: 0, xp: 0, lastDate: null };

let sessionDuration = DEFAULT_MINUTES * 60;
let timeLeft = sessionDuration;
let timerId = null;
let isRunning = false;
let sessionEndsAt = null;

let stats = loadStats();

let audioCtx = null;
let noiseNode = null;
let isNoisePlaying = false;
let isRainPlaying = false;

function loadStats() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { ...DEFAULT_STATS };
        const parsed = JSON.parse(raw);
        // merge over defaults so a missing/renamed field can't produce NaN or undefined
        return {
            streak: Number.isFinite(parsed.streak) ? parsed.streak : 0,
            xp: Number.isFinite(parsed.xp) ? parsed.xp : 0,
            lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : null
        };
    } catch (err) {
        console.warn('Could not read saved stats, starting fresh.', err);
        return { ...DEFAULT_STATS };
    }
}

function saveStats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (err) {
        // private browsing or quota exceeded: the session still counts on screen
        console.warn('Could not save stats.', err);
    }
}

function getLevel(xp) {
    return Math.floor(xp / XP_PER_LEVEL) + 1;
}

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    document.getElementById('level-count').textContent = getLevel(stats.xp);
    document.getElementById('streak-count').textContent = stats.streak;
    document.getElementById('xp-count').textContent = stats.xp;
}
function setStartButton(label, running) {
    const btn = document.getElementById('start-btn');
    btn.textContent = label;
    btn.classList.toggle('running', running);
}

function tick() {
    timeLeft = Math.max(0, Math.round((sessionEndsAt - Date.now()) / 1000));
    updateDisplay();

    if (timeLeft === 0) {
        clearInterval(timerId);
        timerId = null;
        completeReading();
    }
}

function startTimer() {
    if (timeLeft <= 0) timeLeft = sessionDuration;

    sessionEndsAt = Date.now() + timeLeft * 1000;
    isRunning = true;
    setStartButton('Pause', true);
    timerId = setInterval(tick, 250);
}

function pauseTimer() {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;
    setStartButton('Resume reading', false);
}

function toggleTimer() {
    if (isRunning) {
        pauseTimer();
    } else {
        startTimer();
    }
}

function resetTimer() {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;
    timeLeft = sessionDuration;
    setStartButton('Start reading', false);
    updateDisplay();
}

function updateDuration() {
    const input = document.getElementById('timer-duration');
    let minutes = parseInt(input.value, 10);

    if (!Number.isFinite(minutes) || minutes < MIN_MINUTES) minutes = MIN_MINUTES;
    if (minutes > MAX_MINUTES) minutes = MAX_MINUTES;
    input.value = minutes;

    sessionDuration = minutes * 60;

    if (!isRunning) {
        timeLeft = sessionDuration;
        updateDisplay();
    }
}

function completeReading() {
    isRunning = false;
    timeLeft = 0;
    setStartButton('Reading complete', false);

    const levelBefore = getLevel(stats.xp);
    const xpEarned = Math.round((sessionDuration / 60) * XP_PER_MINUTE);
    stats.xp += xpEarned;
    const levelAfter = getLevel(stats.xp);

    updateStreak();
    saveStats();
    updateDisplay();

    const levelUp = levelAfter > levelBefore ? ` You reached level ${levelAfter}.` : '';
    alert(`Reading complete. +${xpEarned} XP earned.${levelUp}`);
}

function updateStreak() {
    const today = new Date().toDateString();
    if (stats.lastDate === today) return; // already counted today

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (stats.lastDate === yesterday) {
        stats.streak += 1;
    } else {
        stats.streak = 1; // first session ever, or the chain was broken
    }
    stats.lastDate = today;
}

function toggleAmbient() {
    const btn = document.getElementById('white-btn');

    if (!isNoisePlaying) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;

        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 800;

        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 0.15;

        noise.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        noise.start();
        noiseNode = noise;
        isNoisePlaying = true;

        btn.textContent = 'Stop sound';
        btn.classList.add('active');
    } else {
        if (noiseNode) {
            noiseNode.stop();
            noiseNode.disconnect();
            noiseNode = null;
        }
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
        }
        isNoisePlaying = false;

        btn.textContent = 'Play sound';
        btn.classList.remove('active');
    }
}

function togglePlayback() {
    const audio = document.getElementById('rain-audio');
    const button = document.getElementById('rain-btn');
    if (!audio || !button) return;

    if (audio.paused) {
        audio.play().catch(err => console.warn('Playback blocked.', err));
        isRainPlaying = true;
        button.textContent = 'Stop sound';
        button.classList.add('active');
    } else {
        audio.pause();
        isRainPlaying = false;
        button.textContent = 'Play sound';
        button.classList.remove('active');
    }
}

const durationInput = document.getElementById('timer-duration');
if (durationInput) {
    durationInput.addEventListener('change', updateDuration);
    durationInput.addEventListener('blur', updateDuration);
}
updateDisplay();