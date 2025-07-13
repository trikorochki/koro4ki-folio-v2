document.addEventListener('DOMContentLoaded', () => {
    const playRandomBtn = document.getElementById('main-play-random-btn');
    const playerFooter = document.getElementById('main-player-footer');
    
    if (!playRandomBtn || !playerFooter) return;

    // --- Элементы плеера ---
    const audio = document.getElementById('audio-source');
    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const progressBar = document.getElementById('progress-bar');
    const currentTimeEl = document.getElementById('current-time');
    const durationEl = document.getElementById('duration');
    const currentTrackTitleEl = document.getElementById('current-track-title');

    let allTracks = [];
    let currentTrackIndex = 0;
    let isPlaying = false;

    // 1. Сбор и перемешивание всех треков
    if (typeof window.artistData !== 'undefined') {
        Object.values(window.artistData).forEach(artist => {
            ['albums', 'eps', 'demos'].forEach(type => {
                (artist[type] || []).forEach(release => {
                    release.tracks.forEach(track => {
                        allTracks.push({ ...track, artistName: artist.name });
                    });
                });
            });
        });
        allTracks.sort(() => 0.5 - Math.random());
    }

    // 2. Функции управления плеером
    const loadTrack = (index) => {
        if (index >= 0 && index < allTracks.length) {
            currentTrackIndex = index;
            const track = allTracks[index];
            audio.src = track.file;
            currentTrackTitleEl.textContent = `${track.title} - ${track.artistName}`;
            audio.load();
        }
    };

    const play = () => { if (allTracks.length > 0) audio.play(); };
    const pause = () => audio.pause();
    const playPauseToggle = () => isPlaying ? pause() : play();
    const playNext = () => { loadTrack((currentTrackIndex + 1) % allTracks.length); play(); };
    const playPrev = () => { loadTrack((currentTrackIndex - 1 + allTracks.length) % allTracks.length); play(); };

    // 3. Обработчики событий
    playRandomBtn.addEventListener('click', () => {
        if (allTracks.length > 0) {
            playerFooter.classList.add('visible');
            document.body.classList.add('body-with-player');
            loadTrack(0);
            play();
        }
    });

    playPauseBtn.addEventListener('click', playPauseToggle);
    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrev);
    audio.addEventListener('ended', playNext);
    
    audio.addEventListener('play', () => { isPlaying = true; playPauseBtn.textContent = '⏸'; });
    audio.addEventListener('pause', () => { isPlaying = false; playPauseBtn.textContent = '▶'; });
    audio.addEventListener('loadedmetadata', () => { durationEl.textContent = formatTime(audio.duration); });
    audio.addEventListener('timeupdate', () => {
        progressBar.value = (audio.currentTime / audio.duration) * 100 || 0;
        currentTimeEl.textContent = formatTime(audio.currentTime);
    });
    progressBar.addEventListener('input', (e) => {
        if(audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    });

    const formatTime = (s) => { const m = Math.floor(s/60); const sec = Math.floor(s%60); return `${m}:${sec<10?'0':''}${sec}`; };
});
