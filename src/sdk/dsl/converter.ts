import type {ExcalidrawElement} from "@excalidraw/excalidraw/element/types";
import {nanoid} from "nanoid";

const ID_PREFIX = "@";
const DECIMAL_PLACES = 3;
const EXCLUDED_COMMON_KEYS = new Set(["id", "type"]);
const FIELD_ORDER = [
  "x",
  "y",
  "width",
  "height",
  "index",
  "roundness",
  "seed",
  "version",
  "text",
  "containerId",
  "points",
  "startBinding",
  "endBinding",
  "label",
  "labelStyleRef",
  "boundElements",
  "fontSize",
  "fontFamily",
  "textAlign",
  "verticalAlign",
  "autoResize",
  "lineHeight",
  "elbowed",
  "endArrowhead",
  "lastCommittedPoint",
  "startArrowhead"
];
const FIELD_ALIAS: Record<string, string> = {
  x: "x",
  y: "y",
  width: "w",
  height: "h",
  index: "i",
  roundness: "r",
  seed: "s",
  version: "v",
  text: "t",
  containerId: "c",
  points: "p",
  startBinding: "b",
  endBinding: "e",
  boundElements: "be",
  fontSize: "fs",
  fontFamily: "ff",
  textAlign: "ta",
  verticalAlign: "va",
  autoResize: "ar",
  lineHeight: "lh",
  label: "lb",
  labelStyleRef: "ls",
  elbowed: "el",
  endArrowhead: "ea",
  lastCommittedPoint: "lcp",
  startArrowhead: "sa"
};

export interface DSLCompressedDocument {
  version: number;
  shape: "object" | "array";
  meta: Record<string, any>;
  idMap: Record<string, string>;
  commonAttributes: Record<string, any>;
  textCommon: Record<string, any>;
  elements: Array<{
    id: string;
    type: string;
    data: Record<string, any>;
  }>;
}

export interface JsonToDslOptions {
  meta?: Record<string, any>;
  shape?: "object" | "array";
}

export interface ConvertJsonToDslResult {
  dsl: string;
  document: DSLCompressedDocument;
}

