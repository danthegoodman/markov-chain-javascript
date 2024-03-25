import { createInterface } from 'node:readline';

export async function outputGeneratorLoop(generator: () => any) {
  const rl = createInterface({input: process.stdin});

  const message = '\x1b[2mPress enter\x1b[0m'
  console.log(generator());
  console.log(message);

  for await (const _line of rl) {
    console.log(generator());
    console.log(message);
  }
}

export function lazyGet<K, V>(map: Map<K, V>, key: K, defaultProvider: () => V): V {
  let result = map.get(key);
  if (!result) {
    result = defaultProvider();
    map.set(key, result);
  }
  return result;
}
