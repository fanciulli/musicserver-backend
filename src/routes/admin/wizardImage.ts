/*
 * Created on Tue Jun 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Route } from "../../types/route.js";
import { HttpHeaders, HttpMethods, MimeTypes } from "../../misc/constants.js";
import {
  WizardImageSchema,
  WIZARD_IMAGE_FILENAME_MAX_LENGTH,
  WIZARD_IMAGE_FILENAME_PATTERN,
} from "../../types/api/wizards.js";
import { getWizardImagesFolder } from "../../utils/wizardLoader.js";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": MimeTypes.IMAGE_PNG,
  ".jpg": MimeTypes.IMAGE_JPEG,
  ".jpeg": MimeTypes.IMAGE_JPEG,
  ".webp": MimeTypes.IMAGE_WEBP,
  ".gif": MimeTypes.IMAGE_GIF,
  ".svg": MimeTypes.IMAGE_SVG_XML,
};

const FILENAME_REGEX = new RegExp(WIZARD_IMAGE_FILENAME_PATTERN);

// TODO: Replace this and the albumart retrieval with a common solution.
export default class WizardImage extends Route {
  method = HttpMethods.GET;
  url = "/admin/wizards/images/:filename";
  schema = WizardImageSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const requested = String(request.params.filename ?? "");

    // Reject malformed file names (invalid characters or too long) before
    // touching the filesystem.
    if (
      requested.length > WIZARD_IMAGE_FILENAME_MAX_LENGTH ||
      !FILENAME_REGEX.test(requested)
    ) {
      return response.code(404).send();
    }

    // Guard against path traversal: only allow a bare file name resolved
    // inside the wizard images folder.
    const name = path.basename(requested);
    const folder = getWizardImagesFolder();
    const filePath = path.resolve(folder, name);
    if (name !== requested || !filePath.startsWith(folder + path.sep)) {
      return response.code(404).send();
    }

    try {
      const buffer = await readFile(filePath);
      const contentType =
        CONTENT_TYPE_BY_EXTENSION[path.extname(name).toLowerCase()] ??
        MimeTypes.APPLICATION_OCTET_STREAM;
      response.header(HttpHeaders.CONTENT_TYPE, contentType);
      return response.send(buffer);
    } catch {
      return response.code(404).send();
    }
  };
}
