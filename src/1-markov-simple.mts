import { readFileSync } from 'node:fs';
import { lazyGet, outputGeneratorLoop } from "./utils.mjs";
import chalk from 'chalk';

// Special values that mark the start and end of an input block.
// The only requirement is that they don't be a value found in the input file,
// but the separate Symbol type is a safe way to do that.
const START = Symbol("start");
const END = Symbol("end");

type TStart = typeof START;
type TEnd = typeof END;

// The key is a word found in the input or START.
// The value is the list of words found to follow after the key.
//   END is used if the value found was the last in the input line.
type MarkovChain = Map<string | TStart, Array<string | TEnd>>;

await main();

async function main() {
  const [inputFileName] = process.argv.slice(2);
  if(!inputFileName) throw new Error("Usage: [inputFile]");

  const inputFile = readFileSync(inputFileName, 'utf8');
  const chain = buildMarkovChain(inputFile);
  logChain(chain);
  await outputGeneratorLoop(() => generateOutput(chain));
}

function buildMarkovChain(inputFile: string) {
  const result: MarkovChain = new Map();

  const lines = inputFile.split('\n');
  for (const ln of lines) {
    // Split the line on whitespace blocks
    let words = ln.split(/\s+/)

    // Remove empty words
    words = words.filter(Boolean);

    // skip empty lines
    if (words.length === 0) continue;

    // iterate over every item, making sure to finish with END.
    let prev: string | TStart | TEnd = START;
    for (const w of [...words, END] as const) {
      // get the next list of words from the map, defaulting to an empty array if missing.
      const nextWords = lazyGet(result, prev, () => []);
      // add it to the set of words
      nextWords.push(w);
      // use this word as the previous one.
      prev = w;
    }
  }

  return result;
}

function generateOutput(chain: MarkovChain) {
  const result = [];
  let prev: string | TStart = START;
  while (true) {
    // get the list of words seen from the previous word.
    const targets = chain.get(prev);
    if (!targets) throw new Error(`Unexpected word found in chain: "${String(prev)}"`)

    // pick a random one.
    const next = randomArrayItem(targets);

    // if it signals the end of the chain, then break the loop
    if (next === END) {
      break;
    }

    // Add it to the result and carry on.
    result.push(next);
    prev = next;
  }

  return result.join(" ")
}

function randomArrayItem<T>(arr: Array<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function logChain(chain: MarkovChain) {
  for (const [key, words] of chain) {
    console.log(renderWord(key), "=>", '[' + words.map(renderWord).join(', ') + ']');
  }
}

function renderWord(it: string | TStart | TEnd) {
  if (it === START) return chalk.green("{S}")
  if (it === END) return chalk.red("{E}")
  return chalk.yellow(it);
}
