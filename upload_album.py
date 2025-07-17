# upload_album.py - Загрузка нового альбома

import os
import mimetypes
import dotenv
from vercel_blob import put
from dotenv import load_dotenv
from mutagen.mp3 import MP3
from mutagen.wave import WAVE
from mutagen import MutagenError

# Загрузка переменных окружения
dotenv.load_dotenv('.env.development.local')

MUSIC_DIR = 'music'

def get_audio_info(file_path):
    """
    Получить информацию об аудиофайле
    """
    try:
        if file_path.lower().endswith('.mp3'):
            audio = MP3(file_path)
            return {
                'duration': audio.info.length,
                'bitrate': audio.info.bitrate,
                'title': audio.get('TIT2', ['Unknown'])[0],
                'artist': audio.get('TPE1', ['Unknown'])[0],
                'album': audio.get('TALB', ['Unknown'])[0]
            }
        elif file_path.lower().endswith('.wav'):
            audio = WAVE(file_path)
            return {
                'duration': audio.info.length,
                'bitrate': audio.info.bitrate,
                'title': 'Unknown',
                'artist': 'Unknown',
                'album': 'Unknown'
            }
    except MutagenError:
        pass
    
    return None

def upload_album(local_album_path, target_blob_path=None):
    """
    Загрузить альбом в blob с подробной информацией
    """
    print(f"=== ЗАГРУЗКА АЛЬБОМА ===")
    print(f"Локальный путь: {local_album_path}")
    
    if not os.path.exists(local_album_path):
        print(f"❌ Папка '{local_album_path}' не найдена")
        return False
    
    # Собираем информацию о файлах
    audio_files = []
    for root, dirs, files in os.walk(local_album_path):
        for filename in files:
            if filename.startswith('.'):
                continue
            
            if filename.lower().endswith(('.mp3', '.wav', '.flac', '.m4a', '.ogg')):
                local_path = os.path.join(root, filename)
                audio_files.append({
                    'local_path': local_path,
                    'filename': filename,
                    'size': os.path.getsize(local_path)
                })
    
    if not audio_files:
        print(f"❌ Аудиофайлы не найдены в '{local_album_path}'")
        return False
    
    print(f"Найдено {len(audio_files)} аудиофайлов:")
    
    # Показываем информацию о файлах
    total_size = 0
    for file in audio_files:
        audio_info = get_audio_info(file['local_path'])
        size_mb = file['size'] / (1024 * 1024)
        total_size += file['size']
        
        print(f"  📁 {file['filename']} ({size_mb:.1f} MB)")
        if audio_info:
            duration_min = audio_info['duration'] / 60
            print(f"     🎵 {audio_info['title']} - {audio_info['artist']}")
            print(f"     ⏱️  {duration_min:.1f} мин, {audio_info['bitrate']} kbps")
    
    total_size_mb = total_size / (1024 * 1024)
    print(f"\n📊 Общий размер: {total_size_mb:.1f} MB")
    
    # Подтверждение загрузки
    confirm = input(f"\n✅ Загрузить {len(audio_files)} файлов? (y/N): ")
    if confirm.lower() != 'y':
        print("❌ Загрузка отменена")
        return False
    
    # Загружаем файлы
    uploaded_count = 0
    failed_count = 0
    
    for i, file in enumerate(audio_files, 1):
        # Определяем путь в blob
        if target_blob_path:
            blob_path = target_blob_path + '/' + file['filename']
        else:
            blob_path = file['local_path'].replace("\\", "/")
        
        print(f"\n[{i}/{len(audio_files)}] Загрузка: {file['filename']}")
        print(f"  Путь в blob: {blob_path}")
        
        try:
            with open(file['local_path'], 'rb') as f:
                file_content = f.read()
                
                content_type, _ = mimetypes.guess_type(file['local_path'])
                if content_type is None:
                    content_type = 'application/octet-stream'

                blob_result = put(blob_path, file_content, options={
                    'content_type': content_type,
                    'allowOverwrite': True
                })
                
                print(f"  ✅ Успешно! URL: {blob_result['url']}")
                uploaded_count += 1
                
        except Exception as e:
            print(f"  ❌ ОШИБКА: {e}")
            failed_count += 1
    
    print(f"\n=== РЕЗУЛЬТАТ ЗАГРУЗКИ ===")
    print(f"✅ Загружено: {uploaded_count}")
    print(f"❌ Ошибок: {failed_count}")
    print(f"📊 Общий размер: {total_size_mb:.1f} MB")
    
    if uploaded_count > 0:
        print("=== ЗАГРУЗКА ЗАВЕРШЕНА ===")
        return True
    else:
        print("=== ЗАГРУЗКА ПРОВАЛЕНА ===")
        return False

def upload_single_album_folder(album_folder_name, custom_blob_path=None):
    """
    Загрузить альбом из папки music/
    """
    local_path = os.path.join(MUSIC_DIR, album_folder_name)
    
    if custom_blob_path:
        blob_path = custom_blob_path
    else:
        blob_path = f"music/{album_folder_name}"
    
    return upload_album(local_path, blob_path)

if __name__ == '__main__':
    # Вариант 1: Загрузить альбом из папки music/
    upload_single_album_folder("nükorochki/Album. Grenzgänger")
    
    # Вариант 2: Загрузить альбом из произвольной папки
    # upload_album("C:/MyMusic/New Album", "music/artist/new_album")
    
    # Вариант 3: Загрузить с кастомным путем в blob
    # upload_single_album_folder("nükorochki/Album. Grenzgänger", "music/corrected_albums/grenzganger")
