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

    // --- Переменные состояния ---
    let allTracks = [];
    let currentTrackIndex = 0;
    let isPlaying = false;
    let listenCounted = false; // ✅ ДОБАВЛЕНО: Флаг для отслеживания аналитики

    // --- Функции для обновления состояния кнопок ---
    // Я объединил две ваши функции в одну для чистоты кода
    const updateAllButtons = () => {
        playRandomBtn.classList.toggle('playing', isPlaying);
        playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
    };

    // --- Утилиты ---
    // ✅ ДОБАВЛЕНО: Функция отправки данных на сервер
    const logListen = async (trackId) => {
        try {
            const response = await fetch('/api/listen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ trackId }),
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log(`(Index Page) Счетчик для трека ${trackId} обновлен.`);
        } catch (error) {
            console.error('(Index Page) Ошибка при отправке данных аналитики:', error);
        }
    };
    
    // Ваша утилита для форматирования времени. Она остается на месте.
    const formatTime = (s) => { 
        const m = Math.floor(s / 60); 
        const sec = Math.floor(s % 60); 
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };

    // 1. Сбор и перемешивание всех треков (без изменений)
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
            listenCounted = false; // ✅ ИЗМЕНЕНО: Сбрасываем флаг для нового трека
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

    // 3. Обработчики событий для кнопки в шапке (без изменений)
    playRandomBtn.addEventListener('click', () => {
        if (allTracks.length > 0) {
            if (isPlaying) {
                pause();
            } else {
                playerFooter.classList.add('visible');
                document.body.classList.add('body-with-player');
                if (!audio.src || audio.src === '') {
                    loadTrack(0);
                }
                play();
            }
        }
    });

    // 4. Обработчики событий для основных кнопок плеера (без изменений)
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

    // ✅ ИЗМЕНЕНО: Добавлена логика аналитики в обработчик timeupdate
    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            progressBar.value = (audio.currentTime / audio.duration) * 100 || 0;
            currentTimeEl.textContent = formatTime(audio.currentTime);
        }
        
        // Логика подсчета прослушиваний
        if (!listenCounted && audio.currentTime >= 30) {
            listenCounted = true; // Считаем только один раз
            const currentTrack = allTracks[currentTrackIndex];
            if (currentTrack && currentTrack.file) {
                logListen(currentTrack.file);
            }
        }
    });

    // 6. Обработчик для прогресс-бара (без изменений)
    progressBar.addEventListener('input', (e) => {
        if (audio.duration) {
            audio.currentTime = (e.target.value / 100) * audio.duration;
        }
    });

    // 7. Инициализация состояния кнопок
    updateAllButtons();
});
