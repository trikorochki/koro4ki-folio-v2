# delete_album.py - Удаление альбома из blob

import os
import dotenv
from vercel_blob import list as blob_list, delete
from dotenv import load_dotenv
import urllib.parse

# Загрузка переменных окружения
dotenv.load_dotenv('.env.development.local')

def find_album_files_in_blob(artist_name, album_name):
    """
    Найти все файлы альбома в blob
    """
    try:
        blobs = blob_list({'limit': '1000'})
        album_files = []
        
        for blob in blobs['blobs']:
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

def delete_album_by_pattern(search_pattern):
    """
    Удалить файлы по паттерну поиска
    """
    print(f"--- Удаление файлов по паттерну: '{search_pattern}' ---")
    
    try:
        blobs = blob_list({'limit': '1000'})
        matching_files = []
        
        for blob in blobs['blobs']:
            decoded_path = urllib.parse.unquote(blob['pathname'])
            
            if search_pattern.lower() in decoded_path.lower():
                matching_files.append({
                    'pathname': blob['pathname'],
                    'decoded_path': decoded_path,
                    'url': blob['url']
                })
        
        if not matching_files:
            print(f"❌ Файлы не найдены по паттерну '{search_pattern}'")
            return False
        
        print(f"Найдено {len(matching_files)} файлов:")
        for file in matching_files:
            print(f"  - {file['decoded_path']}")
        
        # Подтверждение удаления
        confirm = input(f"\n⚠️  Удалить {len(matching_files)} файлов? (y/N): ")
        if confirm.lower() != 'y':
            print("❌ Удаление отменено")
            return False
        
        # Удаляем файлы
        deleted_count = 0
        for file in matching_files:
            try:
                delete(file['url'])
                print(f"✅ Удален: {file['decoded_path']}")
                deleted_count += 1
            except Exception as e:
                print(f"❌ Ошибка удаления {file['decoded_path']}: {e}")
        
        print(f"\n✅ Удалено {deleted_count} из {len(matching_files)} файлов")
        return deleted_count > 0
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        return False

def delete_album(artist_name, album_name):
    """
    Удалить конкретный альбом
    """
    print(f"=== УДАЛЕНИЕ АЛЬБОМА ===")
    print(f"Исполнитель: {artist_name}")
    print(f"Альбом: {album_name}")
    
    album_files = find_album_files_in_blob(artist_name, album_name)
    
    if not album_files:
        print(f"❌ Альбом не найден")
        return False
    
    print(f"\nНайдено {len(album_files)} файлов:")
    for file in album_files:
        print(f"  - {file['decoded_path']}")
    
    # Подтверждение удаления
    confirm = input(f"\n⚠️  Удалить весь альбом ({len(album_files)} файлов)? (y/N): ")
    if confirm.lower() != 'y':
        print("❌ Удаление отменено")
        return False
    
    # Удаляем все файлы альбома
    deleted_count = 0
    for file in album_files:
        try:
            delete(file['url'])
            print(f"✅ Удален: {file['decoded_path']}")
            deleted_count += 1
        except Exception as e:
            print(f"❌ Ошибка удаления {file['decoded_path']}: {e}")
    
    print(f"\n✅ Удалено {deleted_count} из {len(album_files)} файлов")
    print("=== УДАЛЕНИЕ ЗАВЕРШЕНО ===")
    return deleted_count > 0

def list_albums():
    """
    Показать список всех альбомов в blob
    """
    print("=== СПИСОК АЛЬБОМОВ В BLOB ===")
    
    try:
        blobs = blob_list({'limit': '1000'})
        albums = set()
        
        for blob in blobs['blobs']:
            decoded_path = urllib.parse.unquote(blob['pathname'])
            
            # Пытаемся извлечь исполнителя и альбом из пути
            parts = decoded_path.split('/')
            if len(parts) >= 3 and parts[0] == 'music':
                artist = parts[1]
                album = parts[2] if len(parts) > 2 else 'Unknown Album'
                albums.add(f"{artist} - {album}")
        
        if albums:
            print(f"Найдено {len(albums)} альбомов:")
            for album in sorted(albums):
                print(f"  - {album}")
        else:
            print("❌ Альбомы не найдены")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == '__main__':
    # Показать список альбомов
    list_albums()
    
    print("\n" + "="*50 + "\n")
    
    # Удалить конкретный альбом
    delete_album(
        artist_name="nükorochki",
        album_name="Demo. Grenzgänger"
    )
    
    # Или удалить по паттерну (закомментировано)
    # delete_album_by_pattern("nükorochki")
