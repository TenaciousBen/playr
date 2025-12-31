export function toFileUrl(p: string) {
  // Windows paths come back as C:\foo\bar.png; the file URL wants forward slashes.
  const norm = p.replace(/\\/g, "/");
  return `file:///${encodeURI(norm)}`;
}


