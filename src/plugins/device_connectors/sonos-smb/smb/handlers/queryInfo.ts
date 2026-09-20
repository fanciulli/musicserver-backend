/*
 * Created on Sat Sep 5 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { NtStatus, SMB2_FLAGS_SERVER_TO_REDIR, Smb2Command } from "../constants.js";
import { serializeHeader, type Smb2Header } from "../header.js";
import type { SmbSession } from "../session.js";

const OUTPUT_BUFFER_OFFSET = 72;

const FILE_ATTRIBUTE_READONLY = 0x00000001;
const FILE_ATTRIBUTE_DIRECTORY = 0x00000010;
const FILE_ATTRIBUTE_ARCHIVE = 0x00000020;

const INFO_TYPE_FILE = 0x01;
const INFO_TYPE_FILESYSTEM = 0x02;

const FILE_BASIC_INFORMATION = 0x04;
const FILE_STANDARD_INFORMATION = 0x05;
const FILE_INTERNAL_INFORMATION = 0x06;
const FILE_ALL_INFORMATION = 0x12;
const FILE_NETWORK_OPEN_INFORMATION = 0x22;

/** Read/list access reported to clients (read-only share). */
const READ_ACCESS_FLAGS = 0x001200a9;

const FILE_FS_VOLUME_INFORMATION = 0x01;
const FILE_FS_SIZE_INFORMATION = 0x03;
const FILE_FS_ATTRIBUTE_INFORMATION = 0x05;

const FILE_CASE_PRESERVED_NAMES = 0x00000002;
const FILE_UNICODE_ON_DISK = 0x00000004;
const FILE_READ_ONLY_VOLUME = 0x00080000;

const VOLUME_LABEL = "MusicServer";
const FILESYSTEM_NAME = "NTFS";

// Large fixed allocation-unit count reported for the (read-only) volume.
const TOTAL_ALLOCATION_UNITS = 0xffffffffn;

function buildResponseHeader(header: Smb2Header, status: number): Smb2Header {
  return {
    creditCharge: header.creditCharge,
    status,
    command: Smb2Command.QUERY_INFO,
    creditReqResp: 1,
    flags: header.flags | SMB2_FLAGS_SERVER_TO_REDIR,
    nextCommand: 0,
    messageId: header.messageId,
    treeId: header.treeId,
    sessionId: header.sessionId,
  };
}

function buildErrorResponse(header: Smb2Header, status: number): Buffer {
  const responseHeader = buildResponseHeader(header, status);
  const body = Buffer.from([9, 0, 0, 0]);
  return Buffer.concat([serializeHeader(responseHeader), body]);
}

function buildSuccessResponse(header: Smb2Header, info: Buffer): Buffer {
  const responseHeader = buildResponseHeader(header, NtStatus.SUCCESS);

  const body = Buffer.alloc(8);
  body.writeUInt16LE(9, 0);
  body.writeUInt16LE(OUTPUT_BUFFER_OFFSET, 2);
  body.writeUInt32LE(info.length, 4);

  return Buffer.concat([serializeHeader(responseHeader), body, info]);
}

function fileTimeNow(): bigint {
  return (BigInt(Date.now()) + 11644473600000n) * 10000n;
}

function buildFileBasicInformation(isDir: boolean): Buffer {
  // CreationTime(8) + LastAccessTime(8) + LastWriteTime(8) + ChangeTime(8) +
  // FileAttributes(4) + Reserved(4) = 40 bytes.
  const buf = Buffer.alloc(40);
  const fileTime = fileTimeNow();
  buf.writeBigUInt64LE(fileTime, 0); // CreationTime
  buf.writeBigUInt64LE(fileTime, 8); // LastAccessTime
  buf.writeBigUInt64LE(fileTime, 16); // LastWriteTime
  buf.writeBigUInt64LE(fileTime, 24); // ChangeTime
  const fileAttributes = isDir ? FILE_ATTRIBUTE_DIRECTORY : FILE_ATTRIBUTE_ARCHIVE | FILE_ATTRIBUTE_READONLY;
  buf.writeUInt32LE(fileAttributes, 32);
  buf.writeUInt32LE(0, 36); // Reserved (already zeroed by alloc)
  return buf;
}

