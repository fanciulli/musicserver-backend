/*
 * Created on Sun Jun 07 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export type ChangePasswordRequest = {
  currentPassword: string;
  newPassword: string;
};

export const ChangePasswordRequestSchema = {
  body: {
    type: "object",
    required: ["currentPassword", "newPassword"],
    properties: {
      currentPassword: { type: "string", minLength: 8, maxLength: 64 },
      newPassword: { type: "string", minLength: 8, maxLength: 64 },
    },
  },
};
