document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-stats-btn');
    const secretInput = document.getElementById('api-secret-input');
    const statusEl = document.getElementById('status');
    const resultsContainer = document.getElementById('results-container');

    fetchBtn.addEventListener('click', async () => {
        const secretToken = secretInput.value.trim();
        if (!secretToken) {
            statusEl.textContent = 'Ошибка: Введите секретный ключ.';
            statusEl.className = 'error';
            return;
        }

        statusEl.textContent = 'Загрузка данных...';
        statusEl.className = '';
        resultsContainer.innerHTML = '';

        try {
            const response = await fetch('/api/stats', {
                headers: { 'Authorization': `Bearer ${secretToken}` }
            });

            if (response.status === 401) throw new Error('Неверный токен авторизации.');
            if (!response.ok) throw new Error(`Ошибка сервера: ${response.status}`);

            const stats = await response.json();
            const artists = Object.keys(stats);

            if (artists.length === 0) {
                statusEl.textContent = 'Данных о прослушиваниях пока нет.';
                return;
            }

            // Сортируем артистов по общему числу прослушиваний
            artists.sort((a, b) => stats[b].total_plays - stats[a].total_plays);

            artists.forEach(artistName => {
                const artistData = stats[artistName];
                const artistGroup = document.createElement('div');
                artistGroup.className = 'artist-group';

                const artistHeader = document.createElement('div');
                artistHeader.className = 'artist-header';
                artistHeader.innerHTML = `<span class="artist-name">${artistName}</span> <span class="total-plays">Всего прослушиваний: ${artistData.total_plays}</span>`;
                
                const albumList = document.createElement('div');
                albumList.className = 'album-list';
                
                // Сортируем альбомы по числу прослушиваний
                const sortedAlbums = Object.keys(artistData.albums)
                    .sort((a, b) => artistData.albums[b].total_plays - artistData.albums[a].total_plays);

                sortedAlbums.forEach(albumName => {
                    const albumData = artistData.albums[albumName];
                    const albumGroup = document.createElement('div');
                    albumGroup.className = 'album-group';

                    const albumHeader = document.createElement('div');
                    albumHeader.className = 'album-header';
                    albumHeader.innerHTML = `<span class="album-name">${albumName}</span> <span class="total-plays">Прослушиваний: ${albumData.total_plays}</span>`;

                    const trackList = document.createElement('div');
                    trackList.className = 'track-list';
                    
                    albumData.tracks.forEach(track => {
                        trackList.innerHTML += `<div class="track-item"><span>${track.title}</span> <span>${track.plays}</span></div>`;
                    });

                    albumHeader.addEventListener('click', () => {
                        trackList.style.display = trackList.style.display === 'block' ? 'none' : 'block';
                    });

                    albumGroup.appendChild(albumHeader);
                    albumGroup.appendChild(trackList);
                    albumList.appendChild(albumGroup);
                });

                artistHeader.addEventListener('click', () => {
                    albumList.style.display = albumList.style.display === 'block' ? 'none' : 'block';
                });

                artistGroup.appendChild(artistHeader);
                artistGroup.appendChild(albumList);
                resultsContainer.appendChild(artistGroup);
            });

            statusEl.textContent = `Статистика успешно загружена. Всего артистов: ${artists.length}.`;

        } catch (error) {
            statusEl.textContent = `Ошибка: ${error.message}`;
            statusEl.className = 'error';
        }
    });
});
