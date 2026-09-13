/** Storage SDK paths become URL paths. Reject URL metacharacters/encoded
 * traversal before signing with the service role, not just literal '..'. */
export function storagePathBelongsToOrg(path: string, orgId: string): boolean {
  return (
    path.startsWith(`${orgId}/`) &&
    !/[%\\?#\x00-\x1f\x7f]/.test(path) &&
    path
      .split("/")
      .every((part) => part !== "" && part !== "." && part !== "..")
  );
}
