import {legacyStorageKeys, readStringWithFallback, storageKeys} from "../../storage";

export const readLastDiagramId = (): string | null => {
  return readStringWithFallback(
    storageKeys.lastDiagramId,
    [legacyStorageKeys.lastDiagramId]
  );
};
