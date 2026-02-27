import { Folder } from "../../../types/api/folder.js";
import { BrowseType, BrowseResponse } from "../../../types/api/browse.js";

/**
 * Creates a folder browse response by composing a child path from prefix and section.
 *
 * @param label Folder label shown to the client.
 * @param pathPrefix Base browse path.
 * @param pathSection Path segment appended to the prefix.
 * @returns A folder browse response.
 */
export function createBrowseResponseFolder(
  label: string,
  pathPrefix: string,
  pathSection: string,
): BrowseResponse {
  const folder = new Folder();
  folder.name = label;

  return new BrowseResponse(
    `${pathPrefix}/${pathSection}`,
    BrowseType.FOLDER,
    folder,
  );
}

/**
 * Creates one folder browse response for each provided letter.
 *
 * @param letters Collection of letters to expose as folder items.
 * @param prefix Base browse path used for each generated item.
 * @returns Folder browse responses for all letters.
 */
export function createBrowseReponseFolderForLetters(
  letters: string[],
  prefix: string,
): BrowseResponse[] {
  const resp = [];
  for (let letter of letters) {
    resp.push(createBrowseResponseFolder(letter, prefix, letter));
  }

  return resp;
}
