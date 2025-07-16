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
    let currentTrackIndex = -1; // Начинаем с -1, чтобы первая загрузка была корректной
    let isPlaying = false;

    // --- НОВЫЙ БЛОК: Состояние для расширенной аналитики ---
    let listenCounted = false; // Флаг для события '30s_listen'
    let currentTrackForAnalytics = null; // Хранит данные текущего трека для отправки
    
    // --- Функции для обновления состояния кнопок ---
    const updateAllButtons = () => {
        playRandomBtn.classList.toggle('playing', isPlaying);
        playPauseBtn.textContent = isPlaying ? '⏸' : '▶';
    };

    // --- НОВЫЙ БЛОК: Универсальная функция для отправки событий аналитики ---
    const logPlayerEvent = async (eventType) => {
        // Убеждаемся, что у нас есть трек для отправки данных
        if (!currentTrackForAnalytics || !currentTrackForAnalytics.file) return;
        
        try {
            // Отправляем POST-запрос на наш основной API-эндпоинт
            await fetch('/api/listen', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    trackId: currentTrackForAnalytics.file,
                    eventType: eventType
                }),
            });
            console.log(`Analytics Event: '${eventType}' for track '${currentTrackForAnalytics.title}' sent.`);
        } catch (error) {
            console.error(`Failed to log analytics event '${eventType}':`, error);
        }
    };
    
    // --- Утилита форматирования времени (без изменений) ---
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

    // 2. Функции управления плеером (модифицированы для аналитики)
    const originalLoadTrack = (index) => {
        if (index >= 0 && index < allTracks.length) {
            currentTrackIndex = index;
            const track = allTracks[index];
            audio.src = track.file;
            currentTrackTitleEl.textContent = `${track.title} - ${track.artistName}`;
            audio.load();
        }
    };

    // ✅ МОДИФИЦИРОВАНО: Оборачиваем loadTrack для управления состоянием аналитики
    const loadTrack = (index) => {
        listenCounted = false; // Сбрасываем флаг 30-секундного прослушивания
        originalLoadTrack(index);
        currentTrackForAnalytics = allTracks[index]; // Обновляем текущий трек для аналитики
    };

    const play = () => { 
        if (allTracks.length > 0) audio.play();
    };

    const pause = () => {
        audio.pause();
    };

    const playPauseToggle = () => {
        if (isPlaying) pause();
        else play();
    };

    const originalPlayNext = () => { 
        loadTrack((currentTrackIndex + 1) % allTracks.length); 
        play(); 
    };

    // ✅ МОДИФИЦИРОВАНО: Оборачиваем playNext для отслеживания пропусков
    const playNext = () => {
        // Если трек играл, но не достиг 30 секунд, считаем это пропуском
        if (isPlaying && !listenCounted) {
            logPlayerEvent('track_skipped');
        }
        originalPlayNext();
    };

    const playPrev = () => { 
        if (isPlaying && !listenCounted) {
            logPlayerEvent('track_skipped');
        }
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
                if (audio.src === '') {
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

    // 5. Обработчики событий аудио элемента (модифицированы для аналитики)
    audio.addEventListener('play', () => { 
        isPlaying = true; 
        updateAllButtons();
        // Отправляем событие 'play_started' только при первом запуске трека
        if (audio.currentTime < 1) {
            logPlayerEvent('play_started');
        }
    });

    audio.addEventListener('pause', () => { 
        isPlaying = false; 
        updateAllButtons();
    });

    audio.addEventListener('ended', () => {
        logPlayerEvent('track_completed'); // Трек дослушан до конца
        originalPlayNext(); // Переходим к следующему
    });

    audio.addEventListener('loadedmetadata', () => { 
        if (audio.duration) durationEl.textContent = formatTime(audio.duration); 
    });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            progressBar.value = (audio.currentTime / audio.duration) * 100 || 0;
            currentTimeEl.textContent = formatTime(audio.currentTime);
        }
        
        // ✅ МОДИФИЦИРОВАНО: Логика ключевого события '30s_listen'
        if (!listenCounted && audio.currentTime >= 30) {
            listenCounted = true; // Считаем только один раз за трек
            logPlayerEvent('30s_listen');
        }
    });

    // 6. Обработчик для прогресс-бара (без изменений)
    progressBar.addEventListener('input', (e) => {
        if (audio.duration) audio.currentTime = (e.target.value / 100) * audio.duration;
    });

    // 7. Инициализация состояния кнопок
    updateAllButtons();
});
