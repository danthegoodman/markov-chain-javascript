import { readFileSync } from 'node:fs';
import { MarkovChainBuilder } from "./markov-api.mjs";

await main();

async function main() {
  const builder = new MarkovChainBuilder();
  
  let script = readFileSync("files/script.txt", 'utf8');
  script = scrubPuctuation(script).toUpperCase();
  for (let [,character, dialogue] of script.matchAll(/^"[^"]+" "([^"]+)" "(.*)"$/gm)) {
    let lastNdx = 0;
    for(const punctMatch of dialogue.matchAll(/(\.{1,3}|[\?!]{1,2})/g)){
      if(punctMatch.index === undefined) throw new Error('Unexpected scenario');
      
      let punct = punctMatch[0];
      if (punct === "..") punct = "..."
      const words = dialogue
        .slice(lastNdx, punctMatch.index)
        .trim()
        .split(/\s+/)
        .map((it, ndx)=> ' ' + it);
      words.unshift(character, ":")
      words.push(punct);
      builder.addTrainingData(words);
      lastNdx = punctMatch.index + punct.length;
    }
  }
  
  builder.writeTrainedModel("files/script.trained");
}

function scrubPuctuation(script: string){
  return script
  .replaceAll(/\.{4,}/g, "...")
  .replaceAll("?!?", "?!")
  .replaceAll("!!", "!");
}
