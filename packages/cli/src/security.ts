/** Mask username/password in a MongoDB connection string so it's safe to log or display. */
export function maskConnectionString(uri: string): string {
  const atIndex = uri.indexOf('@');
  const schemeEnd = uri.indexOf('://');
  if (atIndex === -1 || schemeEnd === -1) {
    return uri;
  }
  const scheme = uri.slice(0, schemeEnd + 3);
  const afterAt = uri.slice(atIndex);
  return `${scheme}***${afterAt}`;
}

/** Replaces any raw occurrence of the connection string inside an error message with a masked one. */
export function maskErrorMessage(error: string, connectionString: string): string {
  return error.split(connectionString).join(maskConnectionString(connectionString));
}
