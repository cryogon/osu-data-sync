import config from "./config.json";
import fs from "node:fs";
import { join, dirname } from "node:path";
import { format } from "./utils/format";
import { uploadFile } from "./drive";

const osuFolder = config.osu_folder_path || "";
const filesToTrack = config.files_to_track || [];
const destinationPath = config.copy_to || "";
// let latestTaskId = "";

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

  console.log("listening", fileName);

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
      if (
        config.google_drive_parent_folder_id &&
        config.google_service_account
      ) {
        // FIXME: Some issue in queue where task is pausing indefinately for some reason
        // latestTaskId = loadTask(
        //   uploadFile,
        //   srcPath,
        //   config.google_drive_parent_folder_id
        // );

        uploadFile(srcPath, config.google_drive_parent_folder_id)
          .then(() => {
            console.log("uploaded", srcPath);
          })
          .catch((err) => {
            console.error("failed to upload:", srcPath, "err: ", err);
          });
      }

      fs.appendFileSync(
        "logs.txt",
        format("copied", srcPath, "---->", destPath, "\n")
      );
    } catch (err) {
      console.error("failed to copy file. err: ", err);
    }
  });
}
