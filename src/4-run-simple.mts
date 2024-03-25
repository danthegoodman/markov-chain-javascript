import { MarkovGenerator } from "./markov-api.mjs";
import { outputGeneratorLoop } from "./utils.mjs"

await main();

async function main() {
  const [inputFileName] = process.argv.slice(2);
  if (!inputFileName) throw new Error("Usage: [inputFile]")

  const markov = new MarkovGenerator(inputFileName);
  await outputGeneratorLoop(() => markov.generateOutput());
}
