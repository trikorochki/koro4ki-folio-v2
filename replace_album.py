# replace_album.py - Замена целого альбома исполнителя

import os
import mimetypes
import dotenv
from vercel_blob import put, list as blob_list, delete
from dotenv import load_dotenv
import urllib.parse

# Загрузка переменных окружения
dotenv.load_dotenv('.env.development.local')

MUSIC_DIR = 'music'

def find_album_files_in_blob(artist_name, album_name):
    """
    Найти все файлы альбома в blob по имени исполнителя и альбома
    """
    try:
        blobs = blob_list({'limit': '1000'})
        album_files = []
        
        for blob in blobs['blobs']:
            # Декодируем URL-encoded путь
            decoded_path = urllib.parse.unquote(blob['pathname'])
            
            # Проверяем, содержит ли путь имя исполнителя и альбома
            if artist_name.lower() in decoded_path.lower() and album_name.lower() in decoded_path.lower():
                album_files.append({
                    'pathname': blob['pathname'],
                    'decoded_path': decoded_path,
                    'url': blob['url'],
                    'size': blob['size']
                })
        
        return album_files
    except Exception as e:
        print(f"❌ Ошибка поиска альбома: {e}")
        return []

def delete_album_from_blob(artist_name, album_name):
    """
    Удалить все файлы альбома из blob
    """
    print(f"--- Удаление альбома '{album_name}' исполнителя '{artist_name}' ---")
    
    album_files = find_album_files_in_blob(artist_name, album_name)
    
    if not album_files:
        print(f"❌ Альбом не найден в blob")
        return False
    
    print(f"Найдено {len(album_files)} файлов для удаления:")
    for file in album_files:
        print(f"  - {file['decoded_path']}")
    
    # Удаляем все файлы
    deleted_count = 0
    for file in album_files:
        try:
            delete(file['url'])
            print(f"✅ Удален: {file['decoded_path']}")
            deleted_count += 1
        except Exception as e:
            print(f"❌ Ошибка удаления {file['decoded_path']}: {e}")
    
    print(f"Удалено {deleted_count} из {len(album_files)} файлов")
    return deleted_count > 0

def upload_album_to_blob(local_album_path):
    """
    Загрузить альбом в blob
    """
    print(f"--- Загрузка альбома из '{local_album_path}' ---")
    
    if not os.path.exists(local_album_path):
        print(f"❌ Папка '{local_album_path}' не найдена")
        return False
    
    uploaded_count = 0
    total_files = 0
    
    # Проходим по всем файлам в папке альбома
    for root, dirs, files in os.walk(local_album_path):
        for filename in files:
            if filename.startswith('.'):
                continue
            
            # Поддерживаем только аудиофайлы
            if not filename.lower().endswith(('.mp3', '.wav', '.flac', '.m4a', '.ogg')):
                continue
            
            total_files += 1
            local_path = os.path.join(root, filename)
            blob_path = local_path.replace("\\", "/")
            
            print(f"  Загрузка: {local_path} -> {blob_path}")
            
            try:
                with open(local_path, 'rb') as f:
                    file_content = f.read()
                    
                    content_type, _ = mimetypes.guess_type(local_path)
                    if content_type is None:
                        content_type = 'application/octet-stream'

                    blob_result = put(blob_path, file_content, options={
                        'content_type': content_type,
                        'allowOverwrite': True
                    })
                    
                    print(f"    ✅ Успешно! URL: {blob_result['url']}")
                    uploaded_count += 1
                    
            except Exception as e:
                print(f"    ❌ ОШИБКА: {e}")
    
    print(f"Загружено {uploaded_count} из {total_files} файлов")
    return uploaded_count > 0

def replace_album(artist_name, album_name, new_local_album_path):
    """
    Заменить альбом: удалить старый и загрузить новый
    """
    print(f"=== ЗАМЕНА АЛЬБОМА ===")
    print(f"Исполнитель: {artist_name}")
    print(f"Альбом: {album_name}")
    print(f"Новый путь: {new_local_album_path}")
    print()
    
    # Шаг 1: Удаляем старый альбом
    if delete_album_from_blob(artist_name, album_name):
        print("✅ Старый альбом успешно удален")
    else:
        print("⚠️  Старый альбом не найден или не удален")
    
    print()
    
    # Шаг 2: Загружаем новый альбом
    if upload_album_to_blob(new_local_album_path):
        print("✅ Новый альбом успешно загружен")
        print("=== ЗАМЕНА ЗАВЕРШЕНА ===")
        return True
    else:
        print("❌ Ошибка загрузки нового альбома")
        print("=== ЗАМЕНА ПРОВАЛЕНА ===")
        return False

if __name__ == '__main__':
    # Пример использования
    replace_album(
        artist_name="nükorochki",
        album_name="Grenzgänger",
        new_local_album_path="music/nükorochki/Album. Grenzgänger - Fixed"
    )
