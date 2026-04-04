/*
 * Created on Mon Jan 26 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { musicServerInstance } from "./server/musicServer.js";

async function run() {
  console.log("888b     d888                   d8b.               .d8888b.");
  console.log("8888b   d8888                   Y8P               d88P  Y88b");
  console.log("88888b.d88888                                     Y88b.");
  console.log(
    '888Y88888P888 888  888 .d8888b  888  .d8888b       \"Y888b.    .d88b.  888d888 888  888  .d88b.  888d888 ',
  );
  console.log(
    '888 Y888P 888 888  888 88K      888 d88P\"             \"Y88b .d8P  Y8b 888P"   888  888 d8P  Y8b 888P"',
  );
  console.log(
    '888  Y8P  888 888  888 \"Y8888b. 888 888                 \"888 88888888 888     Y88  88P 88888888 888',
  );
  console.log(
    '888   \"   888 Y88b 888      X88 888 Y88b.         Y88b  d88P Y8b.     888      Y8bd8P  Y8b.     888 ',
  );
  console.log(
    '888       888  \"Y88888  88888P\' 888  \"Y8888P       \"Y8888P\"   \"Y8888  888       Y88P    \"Y8888  888',
  );
  console.log("");

  await musicServerInstance.run();
}

run();