export function parseDocument(source: string): DSLCompressedDocument {
  const doc: DSLCompressedDocument = {
    version: 2,
    shape: "object",
    meta: {},
    idMap: {},
    commonAttributes: {},
    textCommon: {},
    elements: []
  };
  const grouped = new Map<string, {id: string; type: string; data: Record<string, any>}[]>();
  const columnMap = new Map<string, ColumnDef[]>();
  const typeOrder: string[] = [];
  let currentSection: string | null = null;

  source.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      return;
    }
    if (line.startsWith("shape")) {
      const payload = line.slice(5).trim();
      const normalized =
        payload.startsWith(":") || payload.startsWith("=")
          ? payload.slice(1).trim()
          : payload;
      doc.shape = (normalized as "object" | "array") || "object";
      currentSection = null;
      return;
    }
    if (line.startsWith("meta")) {
      const payload = line.slice(4).trim();
      const normalized =
        payload.startsWith(":") || payload.startsWith("=")
          ? payload.slice(1).trim()
          : payload;
      doc.meta = normalized ? JSON.parse(normalized) : {};
      currentSection = null;
      return;
    }
    if (line.endsWith(":")) {
      currentSection = line.slice(0, -1);
      return;
    }
    if (!line.startsWith("- ")) {
      throw new Error(`Unexpected line: ${line}`);
    }
    if (!currentSection) {
      throw new Error(`List item appears before section: ${line}`);
    }
    const payload = line.slice(2).trim();
    if (currentSection === "common" || currentSection === "textCommon") {
      const idx = payload.indexOf("=");
      if (idx === -1) throw new Error(`Invalid ${currentSection} entry: ${payload}`);
      const key = payload.slice(0, idx).trim();
      const value = parseValue(payload.slice(idx + 1).trim());
      if (currentSection === "common") {
        doc.commonAttributes[key] = value;
      } else {
        doc.textCommon[key] = value;
      }
      return;
    }
    if (!columnMap.has(currentSection)) {
      const columns = parseColumnHeader(payload);
      columnMap.set(currentSection, columns);
      if (!grouped.has(currentSection)) {
        grouped.set(currentSection, []);
        typeOrder.push(currentSection);
      }
      return;
    }
    const columns = columnMap.get(currentSection);
    if (!columns || !columns.length) {
      throw new Error(`Missing column definition before rows in section ${currentSection}`);
    }
    const values = parseRowValues(payload);
    if (values.length < columns.length) {
      throw new Error(
        `Row column mismatch in ${currentSection}: expected ${columns.length}, got ${values.length}`
      );
    }
    const aliasToField = new Map<string, string>();
    const data: Record<string, any> = {};
    let entryId: string | null = null;
    columns.forEach((col, idx) => {
      aliasToField.set(col.alias, col.field);
      aliasToField.set(col.field, col.field);
      const token = values[idx];
      let valueText: string;
      if (col.field === "id" && token.indexOf("=") === -1) {
        valueText = token;
      } else {
        const eqIdx = token.indexOf("=");
        if (eqIdx === -1) {
          throw new Error(`Invalid value token "${token}" for alias "${col.alias}"`);
        }
        const tokenAlias = token.slice(0, eqIdx).trim();
        if (tokenAlias !== col.alias) {
          throw new Error(`Alias mismatch in ${currentSection}: expected ${col.alias}, got ${tokenAlias}`);
        }
        valueText = token.slice(eqIdx + 1).trim();
      }
      const parsed = parseFieldValue(col.field, valueText);
      if (col.field === "id") {
        entryId = String(parsed);
      } else {
        data[col.field] = parsed;
      }
    });

    const extraTokens = values.slice(columns.length);
    extraTokens.forEach((token) => {
      const eqIdx = token.indexOf("=");
      if (eqIdx === -1) {
        throw new Error(`Invalid extra token "${token}" in ${currentSection}`);
      }
      const alias = token.slice(0, eqIdx).trim();
      const valueText = token.slice(eqIdx + 1).trim();
      const field = aliasToField.get(alias) || alias;
      const parsed = parseFieldValue(field, valueText);
      if (field === "id") {
        entryId = String(parsed);
      } else {
        data[field] = parsed;
      }
    });
    if (!entryId) {
      throw new Error(`Row missing id in section ${currentSection}`);
    }
    grouped.get(currentSection)?.push({id: entryId, type: currentSection, data});
  });

  typeOrder.forEach((type) => {
    grouped.get(type)?.forEach((entry) => {
      doc.elements.push(entry);
    });
  });

  return doc;
}

export function convertJsonToDsl(
  elements: readonly ExcalidrawElement[] | any[],
  options: JsonToDslOptions = {}
): ConvertJsonToDslResult {
  const shape = options.shape ?? "object";
  const meta = options.meta ?? {};
  const normalizedElements = (Array.isArray(elements) ? elements : []).map((el, index) => ({
    ...el,
    id: el?.id || `element_${index + 1}`
  }));

  const idMap = buildIdMap(normalizedElements);
  const reverseIdMap = new Map(Object.entries(idMap).map(([shortId, realId]) => [realId, shortId]));

  const commonAttributes = extractCommonAttributes(normalizedElements);
  const textElements = normalizedElements.filter((el) => el?.type === "text");
  const textCommon = textElements.length
    ? extractCommonAttributes(textElements, commonAttributes)
    : {};

  const entries = normalizedElements.map((element) => {
    const stripped = stripElement(element, element.type, commonAttributes, textCommon);
    const encoded = encodeReferences(stripped, reverseIdMap);
    return {id: reverseIdMap.get(element.id) || element.id, type: element.type, data: encoded};
  });

  const document: DSLCompressedDocument = {
    version: 2,
    shape,
    meta,
    idMap,
    commonAttributes,
    textCommon,
    elements: entries
  };

  const dsl = serializeDocument(document);
  return {dsl, document};
}

export function convertDslToJson(
  dslText: string,
  compressed: DSLCompressedDocument
): {elements: any[]; meta: Record<string, any>; shape: "object" | "array"} {
  const parsedDoc = parseDocument(dslText);
  const baseIdMap = compressed.idMap || {};
  parsedDoc.elements.forEach((entry) => {
    const shortId = String(entry.id);
    if (!baseIdMap[shortId]) {
      baseIdMap[shortId] = nanoid(21);
    }
  });
  parsedDoc.idMap = baseIdMap;
  parsedDoc.meta = compressed.meta ?? {};
  parsedDoc.shape = compressed.shape ?? "object";
  const expanded = expandDocument(parsedDoc);
  return expanded;
}

