export class FileShareManager {
  private fileShares: FileShare[] = [];

  createNewFileShare(sourceUuid: String, targetUuid: String, offer: String) {
    this.fileShares.push(new FileShare(sourceUuid, targetUuid, offer));
  }

  acceptFileShare(sourceUuid: String, targetUuid: String, answer: String) {
    let fileShare = this.findFileShare(sourceUuid, targetUuid);

    if (!fileShare) {
      return;
    }

    fileShare.answer = answer;
  }

  dropFileShare(uuid: String) {
    this.fileShares = this.fileShares.filter(
      (fileShare) =>
        fileShare.sourceUuid !== uuid && fileShare.targetUuid !== uuid
    );
  }

  findFileShare = (sourceUuid: String | null, targetUuid: String | null) =>
    this.fileShares.find(
      (fileShare) =>
        (fileShare.sourceUuid === sourceUuid || !sourceUuid) &&
        (fileShare.targetUuid === targetUuid || !targetUuid)
    );
}

export class FileShare {
  readonly sourceUuid: String;
  readonly targetUuid: String;
  readonly offer: String;
  answer: String | undefined;

  constructor(sourceUuid: String, targetUuid: String, offer: String) {
    this.sourceUuid = sourceUuid;
    this.targetUuid = targetUuid;
    this.offer = offer;
  }
}
