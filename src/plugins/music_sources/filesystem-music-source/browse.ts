/*
 * Created on Fri Feb 27 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { BrowseResponse } from "../../../types/api/browse.js";
import {
  browseAlbums,
  browseAlbumsAll,
  browseAlbumsByLetter,
  browseAlbumsRoot,
} from "./albumsBrowse.js";
import {
  browseArtists,
  browseArtistsAll,
  browseArtistsByLetter,
  browseArtistsRoot,
} from "./artistsBrowse.js";
import {
  browseSongs,
  browseSongsAll,
  browseSongsAllAndSongId,
  browseSongsByLetter,
  browseSongsByLetterAndSongId,
  browseSongsRoot,
} from "./songsBrowse.js";

export async function browsePluginRoot(
  browseRoot: BrowseResponse[],
): Promise<BrowseResponse[]> {
  return browseRoot;
}

export {
  browseAlbums,
  browseAlbumsAll,
  browseAlbumsByLetter,
  browseAlbumsRoot,
  browseArtists,
  browseArtistsAll,
  browseArtistsByLetter,
  browseArtistsRoot,
  browseSongs,
  browseSongsAll,
  browseSongsAllAndSongId,
  browseSongsByLetter,
  browseSongsByLetterAndSongId,
  browseSongsRoot,
};
