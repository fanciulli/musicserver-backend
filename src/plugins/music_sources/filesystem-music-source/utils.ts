import { Folder } from "../../../types/api/folder.js";
import { BrowseType, BrowseResponse } from "../../../types/api/browse.js";

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
