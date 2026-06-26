import { promises as fs, constants as fsConstants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';

export const validateSlipStorageAtStartup = async (): Promise<void> => {
  const dir = env.SLIP_STORAGE_DIR;
  const isAbsolute = path.isAbsolute(dir);
  const isProd = env.NODE_ENV === 'production';

  if (isProd && !isAbsolute) {
    throw new Error(
      `SLIP_STORAGE_DIR must be an absolute path in production (got "${dir}"). ` +
        `On Railway, set it to "/data/slips" so uploads land on the persistent volume, ` +
        `not ephemeral container storage.`
    );
  }

  await fs.mkdir(dir, { recursive: true });
  await fs.access(dir, fsConstants.W_OK);

  const probe = path.join(dir, `.write-probe-${randomUUID()}`);
  await fs.writeFile(probe, '');
  await fs.unlink(probe);

  console.log(
    JSON.stringify({
      level: 'info',
      msg: 'slip.storage.ready',
      dir,
      absolute: isAbsolute,
    })
  );
};

export class SlipStorageError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'UNSUPPORTED_TYPE'
      | 'TOO_LARGE'
      | 'NOT_FOUND'
      | 'IO_ERROR'
  ) {
    super(message);
    this.name = 'SlipStorageError';
  }
}

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const ensureStorageDir = async (): Promise<void> => {
  await fs.mkdir(env.SLIP_STORAGE_DIR, { recursive: true });
};

export type SlipSaveInput = {
  buffer: Buffer;
  mime_type: string;
};

export type SlipSaveResult = {
  file_path: string;
  mime_type: string;
  size_bytes: number;
};

export const saveSlip = async (input: SlipSaveInput): Promise<SlipSaveResult> => {
  const ext = ALLOWED_MIME_TYPES[input.mime_type.toLowerCase()];
  if (ext === undefined) {
    throw new SlipStorageError(
      `Unsupported mime type: ${input.mime_type}`,
      'UNSUPPORTED_TYPE'
    );
  }
  if (input.buffer.length > env.SLIP_MAX_BYTES) {
    throw new SlipStorageError(
      `File too large: ${input.buffer.length} > ${env.SLIP_MAX_BYTES}`,
      'TOO_LARGE'
    );
  }

  await ensureStorageDir();
  const filename = `${randomUUID()}${ext}`;
  const filePath = path.join(env.SLIP_STORAGE_DIR, filename);

  try {
    await fs.writeFile(filePath, input.buffer);
  } catch (err) {
    throw new SlipStorageError(
      `Failed to write slip file: ${err instanceof Error ? err.message : String(err)}`,
      'IO_ERROR'
    );
  }

  return {
    file_path: filePath,
    mime_type: input.mime_type.toLowerCase(),
    size_bytes: input.buffer.length,
  };
};

export const readSlipBuffer = async (
  filePath: string
): Promise<Buffer> => {
  try {
    return await fs.readFile(filePath);
  } catch (err) {
    const isEnoent =
      err instanceof Error && 'code' in err && (err as { code: string }).code === 'ENOENT';
    throw new SlipStorageError(
      isEnoent
        ? `Slip not found: ${filePath}`
        : `Failed to read slip: ${err instanceof Error ? err.message : String(err)}`,
      isEnoent ? 'NOT_FOUND' : 'IO_ERROR'
    );
  }
};

export const deleteSlip = async (filePath: string): Promise<void> => {
  try {
    await fs.unlink(filePath);
  } catch (err) {
    const isEnoent =
      err instanceof Error && 'code' in err && (err as { code: string }).code === 'ENOENT';
    if (!isEnoent) {
      throw new SlipStorageError(
        `Failed to delete slip: ${err instanceof Error ? err.message : String(err)}`,
        'IO_ERROR'
      );
    }
  }
};