function buildFileStandardInformation(size: number, isDir: boolean): Buffer {
  const buf = Buffer.alloc(24);
  const sizeBig = BigInt(size);
  buf.writeBigUInt64LE(sizeBig, 0); // AllocationSize
  buf.writeBigUInt64LE(sizeBig, 8); // EndOfFile
  buf.writeUInt32LE(1, 16); // NumberOfLinks
  buf.writeUInt8(0, 20); // DeletePending
  buf.writeUInt8(isDir ? 1 : 0, 21); // Directory
  buf.writeUInt16LE(0, 22); // Reserved
  return buf;
}

function buildFileNetworkOpenInformation(size: number, isDir: boolean): Buffer {
  const buf = Buffer.alloc(56);
  const fileTime = fileTimeNow();
  buf.writeBigUInt64LE(fileTime, 0); // CreationTime
  buf.writeBigUInt64LE(fileTime, 8); // LastAccessTime
  buf.writeBigUInt64LE(fileTime, 16); // LastWriteTime
  buf.writeBigUInt64LE(fileTime, 24); // ChangeTime
  const sizeBig = BigInt(size);
  buf.writeBigUInt64LE(sizeBig, 32); // AllocationSize
  buf.writeBigUInt64LE(sizeBig, 40); // EndOfFile
  const fileAttributes = isDir ? FILE_ATTRIBUTE_DIRECTORY : FILE_ATTRIBUTE_ARCHIVE | FILE_ATTRIBUTE_READONLY;
  buf.writeUInt32LE(fileAttributes, 48);
  buf.writeUInt32LE(0, 52); // Reserved
  return buf;
}

function buildFileInternalInformation(): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(0n, 0); // IndexNumber
  return buf;
}

/**
 * FILE_ALL_INFORMATION (MS-FSCC 2.4.2): a composite of Basic, Standard,
 * Internal, Ea, Access, Position, Mode, Alignment and Name information.
 * `name` is the object's path relative to the share, backslash-separated.
 */
function buildFileAllInformation(name: string, size: number, isDir: boolean): Buffer {
  const ea = Buffer.alloc(4); // EaSize = 0
  const access = Buffer.alloc(4);
  access.writeUInt32LE(READ_ACCESS_FLAGS, 0); // AccessFlags
  const position = Buffer.alloc(8); // CurrentByteOffset = 0
  const mode = Buffer.alloc(4); // Mode = 0
  const alignment = Buffer.alloc(4); // AlignmentRequirement = 0 (byte aligned)

  const nameBuf = Buffer.from(name, "utf16le");
  const nameInfo = Buffer.alloc(4 + nameBuf.length);
  nameInfo.writeUInt32LE(nameBuf.length, 0); // FileNameLength
  nameBuf.copy(nameInfo, 4);

  return Buffer.concat([
    buildFileBasicInformation(isDir), // 40
    buildFileStandardInformation(size, isDir), // 24
    buildFileInternalInformation(), // 8
    ea, // 4
    access, // 4
    position, // 8
    mode, // 4
    alignment, // 4
    nameInfo, // 4 + name
  ]);
}

function buildFileFsVolumeInformation(): Buffer {
  const labelBuf = Buffer.from(VOLUME_LABEL, "utf16le");
  const buf = Buffer.alloc(18 + labelBuf.length);
  const fileTime = fileTimeNow();
  buf.writeBigUInt64LE(fileTime, 0); // VolumeCreationTime
  buf.writeUInt32LE(0x12345678, 8); // VolumeSerialNumber
  buf.writeUInt32LE(labelBuf.length, 12); // VolumeLabelLength
  buf.writeUInt8(0, 16); // SupportsObjects
  buf.writeUInt8(0, 17); // Reserved
  labelBuf.copy(buf, 18);
  return buf;
}

