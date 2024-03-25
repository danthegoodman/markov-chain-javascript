import { readFileSync } from 'node:fs';
import { MarkovChainBuilder } from "./markov-api.mjs";

await main();

async function main() {
  const [inputFileName, outputFilename] = process.argv.slice(2);
  if (!inputFileName || !outputFilename) throw new Error("Usage: [inputFile] [outputFile]")

  const builder = new MarkovChainBuilder();
  
  const inputLines = readFileSync(inputFileName, 'utf8').split('\n');
  for (const ln of inputLines) {
    const words = ln.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue;
    builder.addTrainingData(words);
  }
  
  await builder.writeTrainedModel(outputFilename);
}
