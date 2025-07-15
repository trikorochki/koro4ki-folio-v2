# build_playlist.py - ОБНОВЛЕННАЯ ВЕРСИЯ С ПАРСИНГОМ НОМЕРОВ ТРЕКОВ

import os
import json
import re
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen import MutagenError

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
        "description_line1": "The blend of experimental hip-hop and riffs.",
        "description_line2": "A drop of common sense for your soul."
    },
    "trapkorochki": {
        "name": "TRAPKORO4KI",
        "image": "images/trapkorochki.jpg",
        "description_line1": "A fusion of noir trap and digital decadence.",
        "description_line2": "The architecture of the void for your veins."
    },
    "streetkorochki": {
        "name": "STREETKORO4KI",
        "image": "images/streetkorochki.jpg",
        "description_line1": "Satirical rap dismantling social pretenses.",
        "description_line2": "Fast-paced trap-drill with polyrhythmic chaos."
    }

  #  "echorochki": {
  #      "name": "ECHORO4KI",
  #      "image": "images/echorochki.jpg",
  #      "description_line1": "Militant 90s alternative rock anthem.",
  #      "description_line2": "May God rest your soul, Dolores O'Riordan."
  #  }
}

MUSIC_DIR = 'public/music'
OUTPUT_FILE = 'public/playlist-data.js'
# --- Конец конфигурации ---

def natural_sort_key(s):
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def get_audio_duration(file_path):
    """
    Получает длительность аудиофайла в секундах.
    Поддерживает MP3 и WAV.
    """
    try:
        if file_path.lower().endswith('.mp3'):
            audio = MP3(file_path)
        elif file_path.lower().endswith('.wav'):
            audio = WAVE(file_path)
        else:
            return 0  # Возвращаем 0 для неподдерживаемых форматов
        
        return int(audio.info.length)
        
    except MutagenError as e:
        print(f"      ОШИБКА MUTAGEN: Не удалось прочитать файл '{file_path}'. Ошибка: {e}")
        return 0
    except Exception as e:
        print(f"      ОБЩАЯ ОШИБКА: Не удалось обработать файл '{file_path}'. Ошибка: {e}")
        return 0

def parse_track_number_and_title(filename):
    """
    Извлекает номер трека и чистое название из имени файла.
    Поддерживает различные форматы нумерации.
    
    Args:
        filename (str): Имя файла с расширением
        
    Returns:
        tuple: (номер_трека, чистое_название, оригинальное_название)
    """
    title = os.path.splitext(filename)[0]  # Убираем расширение
    original_title = title
    
    # Паттерны для различных форматов номеров
    patterns = [
        r'^(\d{1,2})[\s\.\-_]+(.+)$',  # "01 Title" или "01. Title" или "01-Title" или "01_Title"
        r'^Track[\s]*(\d{1,2})[\s\.\-_]*(.+)$',  # "Track 01 Title" или "Track01 Title"
        r'^(\d{1,2})([A-Za-z].+)$',  # "01Title" (без разделителя, но с буквой после номера)
        r'^(\d{1,2})$',  # Только номер "01"
    ]
    
    for pattern in patterns:
        match = re.match(pattern, title.strip())
        if match:
            num = int(match.group(1))
            
            # Проверяем, есть ли название после номера
            if len(match.groups()) > 1 and match.group(2):
                clean_title = match.group(2).strip()
                # Убираем возможные дополнительные разделители в начале названия
                clean_title = re.sub(r'^[\s\.\-_]+', '', clean_title)
            else:
                # Если только номер, используем оригинальное название
                clean_title = title
            
            print(f"      Парсинг: '{original_title}' -> номер {num}, название '{clean_title}'")
            return num, clean_title, original_title
    
    # Если номер не найден, возвращаем None для автоматической нумерации
    print(f"      Парсинг: '{original_title}' -> номер не найден, будет автоматическая нумерация")
    return None, title, original_title

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
            
            artist_data[artist_id] = {**info, "albums": [], "eps": [], "demos": []}

            for release_folder_name in sorted(os.listdir(artist_path), key=natural_sort_key):
                release_path = os.path.join(artist_path, release_folder_name)
                if os.path.isdir(release_path):
                    album_obj = {"name": release_folder_name, "cover": None, "tracks": []}
                    track_files = sorted(os.listdir(release_path), key=natural_sort_key)
                    
                    # Собираем все аудиофайлы для правильной нумерации
                    audio_files = [f for f in track_files if f.lower().endswith(('.mp3', '.wav'))]

                    for index, f in enumerate(track_files):
                        url_path = os.path.join('music', artist_id, release_folder_name, f).replace("\\", "/")
                        
                        if f.lower() == 'cover.jpg':
                            album_obj["cover"] = url_path
                        elif f.lower().endswith(('.mp3', '.wav')):
                            # --- НОВАЯ ЛОГИКА: Парсим номер трека и название ---
                            parsed_num, clean_title, original_title = parse_track_number_and_title(f)
                            
                            # Если номер не найден, используем порядковый номер в списке аудиофайлов
                            if parsed_num is None:
                                audio_file_index = audio_files.index(f)
                                track_num = audio_file_index + 1
                            else:
                                track_num = parsed_num
                            
                            # Получаем длительность
                            full_file_path = os.path.join(release_path, f)
                            duration = get_audio_duration(full_file_path)
                            
                            # Создаем расширенный объект трека
                            track_obj = {
                                "num": track_num,
                                "title": clean_title,
                                "originalTitle": original_title,  # Для отладки и совместимости
                                "file": url_path,
                                "duration": duration
                            }
                            
                            album_obj["tracks"].append(track_obj)
                            print(f"    Трек {track_num}: '{clean_title}' ({duration}s)")
                    
                    # Сортируем треки по номерам для корректного порядка
                    if album_obj["tracks"]:
                        album_obj["tracks"].sort(key=lambda x: x["num"])
                        print(f"    Отсортировано {len(album_obj['tracks'])} треков по номерам")
                    
                    if album_obj["cover"] is None:
                        print(f"      ПРЕДУПРЕЖДЕНИЕ: Не найдена обложка для '{release_folder_name}'")

                    # Определяем тип релиза и добавляем в соответствующую категорию
                    if release_folder_name.lower().startswith('album.'):
                        album_obj['name'] = release_folder_name[len('album.'):].strip()
                        artist_data[artist_id]["albums"].append(album_obj)
                        print(f"    Найден альбом: {album_obj['name']}")
                    elif release_folder_name.lower().startswith('ep.'):
                        album_obj['name'] = release_folder_name[len('ep.'):].strip()
                        artist_data[artist_id]["eps"].append(album_obj)
                        print(f"    Найден EP: {album_obj['name']}")
                    elif release_folder_name.lower().startswith('demo.'):
                        album_obj['name'] = release_folder_name[len('demo.'):].strip()
                        artist_data[artist_id]["demos"].append(album_obj)
                        print(f"    Найдена демо-запись: {album_obj['name']}")
                    else:
                        print(f"      ПРЕДУПРЕЖДЕНИЕ: Папка '{release_folder_name}' не имеет корректного префикса. Пропущена.")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        js_content = f"window.artistData = {json.dumps(artist_data, indent=4, ensure_ascii=False)};"
        f.write(js_content)

    print(f"\nГотово! Файл '{OUTPUT_FILE}' успешно обновлен с точными данными о длительности треков и номерами.")

if __name__ == '__main__':
    create_playlist_data()
