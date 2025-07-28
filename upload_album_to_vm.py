#!/usr/bin/env python3
# upload_album_to_vm.py - Перезаливка альбомов на VM kr4.pro

import os
import subprocess
import sys
import glob
from pathlib import Path
import argparse
from datetime import datetime


# =================================
# КОНФИГУРАЦИЯ
# =================================

# Локальная директория с музыкой
LOCAL_MUSIC_DIR = '/Users/evgenyganshin/Projects/koro4ki_folio_2BAK/loc-music'

# Настройки сервера
VM_SERVER = 'trikorochki@proxy-kr4'
VM_MUSIC_PATH = '/home/trikorochki/dod.kr4/music'

# Поддерживаемые аудиоформаты
AUDIO_EXTENSIONS = ('.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac')

# Поддерживаемые форматы обложек
IMAGE_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.webp')


class ColorOutput:
    """Класс для цветного вывода в терминал"""
    
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'
    
    @staticmethod
    def print_success(message):
        print(f"{ColorOutput.GREEN}✅ {message}{ColorOutput.END}")
    
    @staticmethod
    def print_error(message):
        print(f"{ColorOutput.RED}❌ {message}{ColorOutput.END}")
    
    @staticmethod
    def print_warning(message):
        print(f"{ColorOutput.YELLOW}⚠️  {message}{ColorOutput.END}")
    
    @staticmethod
    def print_info(message):
        print(f"{ColorOutput.CYAN}ℹ️  {message}{ColorOutput.END}")
    
    @staticmethod
    def print_header(message):
        print(f"\n{ColorOutput.BOLD}{ColorOutput.BLUE}=== {message} ==={ColorOutput.END}")


def find_artists():
    """Найти всех доступных исполнителей в локальной директории"""
    if not os.path.exists(LOCAL_MUSIC_DIR):
        ColorOutput.print_error(f"Локальная директория музыки не найдена: {LOCAL_MUSIC_DIR}")
        return []
    
    artists = []
    for item in os.listdir(LOCAL_MUSIC_DIR):
        artist_path = os.path.join(LOCAL_MUSIC_DIR, item)
        if os.path.isdir(artist_path) and not item.startswith('.'):
            artists.append(item)
    
    return sorted(artists)


def find_albums(artist):
    """Найти все альбомы для указанного исполнителя"""
    artist_path = os.path.join(LOCAL_MUSIC_DIR, artist)
    
    if not os.path.exists(artist_path):
        return []
    
    albums = []
    for item in os.listdir(artist_path):
        album_path = os.path.join(artist_path, item)
        if os.path.isdir(album_path) and not item.startswith('.'):
            # Проверяем, есть ли аудиофайлы в альбоме
            has_audio = any(
                f.lower().endswith(AUDIO_EXTENSIONS) 
                for f in os.listdir(album_path) 
                if os.path.isfile(os.path.join(album_path, f))
            )
            if has_audio:
                albums.append(item)
    
    return sorted(albums)


def get_album_info(artist, album):
    """Получить подробную информацию об альбоме"""
    album_path = os.path.join(LOCAL_MUSIC_DIR, artist, album)
    
    if not os.path.exists(album_path):
        return None
    
    info = {
        'path': album_path,
        'audio_files': [],
        'image_files': [],
        'other_files': [],
        'total_size': 0,
        'cover_found': False
    }
    
    # Поиск файлов в альбоме
    for root, dirs, files in os.walk(album_path):
        for filename in files:
            if filename.startswith('.'):
                continue
            
            file_path = os.path.join(root, filename)
            file_size = os.path.getsize(file_path)
            info['total_size'] += file_size
            
            file_ext = filename.lower()
            
            if file_ext.endswith(AUDIO_EXTENSIONS):
                info['audio_files'].append({
                    'name': filename,
                    'path': file_path,
                    'size': file_size
                })
            elif file_ext.endswith(IMAGE_EXTENSIONS):
                info['image_files'].append({
                    'name': filename,
                    'path': file_path,
                    'size': file_size
                })
                
                # Проверяем, является ли это обложкой
                cover_names = ['cover', 'folder', 'album', 'front']
                if any(cover_name in filename.lower() for cover_name in cover_names):
                    info['cover_found'] = True
            else:
                info['other_files'].append({
                    'name': filename,
                    'path': file_path,
                    'size': file_size
                })
    
    return info


