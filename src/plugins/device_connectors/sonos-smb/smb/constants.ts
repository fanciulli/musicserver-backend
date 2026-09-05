/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */

export const SMB2_MAGIC = Buffer.from([0xfe, 0x53, 0x4d, 0x42]);

export enum Smb2Command {
  NEGOTIATE = 0,
  SESSION_SETUP = 1,
  LOGOFF = 2,
  TREE_CONNECT = 3,
  TREE_DISCONNECT = 4,
  CREATE = 5,
  CLOSE = 6,
  FLUSH = 7,
  READ = 8,
  WRITE = 9,
  IOCTL = 0x0b,
  CANCEL = 0x0c,
  ECHO = 0x0d,
  QUERY_DIRECTORY = 0x0e,
  QUERY_INFO = 0x10,
  SET_INFO = 0x11,
}

export enum NtStatus {
  SUCCESS = 0x00000000,
  PENDING = 0x00000103,
  MORE_PROCESSING_REQUIRED = 0xc0000016,
  LOGON_FAILURE = 0xc000006d,
  NO_SUCH_FILE = 0xc000000f,
  OBJECT_NAME_NOT_FOUND = 0xc0000034,
  ACCESS_DENIED = 0xc0000022,
  NOT_SUPPORTED = 0xc00000bb,
  INVALID_PARAMETER = 0xc000000d,
  END_OF_FILE = 0xc0000011,
  INVALID_INFO_CLASS = 0xc0000103,
  NO_MORE_FILES = 0x80000006,
  BUFFER_OVERFLOW = 0x80000005,
}

/** Maximum bytes returned by a single READ response, also advertised in NEGOTIATE. */
export const MAX_READ_SIZE = 0x100000;

export const SMB2_FLAGS_SERVER_TO_REDIR = 0x00000001;
export const SMB2_FLAGS_ASYNC = 0x2;
export const SMB2_FLAGS_RELATED = 0x4;
export const SMB2_FLAGS_SIGNED = 0x8;

export const DIALECT_202 = 0x0202;
export const DIALECT_210 = 0x0210;
export const DIALECT_300 = 0x0300;
/**
 * SMB2 wildcard dialect (0x02FF). Returned in the SMB2 NEGOTIATE response
 * to a legacy SMB1 multi-protocol NEGOTIATE; the client then re-negotiates
 * with a proper SMB2 NEGOTIATE.
 */
export const DIALECT_WILDCARD = 0x02ff;
