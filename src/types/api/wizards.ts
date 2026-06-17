/*
 * Created on Tue Jun 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export const WizardNextSchema = {
  response: {
    200: {
      type: "object",
      required: ["id", "steps"],
      properties: {
        id: { type: "string" },
        steps: {
          type: "array",
          items: {
            type: "object",
            required: ["image", "text"],
            properties: {
              image: { type: "string" },
              text: { type: "string" },
            },
          },
        },
      },
    },
    204: { type: "null" },
  },
};

// Wizard image file names are restricted to letters, digits, dots, hyphens
// and underscores, and capped in length to keep the lookup to a single file
// inside the images folder.
export const WIZARD_IMAGE_FILENAME_MAX_LENGTH = 64;
export const WIZARD_IMAGE_FILENAME_PATTERN = "^[a-zA-Z0-9._-]+$";

export const WizardImageSchema = {
  params: {
    type: "object",
    required: ["filename"],
    properties: {
      filename: {
        type: "string",
        maxLength: WIZARD_IMAGE_FILENAME_MAX_LENGTH,
        pattern: WIZARD_IMAGE_FILENAME_PATTERN,
      },
    },
  },
};
