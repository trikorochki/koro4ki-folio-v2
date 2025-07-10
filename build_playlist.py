import os
import json
import re

# --- Конфигурация ---
ARTIST_INFO = {
    "flowkorochki": {
        "name": "FLOWKORO4KI",
        "image": "images/flowkorochki.jpg",
        "description_line1": "Sarcastic and philosophical hip-hop.",
        "description_line2": "Exploring the boundaries of reality and absurdity."
    },
    "psykorochki": {
        "name": "PSYKORO4KI",
        "image": "images/psykorochki.jpg",
        "description_line1": "Break-electro-punk-inverted-cyber-hip-hop.",
        "description_line2": "Musical chaos for the digital world."
    },
    "riffkorochki": {
        "name": "RIFFKORO4KI",
        "image": "images/riffkorochki.jpg",
        "description_line1": "The blend of experimental hip-hop and nu metal.",
        "description_line2": "A drop of common sense for your soul."
    }
}

MUSIC_DIR = 'public/music'
OUTPUT_FILE = 'public/playlist-data.js'
# --- Конец конфигурации ---

def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def create_playlist_data():
    artist_data = {}
    print(f"Сканирую директорию: {MUSIC_DIR}")

    if not os.path.exists(MUSIC_DIR):
        print(f"ОШИБКА: Директория {MUSIC_DIR} не найдена.")
        return

    for artist_id in sorted(os.listdir(MUSIC_DIR), key=natural_sort_key):
        artist_path = os.path.join(MUSIC_DIR, artist_id)
        if os.path.isdir(artist_path):
            print(f"  Найден артист: {artist_id}")
            
            info = ARTIST_INFO.get(artist_id, {
                "name": artist_id.upper(), "image": "images/default_avatar.jpg",
                "description_line1": "", "description_line2": ""
            })
            
            # Инициализируем списки для всех трех категорий
            artist_data[artist_id] = {**info, "albums": [], "eps": [], "demos": []}

            for release_folder_name in sorted(os.listdir(artist_path), key=natural_sort_key):
                release_path = os.path.join(artist_path, release_folder_name)
                if os.path.isdir(release_path):
                    album_obj = {"name": release_folder_name, "cover": None, "tracks": []}
                    track_files = sorted(os.listdir(release_path), key=natural_sort_key)

                    for f in track_files:
                        url_path = os.path.join('music', artist_id, release_folder_name, f).replace("\\", "/")
                        if f.lower() == 'cover.jpg':
                            album_obj["cover"] = url_path
                        elif f.lower().endswith(('.mp3', '.wav')):
                            track_title = os.path.splitext(f)[0]
                            album_obj["tracks"].append({"title": track_title, "file": url_path})
                    
                    if album_obj["cover"] is None:
                        print(f"      ПРЕДУПРЕЖДЕНИЕ: Не найдена обложка для '{release_folder_name}'")

                    # Распределяем по категориям
                    if release_folder_name.lower().startswith('album.'):
                        album_obj['name'] = release_folder_name[len('album.'):].strip()
                        artist_data[artist_id]["albums"].append(album_obj)
                        print(f"    Найден альбом: {album_obj['name']}")
                    elif release_folder_name.lower().startswith('ep.'):
                        album_obj['name'] = release_folder_name[len('ep.'):].strip()
                        artist_data[artist_id]["eps"].append(album_obj)
                        print(f"    Найден EP: {album_obj['name']}")
                    elif release_folder_name.lower().startswith('demo.'): # Новое правило
                        album_obj['name'] = release_folder_name[len('demo.'):].strip()
                        artist_data[artist_id]["demos"].append(album_obj)
                        print(f"    Найдена демо-запись: {album_obj['name']}")
                    else:
                        print(f"      ПРЕДУПРЕЖДЕНИЕ: Папка '{release_folder_name}' не имеет корректного префикса. Пропущена.")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        js_content = f"window.artistData = {json.dumps(artist_data, indent=4, ensure_ascii=False)};"
        f.write(js_content)

    print(f"\nГотово! Файл '{OUTPUT_FILE}' успешно обновлен.")

if __name__ == '__main__':
    create_playlist_data()
