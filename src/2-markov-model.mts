import { readFileSync } from 'node:fs';
import { lazyGet, outputGeneratorLoop } from "./utils.mjs";
import chalk from "chalk";

const START = Symbol("start");
const END = Symbol("end");
type TStart = typeof START;
type TEnd = typeof END;

// end never has a next so we can record it with a negative index
const END_INDEX = -1;

type MarkovChain = Map<string | TStart, Array<string | TEnd>>;

// To make this more efficient in memory and lookup, the chain gets turned into array-based lookup table,
// where array value gets reduced to a probability table, with an index pointing back at the chain
// array.
type MarkovChainModel = Array<[TStart | string, Array<[Index, Probability]>]>
type Probability = number;
type Index = number;

async function main() {
  const [inputFileName] = process.argv.slice(2);
  if(!inputFileName) throw new Error("Usage: [inputFile]");

  const inputFile = readFileSync(inputFileName, 'utf8');
  const chain = buildMarkovChain(inputFile);
  const model = buildModel(chain);
  logChain(chain);
  logModel(model);
  await outputGeneratorLoop(() => generateOutput(model));
}

await main();

function buildMarkovChain(inputFile: string) {
  const result: MarkovChain = new Map();

  const lines = inputFile.split('\n');
  for (const ln of lines) {
    const words = ln.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue;

    let prev: string | TStart | TEnd = START;
    for (const w of words) {
      lazyGet(result, prev, () => []).push(w);
      prev = w;
    }
    lazyGet(result, prev, ()=>[]).push(END);
  }

  return result;
}

function buildModel(chain: MarkovChain) {
  const wordToIndex = new Map();
  wordToIndex.set(END, END_INDEX);
  let ndx = 0;
  for (const key of chain.keys()) {
    wordToIndex.set(key, ndx);
    ndx++;
  }

  const result: MarkovChainModel = [];

  for (const [key, words] of chain) {
    // turn the list of words into a count for each word
    const wordCount = new Map<string | TEnd, number>();
    for (let w of words) {
      wordCount.set(w, (wordCount.get(w) ?? 0) + 1);
    }

    // turn that map into a list of entries, sorted most popular to least
    const countTable = Array.from(wordCount.entries()).sort((a, b) => b[1] - a[1]);

    const probabilityTable: Array<[Index, Probability]> = [];
    let totalSoFar = 0;
    for (const [word, count] of countTable) {
      totalSoFar += count;
      probabilityTable.push([wordToIndex.get(word), totalSoFar / words.length, ]);
    }

    result.push([key, probabilityTable]);
  }
  return result;
}

function generateOutput(model: MarkovChainModel) {
  const result = [];

  let prevNdx = model.findIndex(it => it[0] === START);
  while (true) {
    const prevTable = model[prevNdx]?.[1];
    if (!prevTable) throw new Error(`Unexpected ndx found in chain: "${prevNdx}"`)

    const nextNdx = randomTarget(prevTable);
    if (nextNdx === END_INDEX) break;
    
    const nextWord = model[nextNdx]?.[0];
    result.push(nextWord);
    prevNdx = nextNdx;
  }

  return result.join(" ")
}

function randomTarget(arr: Array<[Probability, Index]>): Index {
  const x = Math.random();
  for (const [ndx, prob] of arr) {
    if (x <= prob) return ndx;
  }
  throw new Error(`Invalid probability row: ${arr}`);
}

function logChain(chain: MarkovChain) {
  console.log("Map {")
  for (const [key, words] of chain) {
    console.log(`  ${renderWord(key)} => [${words.map(renderWord).join(', ')}]`);
  }
  console.log("}")
}

function logModel(model: MarkovChainModel) {
  console.log("[")
  for (const [ndx, [key, table]] of model.entries()) {
    console.log(`  [ ${renderWord(key)}, [${renderTable(table)}] ]`);
  }
  console.log(']')
}

function renderTable(table: Array<[Probability, Index]>) {
  let prevProb = 0;
  return table.map(([ndx, prob])=>{
    const prettyProb = chalk.gray(Math.round((prob - prevProb) * 100)+"%");
    prevProb = prob;
    return `[${chalk.cyan(ndx)}, ${prob.toFixed(4)} ${prettyProb}]`
  }).join(',');
}

function renderWord(it: string | TStart | TEnd) {
  if (it === START) return chalk.green("{S}")
  if (it === END) return chalk.red("{E}")
  return chalk.yellow(it);
}