function buildFileFsSizeInformation(): Buffer {
  const buf = Buffer.alloc(24);
  buf.writeBigUInt64LE(TOTAL_ALLOCATION_UNITS, 0); // TotalAllocationUnits
  buf.writeBigUInt64LE(0n, 8); // AvailableAllocationUnits (read-only volume)
  buf.writeUInt32LE(1, 16); // SectorsPerAllocationUnit
  buf.writeUInt32LE(512, 20); // BytesPerSector
  return buf;
}

function buildFileFsAttributeInformation(): Buffer {
  const nameBuf = Buffer.from(FILESYSTEM_NAME, "utf16le");
  const buf = Buffer.alloc(12 + nameBuf.length);
  const attributes = FILE_CASE_PRESERVED_NAMES | FILE_UNICODE_ON_DISK | FILE_READ_ONLY_VOLUME;
  buf.writeUInt32LE(attributes, 0); // FileSystemAttributes
  buf.writeUInt32LE(255, 4); // MaximumComponentNameLength
  buf.writeUInt32LE(nameBuf.length, 8); // FileSystemNameLength
  nameBuf.copy(buf, 12);
  return buf;
}

/**
 * Handles an SMB2 QUERY_INFO request for an already-open handle: returns
 * file information (basic/standard/network-open/internal) or filesystem
 * information (volume/size/attribute) as a serialized info blob. The
 * underlying library is read-only, so no SECURITY/QUOTA info is supported.
 */
export function handleQueryInfo(header: Smb2Header, body: Buffer, session: SmbSession): Buffer {
  const infoType = body.readUInt8(2);
  const fileInfoClass = body.readUInt8(3);
  const fileId = body.subarray(24, 40);

  const handle = session.handles.get(fileId.toString("hex"));
  if (handle === undefined) {
    return buildErrorResponse(header, NtStatus.INVALID_PARAMETER);
  }

  const isDir = handle.kind !== "song" && handle.kind !== "cover";
  const size = handle.size ?? 0;

  if (infoType === INFO_TYPE_FILE) {
    switch (fileInfoClass) {
      case FILE_BASIC_INFORMATION:
        return buildSuccessResponse(header, buildFileBasicInformation(isDir));
      case FILE_STANDARD_INFORMATION:
        return buildSuccessResponse(header, buildFileStandardInformation(size, isDir));
      case FILE_NETWORK_OPEN_INFORMATION:
        return buildSuccessResponse(header, buildFileNetworkOpenInformation(size, isDir));
      case FILE_INTERNAL_INFORMATION:
        return buildSuccessResponse(header, buildFileInternalInformation());
      case FILE_ALL_INFORMATION: {
        const name = handle.path ? `\\${handle.path.split("/").join("\\")}` : "\\";
        return buildSuccessResponse(
          header,
          buildFileAllInformation(name, size, isDir),
        );
      }
      default:
        return buildErrorResponse(header, NtStatus.INVALID_INFO_CLASS);
    }
  }

  if (infoType === INFO_TYPE_FILESYSTEM) {
    switch (fileInfoClass) {
      case FILE_FS_VOLUME_INFORMATION:
        return buildSuccessResponse(header, buildFileFsVolumeInformation());
      case FILE_FS_SIZE_INFORMATION:
        return buildSuccessResponse(header, buildFileFsSizeInformation());
      case FILE_FS_ATTRIBUTE_INFORMATION:
        return buildSuccessResponse(header, buildFileFsAttributeInformation());
      default:
        return buildErrorResponse(header, NtStatus.INVALID_INFO_CLASS);
    }
  }

  return buildErrorResponse(header, NtStatus.INVALID_INFO_CLASS);
}
