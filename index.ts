import config from "./config.json";
import fs from "node:fs";
import { join, dirname } from "node:path";
import { format } from "./utils/format";

const osuFolder = config.osu_folder_path || "";
const filesToTrack = config.files_to_track || [];
const destinationPath = config.copy_to || "";

for (const fileName of filesToTrack) {
  const file = join(osuFolder, fileName);

  if (!fs.existsSync(file)) {
    console.error(file, "doesn't exists");
    continue;
  }

  const listener = fs.watch(file, {
    recursive: true,
    encoding: "buffer",
  });

  listener.on("change", (_, flName) => {
    try {
      const srcPath = fs.statSync(file).isFile()
        ? file
        : join(file, flName.toString());

      const destPath = fs.statSync(file).isFile()
        ? join(destinationPath, fileName)
        : join(destinationPath, fileName, flName.toString());

      if (!fs.existsSync(dirname(destPath))) {
        fs.mkdirSync(dirname(destPath), { recursive: true });
      }

      fs.copyFileSync(srcPath, destPath, fs.constants.COPYFILE_FICLONE);
      fs.appendFileSync(
        "logs.txt",
        format("copied", srcPath, "---->", destPath, "\n")
      );
    } catch (err) {
      console.error("failed to copy file. err: ", err);
    }
  });
}
