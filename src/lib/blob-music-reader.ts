// src/lib/blob-music-reader.ts

import { list } from '@vercel/blob';
import { PlaylistData, Artist, Album, Track } from '@/types/music';
import { ARTIST_DATA } from '@/data/artists';

interface BlobFile {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

export async function generateBlobPlaylistData(): Promise<PlaylistData> {
  const artists: Record<string, Artist> = {};
  
  try {
    console.log('🔍 Scanning Vercel Blob Storage...');
    
    const blobFiles = await listBlobFiles();
    
    if (!blobFiles || blobFiles.length === 0) {
      console.log('⚠️ No files found in Blob Storage, using fallback data');
      return generateEmptyPlaylistData();
    }

    console.log(`📂 Found ${blobFiles.length} files in Blob Storage`);

    const artistFiles = groupFilesByArtist(blobFiles);
    
    for (const [artistId, files] of Object.entries(artistFiles)) {
      if (!ARTIST_DATA[artistId as keyof typeof ARTIST_DATA]) {
        console.log(`⚠️ Skipping unknown artist: ${artistId}`);
        continue;
      }

      const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
      
      artists[artistId] = {
        id: artistId,
        name: artistInfo.name,
        avatar: artistInfo.avatar,
        descriptionLine1: artistInfo.descriptionLine1,
        descriptionLine2: artistInfo.descriptionLine2,
        socialLinks: artistInfo.socialLinks,
        Albums: [],
        EPs: [],
        Demos: [],
      };

      console.log(`🎤 Processing artist: ${artistInfo.name}`);

      const releaseFiles = groupFilesByRelease(files);

      for (const [releaseFolderName, releaseFilesList] of Object.entries(releaseFiles)) {
        console.log(`  📀 Processing release: ${releaseFolderName}`);
        
        const { releaseType, cleanName } = parseReleaseTypeAndName(releaseFolderName);
        
        if (!releaseType) {
          console.log(`    ⚠️ WARNING: Folder '${releaseFolderName}' doesn't have correct prefix. Skipped.`);
          continue;
        }

        const album: Album = {
          id: `${artistId}_${cleanName.replace(/\s+/g, '_')}`,
          title: cleanName,
          type: releaseType,
          cover: '',
          tracks: [],
          artistId: artistId,
        };

        const sortedFiles = releaseFilesList.sort((a, b) => 
          naturalCompare(a.pathname, b.pathname)
        );

        const audioFiles = sortedFiles.filter(file => 
          /\.(mp3|wav|flac|m4a)$/i.test(file.pathname)
        );

        for (let i = 0; i < sortedFiles.length; i++) {
          const file = sortedFiles[i];
          const fileName = file.pathname.split('/').pop() || '';

          if (fileName.toLowerCase() === 'cover.jpg') {
            album.cover = `/api/music/${artistId}/${releaseFolderName}/${fileName}`;
            continue;
          }

          if (/\.(mp3|wav|flac|m4a)$/i.test(fileName)) {
            const { trackNumber, cleanTitle, originalTitle } = parseTrackNumberAndTitle(fileName);
            
            const finalTrackNumber = trackNumber !== null 
              ? trackNumber 
              : audioFiles.findIndex(af => af.pathname === file.pathname) + 1;

            // ✅ ОПТИМИЗИРОВАНО: Используем placeholder длительность для быстрой загрузки
            const track: Track = {
              id: `${artistId}_${cleanName}_${finalTrackNumber}`,
              number: finalTrackNumber,
              title: cleanTitle,
              originalTitle: originalTitle,
              file: `/api/music/${artistId}/${releaseFolderName}/${fileName}`,
              duration: '0:00', // Placeholder - будет обновлен при воспроизведении
              albumId: album.id,
              artistId: artistId,
            };

            album.tracks.push(track);
          }
        }

        album.tracks.sort((a, b) => a.number - b.number);

        if (album.tracks.length > 0) {
          artists[artistId][releaseType].push(album);
          console.log(`  ✅ Added ${releaseType.toLowerCase()}: ${cleanName} (${album.tracks.length} tracks)`);
        }
      }
    }

    const totalArtists = Object.keys(artists).length;
    const totalReleases = Object.values(artists).reduce((sum, artist) => 
      sum + artist.Albums.length + artist.EPs.length + artist.Demos.length, 0);
    const totalTracks = Object.values(artists).reduce((sum, artist) => {
      const releases = [...artist.Albums, ...artist.EPs, ...artist.Demos];
      return sum + releases.reduce((trackSum, release) => trackSum + release.tracks.length, 0);
    }, 0);
    
    console.log(`📊 Loaded ${totalArtists} artists, ${totalReleases} releases, ${totalTracks} tracks from Blob Storage`);
    
    return artists;
    
  } catch (error) {
    console.error('❌ Error reading from Blob Storage:', error);
    return generateEmptyPlaylistData();
  }
}

async function listBlobFiles(): Promise<BlobFile[]> {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error('BLOB_READ_WRITE_TOKEN environment variable is not set');
    }

