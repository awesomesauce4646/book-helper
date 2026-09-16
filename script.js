// ---- Config ----
const XP_PER_MINUTE = 10;
const MIN_MINUTES = 1;
const MAX_MINUTES = 120;
const DEFAULT_MINUTES = 15;
const STORAGE_KEY = 'reader_stats';

const DEFAULT_STATS = {
    streak: 0,
    xp: 0,
    lastDate: null,
    totalMinutes: 0,
    sessionsCompleted: 0,
    longestStreak: 0,
    selectedTheme: 'default'
};

function xpForLevel(level) {
    return Math.min(100 + (level - 1) * 25, 400);
}

function getLevelInfo(totalXp) {
    let level = 1;
    let remaining = totalXp;
    while (remaining >= xpForLevel(level)) {
        remaining -= xpForLevel(level);
        level++;
    }
    return { level, xpIntoLevel: remaining, xpForNext: xpForLevel(level) };
}

function getTitle(level) {
    if (level >= 40) return 'Grand Archivist';
    if (level >= 20) return 'Sage of the Shelves';
    if (level >= 10) return 'Bibliophile';
    if (level >= 5) return 'Bookworm';
    return 'Page Turner';
}

const THEMES = [
    { id: 'default', name: 'Midnight Indigo', unlockLevel: 1,  accent: '#3b82f6', accentHover: '#2666f0', secondary: '#d400ff', secondaryHover: '#b000d4', bgColor: '#111141', xpFill: '#c641fa', reset: 'rgb(111, 0, 255)', "reset-hover": 'rgb(102, 0, 235)' },
    { id: 'forest',  name: 'Forest Canopy',   unlockLevel: 5,  accent: '#10b981', accentHover: '#0d9467', secondary: '#facc15', secondaryHover: '#eab308', bgColor: '#0d1f17', xpFill: '#34d399', reset: 'rgb(7, 82, 44)', "reset-hover": 'rgb(6, 63, 35)' },
    { id: 'sunset',  name: 'Sunset Ember',    unlockLevel: 10, accent: '#f97316', accentHover: '#ea580c', secondary: '#ef4444', secondaryHover: '#dc2626', bgColor: '#2a1408', xpFill: '#fb923c', reset: 'rgb(239, 68, 68)', "reset-hover": 'rgb(182, 47, 47)' },
    { id: 'rose',    name: 'Rose Quartz',     unlockLevel: 15, accent: '#ec4899', accentHover: '#db2777', secondary: '#8b5cf6', secondaryHover: '#7c3aed', bgColor: '#241226', xpFill: '#f472b6', reset: 'rgb(235, 85, 85)', "reset-hover": 'rgb(160, 60, 60)' },
    { id: 'gold',    name: 'Golden Hour',     unlockLevel: 20, accent: '#ffbf00', accentHover: '#ca8a04', secondary: '#f43f5e', secondaryHover: '#e11d48', bgColor: '#744f00', xpFill: '#facc15', reset: 'rgb(221, 144, 0)', "reset-hover": 'rgb(177, 115, 0)' }
];

const BADGE_DEFS = [
    { id: 'streak_7',    icon: '🔥', label: '7-Day Streak',  check: s => s.longestStreak >= 7,          hint: 'Reach a 7-day streak' },
    { id: 'streak_30',   icon: '🔥', label: '30-Day Streak', check: s => s.longestStreak >= 30,         hint: 'Reach a 30-day streak' },
    { id: 'hours_5',     icon: '📖', label: '5 Hours Read',  check: s => s.totalMinutes >= 300,         hint: 'Read for 5 hours total' },
    { id: 'hours_25',    icon: '📚', label: '25 Hours Read', check: s => s.totalMinutes >= 1500,        hint: 'Read for 25 hours total' },
    { id: 'sessions_10', icon: '⭐', label: '10 Sessions',   check: s => s.sessionsCompleted >= 10,     hint: 'Complete 10 sessions' },
    { id: 'sessions_50', icon: '🏆', label: '50 Sessions',   check: s => s.sessionsCompleted >= 50,     hint: 'Complete 50 sessions' }
];


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
        return {
            streak: Number.isFinite(parsed.streak) ? parsed.streak : 0,
            xp: Number.isFinite(parsed.xp) ? parsed.xp : 0,
            lastDate: typeof parsed.lastDate === 'string' ? parsed.lastDate : null,
            totalMinutes: Number.isFinite(parsed.totalMinutes) ? parsed.totalMinutes : 0,
            sessionsCompleted: Number.isFinite(parsed.sessionsCompleted) ? parsed.sessionsCompleted : 0,
            longestStreak: Number.isFinite(parsed.longestStreak) ? parsed.longestStreak : 0,
            selectedTheme: typeof parsed.selectedTheme === 'string' ? parsed.selectedTheme : 'default'
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
        console.warn('Could not save stats.', err);
    }
}

