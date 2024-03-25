import { MarkovGenerator } from "./markov-api.mjs";
import { outputGeneratorLoop } from "./utils.mjs"

await main();

async function main() {
  const markov = new MarkovGenerator("files/script.trained");
  await outputGeneratorLoop(() =>
    Array.from({length: 5}, ()=> markov.generateOutput().join("")).join('\n')
  );
}
