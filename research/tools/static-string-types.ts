export interface PakInventoryEntry {
  file: string;
  size: number;
  version: number;
  encrypted: number;
  guid: string;
  offset: number;
  indexSize: number;
  hash: string;
}

export interface MatchedPakKey {
  file: string;
  key: string;
}

export interface StringCandidate {
  path: string;
  entry: number;
  pak: string;
  entries: string;
}

export interface ExtractedDatabase extends StringCandidate {
  output: string;
  size: number;
  custom: number;
  sha256: string;
  header: string;
  error?: never;
}

export interface FailedExtraction extends StringCandidate {
  error: string;
  header?: never;
}

export type ExtractionResult = ExtractedDatabase | FailedExtraction;
