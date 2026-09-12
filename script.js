// App State
let timeLeft = 15 * 60; // 15 minute micro-sessions
let timerId = null;
let isRunning = false;

// User Stats (Loaded from localStorage)
let stats = JSON.parse(localStorage.getItem('reader_stats')) || { streak: 0, xp: 0, lastDate: null };

// Web Audio API for procedural rain noise
let audioCtx = null;
let noiseNode = null;
let isAudioPlaying = false;

function updateDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timer').textContent = 
        `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    document.getElementById('streak-count').textContent = stats.streak;
    document.getElementById('xp-count').textContent = stats.xp;
}

function toggleTimer() {
    const startBtn = document.getElementById('start-btn');
    if (isRunning) {
        clearInterval(timerId);
        startBtn.textContent = 'Resume Timer';
        startBtn.classList.remove('running');
        isRunning = false;
    } else {
        isRunning = true;
        startBtn.textContent = 'Pause';
        startBtn.classList.add('running');
        
        timerId = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateDisplay();
            } else {
                clearInterval(timerId);
                completeQuest();
            }
        }, 1000);
    }
}

function resetTimer() {
    clearInterval(timerId);
    isRunning = false;
    timeLeft = 15 * 60;
    const startBtn = document.getElementById('start-btn');
    startBtn.textContent = 'Start Reading!';
    startBtn.classList.remove('running');
    updateDisplay();
}

function completeReading() {
    isRunning = false;
    document.getElementById('start-btn').textContent = 'Reading Complete!';
    
    // Award XP
    stats.xp += 50;
    
    // Check Streak logic
    const today = new Date().toDateString();
    if (stats.lastDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (stats.lastDate === yesterday || stats.streak === 0) {
            stats.streak++;
        } else if (stats.lastDate !== today) {
            stats.streak = 1;
        }
        stats.lastDate = today;
    }
    
    localStorage.setItem('reader_stats', JSON.stringify(stats));
    updateDisplay();
    alert('Reading complete! +50 XP earned. Great job staying focused.');
}

function toggleAmbient() {
    if (!isAudioPlaying) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
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

        isAudioPlaying = true;
        const btn = document.getElementById('ambient-btn');
        btn.textContent = 'Stop Sound';
        btn.classList.add('active');
    } else {
        if (noiseNode) {
            noiseNode.stop();
        }
        if (audioCtx) {
            audioCtx.close();
        }
        isAudioPlaying = false;
        const btn = document.getElementById('ambient-btn');
        btn.textContent = 'Play Sound';
        btn.classList.remove('active');
    }
}

// Initialize UI on load
updateDisplay();