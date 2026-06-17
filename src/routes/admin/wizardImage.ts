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
import { WizardImageSchema } from "../../types/api/wizards.js";
import { getWizardImagesFolder } from "../../utils/wizardLoader.js";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": MimeTypes.IMAGE_SVG_XML,
};

// TODO: Replace this and the albumart retrieval with a common solution.
export default class WizardImage extends Route {
  method = HttpMethods.GET;
  url = "/admin/wizards/images/:filename";
  schema = WizardImageSchema;
  requiresAuth = true;

  handler = async (request: any, response: any) => {
    const requested = String(request.params.filename ?? "");

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