function buildIdMap(elements: any[]) {
  const idMap: Record<string, string> = {};
  elements.forEach((element, index) => {
    const shortId = String(index + 1);
    const realId = element.id || `element_${index + 1}`;
    idMap[shortId] = realId;
  });
  return idMap;
}

function extractCommonAttributes(elements: any[], existing: Record<string, any> = {}) {
  if (!elements.length) return {};
  const result: Record<string, any> = {};
  const first = elements[0];
  Object.keys(first).forEach((key) => {
    if (EXCLUDED_COMMON_KEYS.has(key)) return;
    if (Object.prototype.hasOwnProperty.call(existing, key)) return;
    const firstValue = first[key];
    if (firstValue === undefined) return;
    if (!elements.every((el) => Object.prototype.hasOwnProperty.call(el, key))) return;
    if (!elements.every((el) => deepEqual(el[key], firstValue))) return;
    result[key] = cloneValue(firstValue);
  });
  return result;
}

function stripElement(
  element: any,
  type: string,
  common: Record<string, any>,
  textCommon: Record<string, any>
) {
  const data: Record<string, any> = {};
  Object.keys(element).forEach((key) => {
    if (key === "id" || key === "type" || key === "updated" || key === "versionNonce") return;
    const value = element[key];
    if (Object.prototype.hasOwnProperty.call(common, key) && deepEqual(value, common[key])) {
      return;
    }
    if (
      type === "text" &&
      Object.prototype.hasOwnProperty.call(textCommon, key) &&
      deepEqual(value, textCommon[key])
    ) {
      return;
    }
    data[key] = cloneValue(value);
  });
  return data;
}

function encodeReferences(value: any, reverseIdMap: Map<string, string>): any {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    const shortId = reverseIdMap.get(value);
    if (shortId) {
      return `${ID_PREFIX}${shortId}`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => encodeReferences(item, reverseIdMap));
  }
  if (typeof value === "object") {
    const result: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      result[key] = encodeReferences(val, reverseIdMap);
    });
    return result;
  }
  return value;
}

function decodeReferences(value: any, idMap: Record<string, string>): any {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.startsWith(ID_PREFIX)) {
      const shortId = value.slice(ID_PREFIX.length);
      if (Object.prototype.hasOwnProperty.call(idMap, shortId)) {
        return idMap[shortId];
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => decodeReferences(item, idMap));
  }
  if (typeof value === "object") {
    const result: Record<string, any> = {};
    Object.entries(value).forEach(([key, val]) => {
      result[key] = decodeReferences(val, idMap);
    });
    return result;
  }
  return value;
}

function serializeDocument(doc: DSLCompressedDocument) {
  const lines: string[] = [];
  lines.push("# excalidraw public-attribute DSL v2");
  if (doc.shape && doc.shape !== "object") {
    lines.push(`shape: ${doc.shape}`);
  }
  if (doc.meta && Object.keys(doc.meta).length) {
    lines.push(`meta: ${JSON.stringify(roundValue(doc.meta))}`);
  }
  if (Object.keys(doc.commonAttributes).length) {
    lines.push("");
    lines.push("common:");
    Object.keys(doc.commonAttributes).forEach((key) => {
      const value = doc.commonAttributes[key];
      lines.push(`- ${key}=${formatValue(roundValue(value))}`);
    });
  }
  if (Object.keys(doc.textCommon).length) {
    lines.push("");
    lines.push("textCommon:");
    Object.keys(doc.textCommon).forEach((key) => {
      const value = doc.textCommon[key];
      lines.push(`- ${key}=${formatValue(roundValue(value))}`);
    });
  }

  const grouped = new Map<string, typeof doc.elements>();
  const typeOrder: string[] = [];
  doc.elements.forEach((entry) => {
    if (!grouped.has(entry.type)) {
      grouped.set(entry.type, []);
      typeOrder.push(entry.type);
    }
    grouped.get(entry.type)?.push(entry);
  });

  typeOrder.forEach((type) => {
    lines.push("");
    lines.push(`${type}:`);
    const columns = buildColumns(grouped.get(type) || []);
    const headerTokens = columns.map((column) =>
      column.field === "id" ? "id" : `${column.alias}=${column.field}`
    );
    lines.push(`- ${headerTokens.join(" ")}`);
    grouped.get(type)?.forEach((entry) => {
      lines.push(formatRow(entry, columns));
    });
  });

  lines.push("");
  return lines.join("\n");
}

