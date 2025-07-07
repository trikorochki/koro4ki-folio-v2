document.addEventListener('DOMContentLoaded', () => {
    // --- Элементы DOM ---
    const body = document.body;
    const artistSlug = body.dataset.artistSlug;
    const albumContainer = document.getElementById('album-container');
    const audioElement = document.getElementById('audio-element');
    const currentTrackTitle = document.getElementById('current-track-title');
    const artistImage = document.getElementById('artist-image');
    const artistNameHeading = document.getElementById('artist-name-heading');
    const artistDescription = document.getElementById('artist-description');
    const playAllButton = document.getElementById('play-all-button');

    // --- Состояние плеера ---
    let currentPlayingItem = null;
    let entirePlaylist = [];

    // --- Функция воспроизведения трека (без изменений) ---
    const playTrack = (trackElement, track, albumName) => {
        if (currentPlayingItem) {
            currentPlayingItem.classList.remove('playing');
        }
        audioElement.src = track.url;
        audioElement.play();
        currentTrackTitle.textContent = `${albumName} - ${track.title}`;
        trackElement.classList.add('playing');
        currentPlayingItem = trackElement;
    };

    // --- Основная функция загрузки данных ---
    fetch(`/api/artist/${artistSlug}`)
        .then(response => {
            if (!response.ok) throw new Error('Artist not found');
            return response.json();
        })
        .then(data => {
            albumContainer.innerHTML = ''; // Очищаем контейнер
            
            // Заполняем шапку артиста (без изменений)
            document.title = data.name;
            artistNameHeading.textContent = data.name;
            artistDescription.querySelector('.line1').textContent = data.description_line1;
            artistDescription.querySelector('.line2').textContent = data.description_line2;
            if (data.image_url) {
                artistImage.src = data.image_url;
            } else {
                artistImage.style.display = 'none';
            }

            if (!data.albums || data.albums.length === 0) {
                albumContainer.innerHTML = '<p>This artist has no uploaded music yet.</p>';
                playAllButton.style.display = 'none';
                return;
            }

            // --- НОВАЯ ЛОГИКА: СОЗДАНИЕ КАРУСЕЛИ ---

            // 1. Создаем обертку для карусели и кнопок
            const carouselWrapper = document.createElement('div');
            carouselWrapper.className = 'album-carousel-wrapper';

            const carousel = document.createElement('div');
            carousel.className = 'album-carousel';

            // 2. Наполняем карусель альбомами
            data.albums.forEach((album, index) => {
                const albumItem = document.createElement('div');
                albumItem.className = 'album-item';
                albumItem.dataset.albumIndex = index; // Сохраняем индекс для связи
                
                albumItem.innerHTML = `
                    <img src="${album.cover_url || 'https://via.placeholder.com/150/181818/282828?text=No+Art'}" alt="${album.name} cover" class="album-cover">
                    <div class="album-name">${album.name}</div>
                `;
                
                carousel.appendChild(albumItem);
            });
            
            carouselWrapper.appendChild(carousel);
            
            // 3. Создаем и добавляем кнопки управления, если альбомов много
            if (data.albums.length > 4) { // Показывать кнопки, если есть что скроллить
                const leftBtn = document.createElement('button');
                leftBtn.className = 'carousel-btn prev';
                leftBtn.innerHTML = '&#9664;';
                leftBtn.onclick = () => carousel.scrollBy({ left: -300, behavior: 'smooth' });

                const rightBtn = document.createElement('button');
                rightBtn.className = 'carousel-btn next';
                rightBtn.innerHTML = '&#9654;';
                rightBtn.onclick = () => carousel.scrollBy({ left: 300, behavior: 'smooth' });

                carouselWrapper.prepend(leftBtn);
                carouselWrapper.append(rightBtn);
            }

            // 4. Добавляем готовую карусель на страницу
            albumContainer.appendChild(carouselWrapper);

            // 5. Создаем контейнер, где будет отображаться треклист
            const tracklistContainer = document.createElement('div');
            tracklistContainer.className = 'tracklist-container';
            albumContainer.appendChild(tracklistContainer);

            // 6. Функция для отображения треклиста
            const displayTracklist = (albumIndex) => {
                const album = data.albums[albumIndex];
                if (!album) return;

                tracklistContainer.innerHTML = ''; // Очищаем старый треклист

                const trackListEl = document.createElement('ul');
                trackListEl.className = 'track-list';
                
                album.tracks.forEach(track => {
                    const trackItem = document.createElement('li');
                    trackItem.className = 'track-item';
                    trackItem.textContent = track.title;
                    trackItem.addEventListener('click', () => {
                        playTrack(trackItem, track, album.name);
                    });
                    trackListEl.appendChild(trackItem);
                });

                tracklistContainer.appendChild(trackListEl);
                entirePlaylist = album.tracks; // Обновляем плейлист для кнопки "Play All"
            };

            // 7. Навешиваем обработчики кликов на альбомы в карусели
            document.querySelectorAll('.album-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    // Подсвечиваем выбранный альбом
                    document.querySelectorAll('.album-item').forEach(el => el.classList.remove('selected'));
                    e.currentTarget.classList.add('selected');
                    
                    const albumIndex = e.currentTarget.dataset.albumIndex;
                    displayTracklist(albumIndex);
                });
            });

            // По умолчанию показываем треклист первого альбома и подсвечиваем его
            if (data.albums.length > 0) {
                document.querySelector('.album-item').classList.add('selected');
                displayTracklist(0);
            }
        });

    // Логика плеера (без изменений)
    audioElement.addEventListener('ended', () => {
        const currentTrackUrl = audioElement.currentSrc.replace(window.location.origin, '');
        const currentTrackIndex = entirePlaylist.findIndex(t => t.url === currentTrackUrl);
        if (currentTrackIndex > -1 && currentTrackIndex < entirePlaylist.length - 1) {
            const nextTrack = entirePlaylist[currentTrackIndex + 1];
            const nextTrackElement = document.querySelector(`.track-item[data-src="${nextTrack.url}"]`);
            if (nextTrackElement) {
                // Находим родительский альбом и передаем его имя
                const albumName = entirePlaylist[0].albumName;
                playTrack(nextTrackElement, nextTrack, albumName);
            }
        } else {
             currentTrackTitle.textContent = "Playlist finished";
             if (currentPlayingItem) {
                currentPlayingItem.classList.remove('playing');
                currentPlayingItem = null;
             }
        }
    });
});