def display_album_info(artist, album, info):
    """Отобразить информацию об альбоме"""
    ColorOutput.print_header(f"ИНФОРМАЦИЯ ОБ АЛЬБОМЕ")
    
    print(f"{ColorOutput.BOLD}Исполнитель:{ColorOutput.END} {artist}")
    print(f"{ColorOutput.BOLD}Альбом:{ColorOutput.END} {album}")
    print(f"{ColorOutput.BOLD}Локальный путь:{ColorOutput.END} {info['path']}")
    
    total_size_mb = info['total_size'] / (1024 * 1024)
    total_files = len(info['audio_files']) + len(info['image_files']) + len(info['other_files'])
    
    print(f"\n📊 {ColorOutput.BOLD}Статистика:{ColorOutput.END}")
    print(f"  🎵 Аудиофайлов: {len(info['audio_files'])}")
    print(f"  🎨 Изображений: {len(info['image_files'])}")
    print(f"  📁 Других файлов: {len(info['other_files'])}")
    print(f"  📦 Общий размер: {total_size_mb:.1f} MB")
    print(f"  🎨 Обложка: {'✅ Найдена' if info['cover_found'] else '❌ Не найдена'}")
    
    if info['audio_files']:
        print(f"\n🎵 {ColorOutput.BOLD}Аудиофайлы:{ColorOutput.END}")
        for i, file in enumerate(info['audio_files'][:10], 1):  # Показываем первые 10
            size_mb = file['size'] / (1024 * 1024)
            print(f"  {i:2}. {file['name']} ({size_mb:.1f} MB)")
        
        if len(info['audio_files']) > 10:
            print(f"     ... и еще {len(info['audio_files']) - 10} файлов")
    
    if info['image_files']:
        print(f"\n🎨 {ColorOutput.BOLD}Изображения:{ColorOutput.END}")
        for file in info['image_files']:
            size_kb = file['size'] / 1024
            cover_mark = " 🎯" if any(cover_name in file['name'].lower() for cover_name in ['cover', 'folder', 'album']) else ""
            print(f"     {file['name']} ({size_kb:.1f} KB){cover_mark}")