interface ColumnDef {
  field: string;
  alias: string;
}

function buildColumns(entries: Array<{data: Record<string, any>}>) {
  const keys = new Set<string>();
  entries.forEach((entry) => {
    Object.keys(entry.data || {}).forEach((key) => {
      keys.add(key);
    });
  });
  const sorted = Array.from(keys).sort((a, b) => {
    const ai = FIELD_ORDER.indexOf(a);
    const bi = FIELD_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
  const usedAliases = new Set(["id"]);
  const columns: ColumnDef[] = [{field: "id", alias: "id"}];
  sorted.forEach((field) => {
    const alias = generateAlias(field, usedAliases);
    usedAliases.add(alias);
    columns.push({field, alias});
  });
  return columns;
}

function formatRow(entry: {id: string; data: Record<string, any>}, columns: ColumnDef[]) {
  const values = columns.map((column) => {
    if (column.field === "id") {
      return formatValue(entry.id);
    }
    const rawValue = entry.data[column.field];
    if (column.field === "boundElements") {
      return `${column.alias}=${formatBoundElements(rawValue)}`;
    }
    const normalized = normalizeForDisplay(column.field, rawValue);
    return `${column.alias}=${formatValue(normalized)}`;
  });
  return `- ${values.join(" ")}`;
}

interface ColumnDef {
  field: string;
  alias: string;
}

function parseColumnHeader(line: string): ColumnDef[] {
  const tokens = splitBySpace(line);
  if (!tokens.length) {
    throw new Error(`Invalid column header: ${line}`);
  }
  return tokens.map((token, index) => {
    if (index === 0 && token.indexOf("=") === -1) {
      if (token !== "id") {
        throw new Error(`First column must be id, got ${token}`);
      }
      return {field: "id", alias: "id"};
    }
    const eqIdx = token.indexOf("=");
    if (eqIdx === -1) {
      throw new Error(`Invalid column token: ${token}`);
    }
    const alias = token.slice(0, eqIdx).trim();
    const field = token.slice(eqIdx + 1).trim();
    if (!alias || !field) {
      throw new Error(`Invalid column mapping: ${token}`);
    }
    return {field, alias};
  });
}

function parseBoundElementsToken(token: string) {
  const trimmed = token.trim();
  if (!trimmed || trimmed === "[]") return [];
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error(`Invalid boundElements token: ${token}`);
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) return [];
  return inner
    .split(",")
    .map((entry) => {
      const clean = entry.trim();
      if (!clean) return null;
      const [type, shortId] = clean.split("-");
      const id =
        shortId && shortId !== "null"
          ? `${ID_PREFIX}${shortId.replace(/^@/, "")}`
          : undefined;
      return {type: type || "unknown", id};
    })
    .filter(Boolean);
}

function parseRowValues(text: string) {
  return splitBySpace(text);
}

function splitBySpace(text: string) {
  const tokens: string[] = [];
  let buffer = "";
  let inQuotes = false;
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const prev = text[i - 1];
    if (char === '"' && prev !== "\\") {
      inQuotes = !inQuotes;
      buffer += char;
      continue;
    }
    if (!inQuotes) {
      if (char === "{" || char === "[") {
        depth += 1;
      } else if (char === "}" || char === "]") {
        depth = Math.max(0, depth - 1);
      } else if (char === " " && depth === 0) {
        if (buffer) {
          tokens.push(buffer);
          buffer = "";
        }
        continue;
      }
    }
    buffer += char;
  }
  if (buffer) tokens.push(buffer);
  return tokens;
}

function parseValue(raw: string) {
  if (raw === "null") return null;
  if (raw === "true") return true;
  if (raw === "false") return false;
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return JSON.parse(raw);
  }
  if (raw.startsWith("{") && raw.endsWith("}")) {
    if (raw.includes(":")) {
      return JSON.parse(raw);
    }
    return parseInlineObject(raw);
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return JSON.parse(raw);
  }
  const num = Number(raw);
  if (!Number.isNaN(num)) {
    return num;
  }
  return raw;
}