// ---- Display ----
function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').textContent =
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    const { level, xpIntoLevel, xpForNext } = getLevelInfo(stats.xp);
    document.getElementById('level-count').textContent = level;
    document.getElementById('level-title').textContent = getTitle(level);
    document.getElementById('xp-bar-fill').style.width = `${Math.min(100, (xpIntoLevel / xpForNext) * 100)}%`;
    document.getElementById('xp-bar-label').textContent = `${xpIntoLevel} / ${xpForNext} XP to next level`;

    document.getElementById('streak-count').textContent = stats.streak;
    document.getElementById('xp-count').textContent = stats.xp;
    document.getElementById('sessions-count').textContent = stats.sessionsCompleted;
}

function setStartButton(label, running) {
    const btn = document.getElementById('start-btn');
    btn.textContent = label;
    btn.classList.toggle('running', running);
}

// ---- Timer ----
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

    const levelBefore = getLevelInfo(stats.xp).level;
    const badgesBefore = BADGE_DEFS.filter(b => b.check(stats)).map(b => b.id);

    const xpEarned = Math.round((sessionDuration / 60) * XP_PER_MINUTE);
    stats.xp += xpEarned;
    stats.totalMinutes += sessionDuration / 60;
    stats.sessionsCompleted += 1;
    updateStreak();
    stats.longestStreak = Math.max(stats.longestStreak, stats.streak);

    const levelAfter = getLevelInfo(stats.xp).level;
    const badgesAfter = BADGE_DEFS.filter(b => b.check(stats));
    const newBadges = badgesAfter.filter(b => !badgesBefore.includes(b.id));

    saveStats();
    updateDisplay();
    renderBadges();
    renderThemes();

    let message = `Reading complete. +${xpEarned} XP earned.`;
    if (levelAfter > levelBefore) {
        message += ` You reached level ${levelAfter}: ${getTitle(levelAfter)}.`;
    }
    if (newBadges.length > 0) {
        message += ` New trophy unlocked: ${newBadges.map(b => b.label).join(', ')}.`;
    }
    alert(message);
}

function updateStreak() {
    const today = new Date().toDateString();
    if (stats.lastDate === today) return;

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (stats.lastDate === yesterday) {
        stats.streak += 1;
    } else {
        stats.streak = 1;
    }
    stats.lastDate = today;
}

function applyTheme(themeId) {
    const theme = THEMES.find(t => t.id === themeId) || THEMES[0];
    const root = document.documentElement.style;
    root.setProperty('--accent', theme.accent);
    root.setProperty('--accent-hover', theme.accentHover);
    root.setProperty('--secondary-accent', theme.secondary);
    root.setProperty('--secondary-accent-hover', theme.secondaryHover);
    root.setProperty('--bg-color', theme.bgColor);
    root.setProperty('--xp-fill', theme.xpFill);
    root.setProperty('--reset', theme.reset); 
    root.setProperty('--reset-hover', theme["reset-hover"]);
}

function selectTheme(themeId) {
    const { level } = getLevelInfo(stats.xp);
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme || level < theme.unlockLevel) return;

    stats.selectedTheme = themeId;
    saveStats();
    applyTheme(themeId);
    renderThemes();
}

function renderThemes() {
    const grid = document.getElementById('theme-grid');
    if (!grid) return;
    const { level } = getLevelInfo(stats.xp);

    grid.innerHTML = THEMES.map(theme => {
        const unlocked = level >= theme.unlockLevel;
        const selected = stats.selectedTheme === theme.id;
        let buttonHtml;
        if (!unlocked) {
            buttonHtml = `<button class="theme-action-btn" disabled>Lv ${theme.unlockLevel}</button>`;
        } else if (selected) {
            buttonHtml = `<button class="theme-action-btn selected" disabled>Selected</button>`;
        } else {
            buttonHtml = `<button class="theme-action-btn" onclick="selectTheme('${theme.id}')">Select</button>`;
        }
        return `
            <div class="theme-row">
                <div class="theme-info">
                    <span class="theme-swatch" style="background:${theme.accent};"></span>
                    <span class="theme-name">${theme.name}</span>
                </div>
                ${buttonHtml}
            </div>
        `;
    }).join('');
}

function renderBadges() {
    const grid = document.getElementById('badge-grid');
    if (!grid) return;

    grid.innerHTML = BADGE_DEFS.map(badge => {
        const unlocked = badge.check(stats);
        return `
            <div class="badge-card ${unlocked ? '' : 'locked'}">
                <span class="badge-icon">${badge.icon}</span>
                <div>${badge.label}</div>
                ${unlocked ? '' : `<div style="margin-top:0.3rem; color: var(--text-muted); font-size: 0.75rem;">${badge.hint}</div>`}
            </div>
        `;
    }).join('');
}

function openModal(id) {
    document.getElementById(id).classList.add('open');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('open');
}

function closeModalOnBackdrop(event, id) {
    if (event.target.id === id) closeModal(id);
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
    }
});

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

// ---- Init ----
const durationInput = document.getElementById('timer-duration');
if (durationInput) {
    durationInput.addEventListener('change', updateDuration);
    durationInput.addEventListener('blur', updateDuration);
}

applyTheme(stats.selectedTheme);
updateDisplay();
renderBadges();
renderThemes();