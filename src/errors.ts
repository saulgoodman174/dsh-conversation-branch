export class RewindError extends Error {
  readonly isDSHRemoteError = true;
  constructor(readonly code:string, message:string, readonly details:Record<string,unknown>={}) {super(message)}
}
export function fail(key:string,message:string,details?:Record<string,unknown>):never {
  throw new RewindError('rewind/'+key,message,details);
}
export function record(value:unknown):Record<string,unknown> {
  return typeof value==='object' && value!==null && !Array.isArray(value) ? value as Record<string,unknown> : {};
}