function parseFieldValue(field: string, valueText: string) {
  if (field === "boundElements") {
    return parseBoundElementsToken(valueText);
  }
  if (field === "containerId") {
    if (valueText === "null" || valueText === "") {
      return null;
    }
    return `${ID_PREFIX}${valueText.replace(/^@/, "")}`;
  }
  if (field === "id") {
    return valueText;
  }
  if (field === "startBinding" || field === "endBinding") {
    const parsed = parseValue(valueText);
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.elementId !== undefined &&
      parsed.elementId !== null
    ) {
      parsed.elementId = `${ID_PREFIX}${String(parsed.elementId).replace(/^@/, "")}`;
    }
    return parsed;
  }
  if (field === "points" && valueText) {
    const parsed = parseValue(valueText);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => (Array.isArray(item) ? item.map((p) => Number(p)) : item));
    }
    return parsed;
  }
  return parseValue(valueText);
}

function parseInlineObject(text: string) {
  const trimmed = text.replace(/^{|}$/g, "").trim();
  if (!trimmed) return {};
  const result: Record<string, any> = {};
  const parts = splitBySpace(trimmed.replace(/,/g, " "));
  parts.forEach((entry) => {
    const idx = entry.indexOf(":");
    if (idx === -1) return;
    const key = entry.slice(0, idx).trim();
    const valueText = entry.slice(idx + 1).trim();
    result[key] = parseValue(valueText);
  });
  return result;
}

function expandDocument(doc: DSLCompressedDocument) {
  const elements = doc.elements.map((entry) => {
    const decoded = decodeReferences(entry.data, doc.idMap);
    const element = {
      id: doc.idMap[entry.id] || entry.id,
      type: entry.type,
      ...doc.commonAttributes,
      ...decoded
    };
    if (entry.type === "text") {
      return {
        ...doc.textCommon,
        ...element
      };
    }
    return element;
  });

  return {
    elements,
    meta: doc.meta,
    shape: doc.shape
  };
}

function formatValue(value: any) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") {
    if (value.includes(" ") || value.includes("{") || value.includes("[")) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  return JSON.stringify(value);
}

function roundValue(value: any): any {
  if (typeof value === "number") {
    return Number(value.toFixed(DECIMAL_PLACES));
  }
  if (Array.isArray(value)) {
    return value.map((entry) => roundValue(entry));
  }
  if (value && typeof value === "object") {
    const result: Record<string, any> = {};
    Object.entries(value).forEach(([key, entry]) => {
      result[key] = roundValue(entry);
    });
    return result;
  }
  return value;
}

function normalizeForDisplay(field: string, value: any) {
  if (value === undefined) return value;
  if (field === "points" && Array.isArray(value)) {
    return value.map((point) =>
      Array.isArray(point) ? point.map((item) => roundValue(item)) : point
    );
  }
  if (typeof value === "number") {
    return roundValue(value);
  }
  return value;
}

function formatBoundElements(value: any) {
  if (!Array.isArray(value) || value.length === 0) return "[]";
  const tokens = value.map((item) => {
    if (!item || typeof item !== "object") return "unknown-null";
    const id = typeof item.id === "string" ? item.id : "null";
    const cleanId = id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id;
    return `${item.type || "unknown"}-${cleanId || "null"}`;
  });
  return `[${tokens.join(", ")}]`;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return a === b;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => deepEqual(a[key], b[key]));
}

function cloneValue(value: any): any {
  if (value === null || value === undefined) return value;
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => cloneValue(entry));
  const result: Record<string, any> = {};
  Object.entries(value).forEach(([key, entry]) => {
    result[key] = cloneValue(entry);
  });
  return result;
}

function generateAlias(field: string, usedAliases: Set<string>) {
  const alias = FIELD_ALIAS[field] || field.slice(0, 2);
  if (!usedAliases.has(alias)) {
    return alias;
  }
  let index = 2;
  while (usedAliases.has(`${alias}${index}`)) {
    index += 1;
  }
  return `${alias}${index}`;
}
