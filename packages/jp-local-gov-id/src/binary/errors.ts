export class LocalGovBinaryError extends Error {
  override readonly name = "LocalGovBinaryError";

  constructor(message: string) {
    super(message);
  }
}
