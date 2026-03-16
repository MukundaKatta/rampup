import { google, drive_v3 } from "googleapis";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  size: number;
  createdTime: string;
  modifiedTime: string;
}

export interface DriveFileContent {
  id: string;
  name: string;
  mimeType: string;
  textContent: string;
}

export class GoogleDriveClient {
  private drive: drive_v3.Drive;

  constructor(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    this.drive = google.drive({ version: "v3", auth });
  }

  async listFiles(
    folderId?: string,
    mimeTypes?: string[],
    pageSize: number = 50
  ): Promise<DriveFile[]> {
    const queries: string[] = ["trashed = false"];

    if (folderId) {
      queries.push(`'${folderId}' in parents`);
    }

    if (mimeTypes && mimeTypes.length > 0) {
      const mimeQuery = mimeTypes.map((m) => `mimeType = '${m}'`).join(" or ");
      queries.push(`(${mimeQuery})`);
    }

    const response = await this.drive.files.list({
      q: queries.join(" and "),
      pageSize,
      fields: "files(id, name, mimeType, webViewLink, size, createdTime, modifiedTime)",
      orderBy: "modifiedTime desc",
    });

    return (response.data.files || []).map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      webViewLink: f.webViewLink || "",
      size: parseInt(f.size || "0"),
      createdTime: f.createdTime || "",
      modifiedTime: f.modifiedTime || "",
    }));
  }

  async listDocuments(folderId?: string): Promise<DriveFile[]> {
    return this.listFiles(folderId, [
      "application/vnd.google-apps.document",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/markdown",
    ]);
  }

  async getFileContent(fileId: string): Promise<DriveFileContent> {
    // Get file metadata
    const metadata = await this.drive.files.get({
      fileId,
      fields: "id, name, mimeType",
    });

    const mimeType = metadata.data.mimeType || "";
    let textContent = "";

    if (mimeType === "application/vnd.google-apps.document") {
      // Export Google Docs as plain text
      const exported = await this.drive.files.export({
        fileId,
        mimeType: "text/plain",
      });
      textContent = exported.data as string;
    } else if (mimeType === "application/vnd.google-apps.spreadsheet") {
      const exported = await this.drive.files.export({
        fileId,
        mimeType: "text/csv",
      });
      textContent = exported.data as string;
    } else if (mimeType === "application/vnd.google-apps.presentation") {
      const exported = await this.drive.files.export({
        fileId,
        mimeType: "text/plain",
      });
      textContent = exported.data as string;
    } else if (mimeType.startsWith("text/")) {
      // Download text files directly
      const response = await this.drive.files.get(
        { fileId, alt: "media" },
        { responseType: "text" }
      );
      textContent = response.data as string;
    } else {
      // For binary files (PDF, DOCX), download and note that processing is needed
      textContent = `[Binary file: ${metadata.data.name}. Content extraction requires document processing.]`;
    }

    return {
      id: fileId,
      name: metadata.data.name || "",
      mimeType,
      textContent,
    };
  }

  async importFolder(folderId: string): Promise<DriveFileContent[]> {
    const files = await this.listDocuments(folderId);
    const contents: DriveFileContent[] = [];

    for (const file of files) {
      try {
        const content = await this.getFileContent(file.id);
        contents.push(content);
      } catch (error) {
        console.error(`Failed to import ${file.name}: ${error}`);
      }
    }

    return contents;
  }

  async searchFiles(query: string, pageSize: number = 20): Promise<DriveFile[]> {
    const response = await this.drive.files.list({
      q: `fullText contains '${query.replace(/'/g, "\\'")}' and trashed = false`,
      pageSize,
      fields: "files(id, name, mimeType, webViewLink, size, createdTime, modifiedTime)",
      orderBy: "relevance",
    });

    return (response.data.files || []).map((f) => ({
      id: f.id!,
      name: f.name!,
      mimeType: f.mimeType!,
      webViewLink: f.webViewLink || "",
      size: parseInt(f.size || "0"),
      createdTime: f.createdTime || "",
      modifiedTime: f.modifiedTime || "",
    }));
  }

  async watchFolder(
    folderId: string,
    webhookUrl: string,
    channelId: string
  ): Promise<{ resourceId: string; expiration: string }> {
    const response = await this.drive.files.watch({
      fileId: folderId,
      requestBody: {
        id: channelId,
        type: "web_hook",
        address: webhookUrl,
        expiration: (Date.now() + 7 * 24 * 60 * 60 * 1000).toString(), // 7 days
      },
    });

    return {
      resourceId: response.data.resourceId || "",
      expiration: response.data.expiration || "",
    };
  }
}

export function createGoogleDriveClient(accessToken: string): GoogleDriveClient {
  return new GoogleDriveClient(accessToken);
}
