document.addEventListener('DOMContentLoaded', () => {
    // --- Логика для выпадающего меню "Our artists" ---
    const dropdownBtn = document.querySelector('.dropdown-btn');
    const dropdownContent = document.getElementById('artist-dropdown-menu');

    if (dropdownBtn && dropdownContent && typeof window.artistData !== 'undefined') {
        Object.keys(window.artistData).forEach(artistId => {
            const artist = window.artistData[artistId];
            const link = document.createElement('a');
            link.href = `artist.html?artist=${artistId}`;
            link.textContent = artist.name;
            dropdownContent.appendChild(link);
        });

        dropdownBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdownContent.classList.toggle('show');
        });

        window.addEventListener('click', (event) => {
            if (!event.target.matches('.dropdown-btn')) {
                if (dropdownContent.classList.contains('show')) {
                    dropdownContent.classList.remove('show');
                }
            }
        });
    }
});
