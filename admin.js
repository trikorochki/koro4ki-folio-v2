document.addEventListener('DOMContentLoaded', () => {
    const fetchBtn = document.getElementById('fetch-stats-btn');
    const secretInput = document.getElementById('api-secret-input');
    const statusEl = document.getElementById('status');
    const resultsTable = document.getElementById('results-table');
    const resultsTbody = document.getElementById('results-tbody');

    fetchBtn.addEventListener('click', async () => {
        const secretToken = secretInput.value.trim();

        if (!secretToken) {
            statusEl.textContent = 'Ошибка: Введите секретный ключ.';
            statusEl.className = 'error';
            return;
        }

        statusEl.textContent = 'Загрузка данных...';
        statusEl.className = '';
        resultsTable.style.display = 'none';
        resultsTbody.innerHTML = '';

        try {
            const response = await fetch('/api/stats', {
                headers: {
                    'Authorization': `Bearer ${secretToken}`
                }
            });

            if (response.status === 401) {
                throw new Error('Неверный токен авторизации.');
            }
            if (!response.ok) {
                throw new Error(`Ошибка сервера: ${response.status}`);
            }

            const stats = await response.json();
            
            // Преобразуем объект в массив, чтобы его можно было отсортировать
            const sortedStats = Object.entries(stats)
                .sort(([, playsA], [, playsB]) => playsB - playsA);

            if (sortedStats.length === 0) {
                statusEl.textContent = 'Данных о прослушиваниях пока нет.';
                return;
            }
            
            // Заполняем таблицу отсортированными данными
            sortedStats.forEach(([track, plays]) => {
                const row = resultsTbody.insertRow();
                const cellTrack = row.insertCell(0);
                const cellPlays = row.insertCell(1);
                cellTrack.textContent = track;
                cellPlays.textContent = plays;
            });

            resultsTable.style.display = 'table';
            statusEl.textContent = `Статистика успешно загружена. Всего треков: ${sortedStats.length}.`;

        } catch (error) {
            statusEl.textContent = `Ошибка: ${error.message}`;
            statusEl.className = 'error';
        }
    });
});
