import fs from "node:fs/promises";
import c from "./config.json";
import { normalize, join, dirname, basename } from "node:path";

const config = (await Bun.file(
  process.env.CONFIG_PATH || "./config.json"
).json()) as typeof c;

if (!config.osu_folder_path || !config.copy_to) {
  throw new Error(
    "osu_folder_path and copy_to should be configured in config.json"
  );
}

const listener = fs.watch(config.osu_folder_path, { recursive: true });
let timeout: Timer;

const filesToTrack = new Set<string>(
  (config.files_to_track || []).map((file) => {
    return normalize(file);
  })
);

// for saving files like collections.db, which can be generated again unlike replays which can be generated from reply files so saving all snapshots
const storeInVersions = new Set<string>(
  (config.save_in_versions || []).map((file) => {
    return normalize(file);
  })
);

for await (const file of listener) {
  if (!file.filename) {
    continue;
  }

  if (await includes(filesToTrack, file.filename)) {
    await copyFile(file.filename);
  }

  if (await includes(storeInVersions, file.filename)) {
    await createFile(file.filename);
  }
}

async function copyFile(filename: string) {
  const filePath = join(config.osu_folder_path, filename);
  const destinationPath = join(config.copy_to, filename);

  if (!(await fs.exists(dirname(destinationPath)))) {
    await fs.mkdir(dirname(destinationPath), { recursive: true });
  }

  if ((await fs.exists(filePath)) && (await fs.readFile(filePath)).length) {
    await fs.copyFile(filePath, destinationPath, fs.constants.COPYFILE_FICLONE);
  }
}

async function createFile(filename: string) {
  // for preventing multiple file write
  clearTimeout(timeout);
  timeout = setTimeout(async () => {
    const filePath = join(config.osu_folder_path, filename);
    const fileFullName = basename(filename);
    const [fileName, ext] = fileFullName.split(".");
    const versionFolder = join(config.copy_to, "versions", fileName);

    const ver = (await fs.exists(versionFolder))
      ? (await fs.readdir(versionFolder)).length
      : null;

    const verFileName = `${join(versionFolder)}/${fileName}_v${
      ver || 0
    }.${ext}`;

    if (!ver) {
      await fs.mkdir(dirname(verFileName), { recursive: true });
    }

    await fs.copyFile(filePath, verFileName, fs.constants.COPYFILE_FICLONE);
  }, 500);
}

async function includes(source: Set<string>, value: string) {
  const file = dirname(value) == "." ? value : dirname(value);
  return source.has(normalize(file));
}