    const { blobs } = await list({
      prefix: 'music/',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return blobs.map(blob => ({
      pathname: blob.pathname,
      url: blob.url,
      size: blob.size,
      uploadedAt: blob.uploadedAt,
    }));
    
  } catch (error) {
    console.error('❌ Error listing blob files:', error);
    throw error;
  }
}

function groupFilesByArtist(files: BlobFile[]): Record<string, BlobFile[]> {
  const artistFiles: Record<string, BlobFile[]> = {};
  
  files.forEach(file => {
    const pathParts = file.pathname.split('/');
    
    if (pathParts.length >= 4 && pathParts[0] === 'music') {
      const artistName = pathParts[1];
      
      if (!artistFiles[artistName]) {
        artistFiles[artistName] = [];
      }
      
      artistFiles[artistName].push(file);
    }
  });
  
  return artistFiles;
}

function groupFilesByRelease(files: BlobFile[]): Record<string, BlobFile[]> {
  const releaseFiles: Record<string, BlobFile[]> = {};
  
  files.forEach(file => {
    const pathParts = file.pathname.split('/');
    
    if (pathParts.length >= 4) {
      const releaseName = pathParts[2];
      
      if (!releaseFiles[releaseName]) {
        releaseFiles[releaseName] = [];
      }
      
      releaseFiles[releaseName].push(file);
    }
  });
  
  return releaseFiles;
}

function parseReleaseTypeAndName(releaseFolderName: string): {
  releaseType: 'Albums' | 'EPs' | 'Demos' | null;
  cleanName: string;
} {
  const lowerName = releaseFolderName.toLowerCase();
  
  if (lowerName.startsWith('album.')) {
    return {
      releaseType: 'Albums',
      cleanName: releaseFolderName.substring('album.'.length).trim()
    };
  } else if (lowerName.startsWith('ep.')) {
    return {
      releaseType: 'EPs',
      cleanName: releaseFolderName.substring('ep.'.length).trim()
    };
  } else if (lowerName.startsWith('demo.')) {
    return {
      releaseType: 'Demos',
      cleanName: releaseFolderName.substring('demo.'.length).trim()
    };
  }
  
  return {
    releaseType: null,
    cleanName: releaseFolderName
  };
}

function parseTrackNumberAndTitle(filename: string): {
  trackNumber: number | null;
  cleanTitle: string;
  originalTitle: string;
} {
  const title = filename.replace(/\.[^.]+$/, '');
  const originalTitle = title;
  
  const patterns = [
    /^(\d{1,2})[\s\.\-_]+(.+)$/,
    /^Track[\s]*(\d{1,2})[\s\.\-_]*(.+)$/,
    /^(\d{1,2})([A-Za-z].+)$/,
    /^(\d{1,2})$/
  ];
  
  for (const pattern of patterns) {
    const match = title.trim().match(pattern);
    if (match) {
      const num = parseInt(match[1]);
      let cleanTitle = match[2]?.trim() || title;
      
      cleanTitle = cleanTitle.replace(/^[\s\.\-_]+/, '');
      
      return {
        trackNumber: num,
        cleanTitle: cleanTitle || title,
        originalTitle: originalTitle
      };
    }
  }
  
  return {
    trackNumber: null,
    cleanTitle: title,
    originalTitle: originalTitle
  };
}

function naturalCompare(a: string, b: string): number {
  const parseNatural = (str: string) => {
    return str.split(/(\d+)/).map(part => 
      /^\d+$/.test(part) ? parseInt(part) : part.toLowerCase()
    );
  };
  
  const aParts = parseNatural(a);
  const bParts = parseNatural(b);
  const maxLength = Math.max(aParts.length, bParts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';
    
    if (typeof aPart === 'number' && typeof bPart === 'number') {
      if (aPart !== bPart) return aPart - bPart;
    } else {
      const aStr = String(aPart);
      const bStr = String(bPart);
      if (aStr !== bStr) return aStr.localeCompare(bStr);
    }
  }
  
  return 0;
}

function generateEmptyPlaylistData(): PlaylistData {
  const fallbackData: PlaylistData = {};
  
  Object.keys(ARTIST_DATA).forEach(artistId => {
    const artistInfo = ARTIST_DATA[artistId as keyof typeof ARTIST_DATA];
    fallbackData[artistId] = {
      id: artistId,
      name: artistInfo.name,
      avatar: artistInfo.avatar,
      descriptionLine1: artistInfo.descriptionLine1,
      descriptionLine2: artistInfo.descriptionLine2,
      socialLinks: artistInfo.socialLinks,
      Albums: [],
      EPs: [],
      Demos: [],
    };
  });
  
  console.log('📝 Created fallback artist structure with 0 tracks');
  return fallbackData;
}
