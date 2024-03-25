import { readFileSync, createWriteStream } from 'node:fs';
import { Writable } from "node:stream";
import { once } from "node:events";
import { lazyGet } from "./utils.mjs";

const START = Symbol("start");
const END = Symbol("end");
const START_INDEX = 0;
const END_INDEX = (2 ** 32) - 1;

type TStart = typeof START;
type TEnd = typeof END;

type ProbabilityTable = [number,number][];
type MarkovChainModel = Array<[TStart | string, ProbabilityTable]>

type MarkovChain = Map<string | TStart, Map<string | TEnd, number>>;

export class MarkovChainBuilder {
  // we want to enforce START will be the first in the model so the serialized
  // data can omit the START key
  #chain: MarkovChain = new Map([[START, new Map()]]);

  addTrainingData(words: string[]) {
    let prev: string | TStart | TEnd = START;
    for(const w of [...words, END] as const){
      const targets = lazyGet(this.#chain, prev, ()=> new Map());
      targets.set(w, (targets.get(w) ?? 0) + 1);
      prev = w;
    }
  }

  async writeTrainedModel(outputFilename: string){
    const model = buildModel(this.#chain);
    const outstream = createWriteStream(outputFilename);
    serializeModel(model, outstream);
    outstream.close();
    await once(outstream, 'close');
  }
}

function buildModel(chain: MarkovChain) {
  const wordToIndex = new Map();
  wordToIndex.set(END, END_INDEX);
  let ndx = 0;
  for (const key of chain.keys()) {
    wordToIndex.set(key, ndx);
    ndx++;
  }
  if(wordToIndex.get(START) !== START_INDEX){
    throw new Error(`Expected START to be at index ${START_INDEX}`);
  }

  const result: MarkovChainModel = [];
  for (const [key, wordCount] of chain) {
    const countTable = Array.from(wordCount.entries()).sort((a, b) => b[1] - a[1]);
    const countTotal = countTable.reduce((sum, it)=> sum += it[1], 0);

    const probabilityTable: ProbabilityTable= [];
    let totalSoFar = 0;
    for (const [word, count] of countTable) {
      totalSoFar += count;
      probabilityTable.push([totalSoFar / countTotal, wordToIndex.get(word)]);
    }

    result.push([key, probabilityTable]);
  }
  return result;
}

function serializeModel(model: MarkovChainModel, writable: Writable) {
  const startRow = model[START_INDEX]
  if (model.length > (2 ** (8 * 4))) throw new Error("Too many rows for a 32bit model")

  const modelLenBuf = Buffer.alloc(4);
  modelLenBuf.writeUInt32LE(model.length - 1);
  writable.write(modelLenBuf);
  writable.write(tableToBuffer(startRow[1]));
  for (const it of model.slice(1)) {
    writable.write(tableToBuffer(it[1]));
    const word = it[0] as string;
    if (word.length > (2 ** 8)) throw new Error("Word too large for a 8bit limit");
    const bufStr = Buffer.from(word, "utf8");
    const bufStrLen = Buffer.alloc(1);
    bufStrLen.writeUInt8(bufStr.length);
    writable.write(bufStrLen);
    writable.write(bufStr);
  }
}

function tableToBuffer(table: ProbabilityTable) {
  let bufLength = 4; //32bit for table length
  bufLength += 4 * table.length; // 32bit per index
  bufLength += 8 * table.length; // 64bit per probability

  const buf = Buffer.alloc(bufLength);
  buf.writeUint32LE(table.length);
  for (let i = 0; i < table.length; i++) {
    buf.writeDoubleLE(table[i][0], (i*12) + 4);
    buf.writeUint32LE(table[i][1], (i*12) + 12);
  }
  return buf;
}

export class MarkovGenerator {
  #model: MarkovChainModel;
  constructor(filename: string) {
    const modelBuffer = readFileSync(filename);
    this.#model = deserializeModel(modelBuffer);
  }
  
  generateOutput(): string[]{
    const model = this.#model;
    
    const result = [];
    let prevNdx = START_INDEX;
    while (true) {
      const prevTable = model[prevNdx]?.[1];
      if (!prevTable) throw new Error(`Unexpected ndx found in chain: "${prevNdx}"`)

      const nextNdx = randomTarget(prevTable);
      if (nextNdx === END_INDEX) break;
      const nextWord = model[nextNdx]?.[0];
      
      if (nextWord === START){
        throw new Error("Did not expect START in middle of generation");
      }
      result.push(nextWord);
      prevNdx = nextNdx;
    }

    return result
  }
}

function deserializeModel(buf: Buffer): MarkovChainModel {
  let offset = 0;

  const result: MarkovChainModel = [];
  const itemLength = buf.readInt32LE(offset);
  offset += 4;

  result.push([START, deserializeTable()]);

  for (let i = 0; i < itemLength; i++) {
    const table = deserializeTable();
    const wordLen = buf.readUint8(offset);
    offset += 1;
    const word = buf.subarray(offset, offset + wordLen).toString('utf8');
    offset += wordLen;
    result.push([word, table]);
  }

  return result;

  function deserializeTable() {
    const tableLength = buf.readUint32LE(offset);
    offset += 4;

    const table: ProbabilityTable = [];
    for (let i = 0; i < tableLength; i++) {
      const probability = buf.readDoubleLE(offset);
      offset += 8;
      const index = buf.readUint32LE(offset);
      offset += 4;
      table.push([probability, index]);
    }
    return table;
  }
}

function randomTarget(arr: ProbabilityTable): number {
  const x = Math.random();
  for (const [prob, ndx] of arr) {
    if (x <= prob) return ndx;
  }
  throw new Error(`Invalid probability row: ${arr}`);
}
