const { keyring } = require("../keyring");

const keys = {"1": "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M="};
const encryptor = keyring(keys);

// STEP 1: Encrypt message using latest encryption key.
const [encrypted, keyringId, digest] = encryptor.encrypt("super secret");

console.log(`🔒 ${encrypted}`);
console.log(`🔑 ${keyringId}`);
console.log(`🔎 ${digest}`);
//=> 🔒 Vco48O95YC4jqj44MheY8zFO2NLMPp/KILiUGbKxHvAwLd2/AN+zUG650CJzogttqnF1cGMFb//Idg4+bXoRMQ==
//=> 🔑 1
//=> 🔎 e24fe0dea7f9abe8cbb192702578715079689a3e

// STEP 2: Decrypted message using encryption key defined by keyring id.
const decrypted = encryptor.decrypt(encrypted, keyringId);
console.log(`✉️ ${decrypted}`);
//=> ✉️ super secret
