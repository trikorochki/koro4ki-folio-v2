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

    // --- Функции для обновления состояния кнопок ---
    const updateHeaderButtonState = () => {
        if (isPlaying) {
            playRandomBtn.classList.add('playing');
        } else {
            playRandomBtn.classList.remove('playing');
        }
    };

    const updateMainPlayerButton = () => {
        if (isPlaying) {
            playPauseBtn.textContent = '⏸';
        } else {
            playPauseBtn.textContent = '▶';
        }
    };

    const updateAllButtons = () => {
        updateHeaderButtonState();
        updateMainPlayerButton();
    };

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

    const play = () => { 
        if (allTracks.length > 0) {
            audio.play();
        }
    };

    const pause = () => {
        audio.pause();
    };

    const playPauseToggle = () => {
        if (isPlaying) {
            pause();
        } else {
            play();
        }
    };

    const playNext = () => { 
        loadTrack((currentTrackIndex + 1) % allTracks.length); 
        play(); 
    };

    const playPrev = () => { 
        loadTrack((currentTrackIndex - 1 + allTracks.length) % allTracks.length); 
        play(); 
    };

    // 3. Обработчики событий для кнопки в шапке
    playRandomBtn.addEventListener('click', () => {
        if (allTracks.length > 0) {
            if (isPlaying) {
                // Если играет - ставим на паузу
                pause();
            } else {
                // Если не играет - начинаем воспроизведение
                playerFooter.classList.add('visible');
                document.body.classList.add('body-with-player');
                
                // Если трек не загружен, загружаем первый
                if (!audio.src || audio.src === '') {
                    loadTrack(0);
                }
                
                play();
            }
        }
    });

    // 4. Обработчики событий для основных кнопок плеера
    playPauseBtn.addEventListener('click', playPauseToggle);
    nextBtn.addEventListener('click', playNext);
    prevBtn.addEventListener('click', playPrev);

    // 5. Обработчики событий аудио элемента
    audio.addEventListener('play', () => { 
        isPlaying = true; 
        updateAllButtons();
    });

    audio.addEventListener('pause', () => { 
        isPlaying = false; 
        updateAllButtons();
    });

    audio.addEventListener('ended', () => {
        playNext();
    });

    audio.addEventListener('loadedmetadata', () => { 
        if (audio.duration) {
            durationEl.textContent = formatTime(audio.duration); 
        }
    });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            progressBar.value = (audio.currentTime / audio.duration) * 100 || 0;
            currentTimeEl.textContent = formatTime(audio.currentTime);
        }
    });

    // 6. Обработчик для прогресс-бара
    progressBar.addEventListener('input', (e) => {
        if (audio.duration) {
            audio.currentTime = (e.target.value / 100) * audio.duration;
        }
    });

    // 7. Утилита для форматирования времени
    const formatTime = (s) => { 
        const m = Math.floor(s / 60); 
        const sec = Math.floor(s % 60); 
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };

    // 8. Инициализация состояния кнопок
    updateAllButtons();
});
