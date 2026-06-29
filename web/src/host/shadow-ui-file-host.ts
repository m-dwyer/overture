import type { HostApi } from "../host-api.js";
import type { FileStore } from "./sinks.js";

type FileHostApi = Pick<
  HostApi,
  | "host_write_file"
  | "host_read_file"
  | "host_file_exists"
  | "host_ensure_dir"
  | "host_remove_dir"
>;

export function createFileHostApi(files: FileStore): FileHostApi {
  return {
    host_write_file(path: string, data: string): number {
      return files.write(path, data);
    },
    host_read_file(path: string): string | null {
      return files.read(path);
    },
    host_file_exists(path: string): number {
      return files.exists(path) ? 1 : 0;
    },
    host_ensure_dir(_path: string): number {
      return 1;
    },
    host_remove_dir(_path: string): number {
      return 1;
    },
  };
}
