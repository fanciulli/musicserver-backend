/*
 * Created on Tue Jun 16 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export type WizardStepResponse = {
  image: string;
  text: string;
};

export type WizardResponse = {
  id: string;
  steps: WizardStepResponse[];
};

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

export const WizardImageSchema = {
  params: {
    type: "object",
    required: ["filename"],
    properties: {
      filename: { type: "string" },
    },
  },
};
