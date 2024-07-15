import { google, drive_v3 } from "googleapis";
import config from "./config.json";
import fs from "node:fs";
import mime from "mime-types";

export const GAPI_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

const cred = config.google_service_account;
export const googleAuth = new google.auth.JWT({
  key: cred.private_key,
  email: cred.client_email,
  keyId: cred.private_key_id,
  scopes: GAPI_SCOPES,
});

export async function uploadFile(
  filePath: string,
  parentFolderId: string
): Promise<void> {
  const drive = google.drive({ version: "v3", auth: googleAuth });

  const fileParts = filePath.split("/");
  const fileName = fileParts.pop()!;
  let currentFolderId = parentFolderId;

  const mimeType = mime.lookup(filePath) || "application/octet-stream";

  for (const folder of fileParts) {
    currentFolderId = await getOrCreateFolder(drive, folder, currentFolderId);
  }

  const existingFileId = await findFileId(drive, fileName, currentFolderId);

  if (existingFileId) {
    await drive.files.update({
      fileId: existingFileId,
      media: {
        mimeType,
        body: fs.createReadStream(filePath),
      },
    });
  } else {
    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [currentFolderId],
      },
      media: {
        mimeType,
        body: fs.createReadStream(filePath),
      },
    });
  }
}

async function getOrCreateFolder(
  drive: drive_v3.Drive,
  folderName: string,
  parentFolderId: string
): Promise<string> {
  const existingFolder = await findFileId(
    drive,
    folderName,
    parentFolderId,
    "application/vnd.google-apps.folder"
  );

  if (existingFolder) {
    return existingFolder;
  }

  const folderMetadata = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
    parents: [parentFolderId],
  };

  const folder = await drive.files.create({
    requestBody: folderMetadata,
    fields: "id",
  });

  return folder.data.id!;
}

async function findFileId(
  drive: drive_v3.Drive,
  fileName: string,
  parentFolderId: string,
  mimeType?: string
): Promise<string | undefined | null> {
  const query =
    `name = '${fileName}' and '${parentFolderId}' in parents and trashed = false` +
    (mimeType ? ` and mimeType = '${mimeType}'` : "");
  const res = await drive.files.list({
    q: query,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }
  return undefined;
}
