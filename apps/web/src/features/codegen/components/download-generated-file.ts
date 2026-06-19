export interface GeneratedFileDownload {
  readonly path: string;
  readonly content: string;
}

export function downloadGeneratedFile(file: GeneratedFileDownload): void {
  const blob = new Blob([file.content], {
    type: "text/typescript;charset=utf-8",
  });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = file.path;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