def test_vm_connection():
    """Проверить подключение к VM"""
    ColorOutput.print_info("Проверка подключения к VM...")
    
    try:
        result = subprocess.run(
            ['ssh', VM_SERVER, 'echo "Подключение успешно"'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            ColorOutput.print_success("Подключение к VM установлено")
            return True
        else:
            ColorOutput.print_error(f"Ошибка подключения к VM: {result.stderr}")
            return False
    
    except subprocess.TimeoutExpired:
        ColorOutput.print_error("Таймаут подключения к VM")
        return False
    except Exception as e:
        ColorOutput.print_error(f"Ошибка при проверке подключения: {e}")
        return False


def create_vm_directory(artist, album):
    """Создать директорию на VM для альбома"""
    vm_album_path = f"{VM_MUSIC_PATH}/{artist}/{album}"
    
    ColorOutput.print_info(f"Создание директории на VM: {vm_album_path}")
    
    try:
        result = subprocess.run(
            ['ssh', VM_SERVER, f'mkdir -p "{vm_album_path}"'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            ColorOutput.print_success("Директория создана на VM")
            return True
        else:
            ColorOutput.print_error(f"Ошибка создания директории: {result.stderr}")
            return False
    
    except Exception as e:
        ColorOutput.print_error(f"Ошибка при создании директории: {e}")
        return False


def upload_album_to_vm(artist, album, info):
    """Загрузить альбом на VM используя rsync"""
    local_album_path = info['path']
    vm_album_path = f"{VM_MUSIC_PATH}/{artist}/{album}"
    
    ColorOutput.print_header("ЗАГРУЗКА АЛЬБОМА НА VM")
    
    # Подготавливаем команду rsync
    rsync_cmd = [
        'rsync',
        '-avz',
        '--progress',
        '--delete',
        '--human-readable',
        f"{local_album_path}/",  # Trailing slash важен!
        f"{VM_SERVER}:{vm_album_path}/"
    ]
    
    ColorOutput.print_info(f"Команда: {' '.join(rsync_cmd)}")
    ColorOutput.print_info(f"Локальный путь: {local_album_path}")
    ColorOutput.print_info(f"Удаленный путь: {vm_album_path}")
    
    print(f"\n{ColorOutput.YELLOW}🚀 Начинаю синхронизацию...{ColorOutput.END}")
    
    try:
        # Запускаем rsync с выводом в реальном времени
        process = subprocess.Popen(
            rsync_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            universal_newlines=True
        )
        
        # Читаем вывод построчно
        for line in process.stdout:
            line = line.strip()
            if line:
                # Фильтруем и форматируем вывод rsync
                if 'bytes/sec' in line or 'speedup' in line:
                    print(f"  📊 {line}")
                elif line.endswith('/'):
                    print(f"  📁 {line}")
                elif any(ext in line.lower() for ext in AUDIO_EXTENSIONS + IMAGE_EXTENSIONS):
                    print(f"  📤 {line}")
        
        # Ждем завершения процесса
        return_code = process.wait()
        
        if return_code == 0:
            ColorOutput.print_success("Альбом успешно загружен на VM!")
            return True
        else:
            ColorOutput.print_error(f"Ошибка загрузки (код: {return_code})")
            return False
    
    except Exception as e:
        ColorOutput.print_error(f"Ошибка при загрузке: {e}")
        return False


def verify_upload(artist, album, info):
    """Проверить успешность загрузки на VM"""
    vm_album_path = f"{VM_MUSIC_PATH}/{artist}/{album}"
    
    ColorOutput.print_info("Проверка загруженных файлов на VM...")
    
    try:
        # Подсчитываем файлы на VM
        result = subprocess.run(
            ['ssh', VM_SERVER, f'find "{vm_album_path}" -type f | wc -l'],
            capture_output=True,
            text=True,
            timeout=10
        )
        
        if result.returncode == 0:
            vm_file_count = int(result.stdout.strip())
            local_file_count = len(info['audio_files']) + len(info['image_files']) + len(info['other_files'])
            
            print(f"  📁 Файлов локально: {local_file_count}")
            print(f"  📁 Файлов на VM: {vm_file_count}")
            
            if vm_file_count == local_file_count:
                ColorOutput.print_success("Все файлы успешно загружены!")
                return True
            else:
                ColorOutput.print_warning(f"Количество файлов не совпадает")
                return False
        else:
            ColorOutput.print_error("Не удалось проверить файлы на VM")
            return False
    
    except Exception as e:
        ColorOutput.print_error(f"Ошибка при проверке: {e}")
        return False


def interactive_artist_selection():
    """Интерактивный выбор исполнителя"""
    artists = find_artists()
    
    if not artists:
        ColorOutput.print_error("Исполнители не найдены в локальной директории")
        return None
    
    ColorOutput.print_header("ВЫБОР ИСПОЛНИТЕЛЯ")
    
    for i, artist in enumerate(artists, 1):
        print(f"  {i:2}. {artist}")
    
    while True:
        try:
            choice = input(f"\n{ColorOutput.BOLD}Выберите исполнителя (1-{len(artists)}) или введите имя: {ColorOutput.END}")
            
            # Попробуем как номер
            if choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(artists):
                    return artists[idx]
                else:
                    ColorOutput.print_error(f"Неверный номер. Введите число от 1 до {len(artists)}")
                    continue
            
            # Попробуем как имя
            if choice in artists:
                return choice
            
            # Попробуем найти похожее имя
            matches = [artist for artist in artists if choice.lower() in artist.lower()]
            if len(matches) == 1:
                ColorOutput.print_info(f"Найден исполнитель: {matches[0]}")
                return matches[0]
            elif len(matches) > 1:
                ColorOutput.print_warning("Найдено несколько совпадений:")
                for match in matches:
                    print(f"  • {match}")
                continue
            
            ColorOutput.print_error("Исполнитель не найден. Попробуйте еще раз.")
        
        except KeyboardInterrupt:
            print("\n\nОтмена операции.")
            return None


def interactive_album_selection(artist):
    """Интерактивный выбор альбома"""
    albums = find_albums(artist)
    
    if not albums:
        ColorOutput.print_error(f"Альбомы не найдены для исполнителя: {artist}")
        return None
    
    ColorOutput.print_header(f"ВЫБОР АЛЬБОМА ДЛЯ {artist}")
    
    for i, album in enumerate(albums, 1):
        print(f"  {i:2}. {album}")
    
    while True:
        try:
            choice = input(f"\n{ColorOutput.BOLD}Выберите альбом (1-{len(albums)}) или введите название: {ColorOutput.END}")
            
            # Попробуем как номер
            if choice.isdigit():
                idx = int(choice) - 1
                if 0 <= idx < len(albums):
                    return albums[idx]
                else:
                    ColorOutput.print_error(f"Неверный номер. Введите число от 1 до {len(albums)}")
                    continue
            
            # Попробуем как название
            if choice in albums:
                return choice
            
            # Попробуем найти похожее название
            matches = [album for album in albums if choice.lower() in album.lower()]
            if len(matches) == 1:
                ColorOutput.print_info(f"Найден альбом: {matches[0]}")
                return matches[0]
            elif len(matches) > 1:
                ColorOutput.print_warning("Найдено несколько совпадений:")
                for match in matches:
                    print(f"  • {match}")
                continue
            
            ColorOutput.print_error("Альбом не найден. Попробуйте еще раз.")
        
        except KeyboardInterrupt:
            print("\n\nОтмена операции.")
            return None


def main():
    """Основная функция программы"""
    parser = argparse.ArgumentParser(description='Загрузка альбомов на VM kr4.pro')
    parser.add_argument('--artist', '-a', help='Имя исполнителя')
    parser.add_argument('--album', '-l', help='Название альбома')
    parser.add_argument('--list-artists', action='store_true', help='Показать список исполнителей')
    parser.add_argument('--list-albums', help='Показать альбомы для исполнителя')
    
    args = parser.parse_args()
    
    # Обработка аргументов командной строки
    if args.list_artists:
        artists = find_artists()
        ColorOutput.print_header("ДОСТУПНЫЕ ИСПОЛНИТЕЛИ")
        for artist in artists:
            print(f"  • {artist}")
        return
    
    if args.list_albums:
        albums = find_albums(args.list_albums)
        ColorOutput.print_header(f"АЛЬБОМЫ ИСПОЛНИТЕЛЯ: {args.list_albums}")
        for album in albums:
            print(f"  • {album}")
        return
    
    # Проверяем локальную директорию
    if not os.path.exists(LOCAL_MUSIC_DIR):
        ColorOutput.print_error(f"Локальная директория музыки не найдена: {LOCAL_MUSIC_DIR}")
        ColorOutput.print_info("Проверьте путь в переменной LOCAL_MUSIC_DIR")
        return
    
    ColorOutput.print_header("ЗАГРУЗЧИК АЛЬБОМОВ НА VM kr4.pro")
    print(f"Локальная директория: {LOCAL_MUSIC_DIR}")
    print(f"Сервер: {VM_SERVER}")
    print(f"Удаленная директория: {VM_MUSIC_PATH}")
    
    # Выбор исполнителя
    if args.artist:
        artist = args.artist
        if not os.path.exists(os.path.join(LOCAL_MUSIC_DIR, artist)):
            ColorOutput.print_error(f"Исполнитель '{artist}' не найден")
            return
    else:
        artist = interactive_artist_selection()
        if not artist:
            return
    
    # Выбор альбома
    if args.album:
        album = args.album
        if not os.path.exists(os.path.join(LOCAL_MUSIC_DIR, artist, album)):
            ColorOutput.print_error(f"Альбом '{album}' не найден у исполнителя '{artist}'")
            return
    else:
        album = interactive_album_selection(artist)
        if not album:
            return
    
    # Получение информации об альбоме
    info = get_album_info(artist, album)
    if not info:
        ColorOutput.print_error("Не удалось получить информацию об альбоме")
        return
    
    if not info['audio_files']:
        ColorOutput.print_error("В альбоме не найдены аудиофайлы")
        return
    
    # Отображение информации
    display_album_info(artist, album, info)
    
    # Подтверждение загрузки
    print(f"\n{ColorOutput.YELLOW}⚠️  ВНИМАНИЕ: Альбом будет ПОЛНОСТЬЮ ПЕРЕЗАПИСАН на сервере!{ColorOutput.END}")
    confirm = input(f"\n{ColorOutput.BOLD}Продолжить загрузку? (y/N): {ColorOutput.END}")
    
    if confirm.lower() not in ['y', 'yes', 'да']:
        ColorOutput.print_warning("Загрузка отменена пользователем")
        return
    
    # Проверка подключения к VM
    if not test_vm_connection():
        ColorOutput.print_error("Не удалось подключиться к VM")
        return
    
    # Создание директории на VM
    if not create_vm_directory(artist, album):
        ColorOutput.print_error("Не удалось создать директорию на VM")
        return
    
    # Загрузка альбома
    if upload_album_to_vm(artist, album, info):
        # Проверка загрузки
        verify_upload(artist, album, info)
        
        # Финальная информация
        ColorOutput.print_header("ЗАГРУЗКА ЗАВЕРШЕНА")
        ColorOutput.print_success(f"Альбом '{album}' исполнителя '{artist}' успешно загружен!")
        print(f"🌐 URL: https://dod.kr4.pro/music/{artist}/{album}/")
        
        # Время завершения
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"🕐 Время завершения: {current_time}")
    else:
        ColorOutput.print_error("Загрузка не удалась")


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n❌ Операция прервана пользователем")
        sys.exit(1)
    except Exception as e:
        ColorOutput.print_error(f"Критическая ошибка: {e}")
        sys.exit(1)
