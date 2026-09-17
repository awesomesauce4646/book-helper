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
    // so that at a higher level it doesn't get impossible to level up unless you read a ton
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
    if (level >= 40) return 'Smarty Pants';
    if (level >= 20) return 'Knowledge Consumer';
    if (level >= 10) return 'Brainiac';
    if (level >= 5) return 'Bookworm';
    return 'Newbie Reader';
}

const THEMES = [
    { id: 'default', name: 'Ocean', unlockLevel: 1,  accent: '#3b82f6', accentHover: '#2666f0', secondary: '#d400ff', secondaryHover: '#b000d4', bgColor: '#111141', xpFill: '#c641fa', reset: 'rgb(111, 0, 255)', resetHover: 'rgb(102, 0, 235)' },
    { id: 'forest',  name: 'Forest',   unlockLevel: 5,  accent: '#10b981', accentHover: '#0d9467', secondary: '#facc15', secondaryHover: '#eab308', bgColor: '#0d1f17', xpFill: '#34d399', reset: 'rgb(7, 82, 44)', resetHover: 'rgb(5, 60, 32)' },
    { id: 'sunset',  name: 'Sunset',    unlockLevel: 10, accent: '#f97316', accentHover: '#ea580c', secondary: '#ef4444', secondaryHover: '#dc2626', bgColor: '#2a1408', xpFill: '#fb923c', reset: 'rgb(239, 68, 68)', resetHover: 'rgb(220, 38, 38)' },
    { id: 'rose',    name: 'Rose',     unlockLevel: 15, accent: '#ec4899', accentHover: '#db2777', secondary: '#8b5cf6', secondaryHover: '#7c3aed', bgColor: '#241226', xpFill: '#f472b6', reset: 'rgb(235, 85, 85)', resetHover: 'rgb(215, 60, 60)' },
    { id: 'gold',    name: 'Golden',     unlockLevel: 20, accent: '#ffbf00', accentHover: '#ca8a04', secondary: '#f43f5e', secondaryHover: '#e11d48', bgColor: '#241608', xpFill: '#facc15', reset: 'rgb(221, 144, 0)', resetHover: 'rgb(190, 120, 0)' }
];

const BADGE_DEFS = [
    { id: 'streak_7',    icon: '🔥', label: '7-Day Streak',  check: s => s.longestStreak >= 7,          hint: 'Read for 7 days straight!' },
    { id: 'streak_30',   icon: '🔥', label: '30-Day Streak', check: s => s.longestStreak >= 30,         hint: 'Read for 30 days straight!' },
    { id: 'hours_5',     icon: '📖', label: '5 Hours Read',  check: s => s.totalMinutes >= 300,         hint: 'Read for 5 hours in total!' },
    { id: 'hours_25',    icon: '📚', label: '25 Hours Read', check: s => s.totalMinutes >= 1500,        hint: 'Read for 25 hours in total!' },
    { id: 'sessions_10', icon: '⭐', label: '10 Sessions',   check: s => s.sessionsCompleted >= 10,     hint: 'Complete 10 sessions of reading!' },
    { id: 'sessions_50', icon: '🏆', label: '50 Sessions',   check: s => s.sessionsCompleted >= 50,     hint: 'Complete 50 sessions of reading!' }
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
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};

        return {
            streak: parsed.streak ?? 0,
            xp: parsed.xp ?? 0,
            lastDate: parsed.lastDate ?? null,
            totalMinutes: parsed.totalMinutes ?? 0,
            sessionsCompleted:  parsed.sessionsCompleted ?? 0,
            longestStreak: parsed.longestStreak ?? 0,
            selectedTheme: parsed.selectedTheme ?? 'default'
        };
}

function saveStats() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch (err) {
        console.warn('Could not save stats.', err);
    }
}

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
    createBadges();
    themeLayout();

    showCompletionModal({ xpEarned, levelBefore, levelAfter, newBadges });
}

function showCompletionModal({ xpEarned, levelBefore, levelAfter, newBadges }) {
    const body = document.getElementById('complete-body');

    let html = `You earned <span class="complete-xp">+${xpEarned} XP</span>.`;

    if (levelAfter > levelBefore) {
        html += `<span class="complete-levelup">You reached Level ${levelAfter}: ${getTitle(levelAfter)}!</span>`;
    }

    if (newBadges.length > 0) {
        const badgeText = newBadges.map(b => `${b.icon} ${b.label}`).join(', ');
        html += `<span class="complete-badge">New trophy unlocked: ${badgeText}</span>`;
    }

    body.innerHTML = html;
    openModal('complete-modal');
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
    root.setProperty('--reset-hover', theme.resetHover);
}

function selectTheme(themeId) {
    const { level } = getLevelInfo(stats.xp);
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme || level < theme.unlockLevel) return;

    stats.selectedTheme = themeId;
    saveStats();
    applyTheme(themeId);
    themeLayout();
}

function themeLayout() {
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

function createBadges() {
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

const durationInput = document.getElementById('timer-duration');
if (durationInput) {
    durationInput.addEventListener('change', updateDuration);
    durationInput.addEventListener('blur', updateDuration);
}

applyTheme(stats.selectedTheme);
updateDisplay();
createBadges();
themeLayout();