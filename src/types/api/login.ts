/*
 * Created on Sun Jun 07 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginResponse = {
  token: string;
  expiresAt: string;
};

export const LoginRequestSchema = {
  body: {
    type: "object",
    required: ["username", "password"],
    properties: {
      username: { type: "string", minLength: 4, maxLength: 16 },
      password: { type: "string", minLength: 8, maxLength: 64 },
    },
  },
};
