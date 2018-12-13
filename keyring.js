/**
 * Node's crypto module.
 * @constant
 * @type {Object}
 */
const crypto = require("crypto");

/**
 * Set the default keyring options.
 * @constant
 * @type {Object}
 */
const defaultKeyringOptions = {
  encryption: "aes-128-cbc",
};

/**
 * Create a new keyring.
 * A keyring is a combination of keys and functions for encryption/decryption.
 *
 * @public
 * @param  {array}   keys                The encryption keys as described.
 * @param  {Object}  options             The keyring options.
 * @param  {String}  options.encryption  The encryption algorithm.
 *                                       Can be `aes-128-cbc`, `aes-192-cbc` or `aes-256-cbc`.
 * @return {String}                      An object containing functions for encryption/decryption.
 */
function keyring(keys, options = {}) {
  options = Object.assign({}, defaultKeyringOptions, options);

  // Convert keyring object into array of keys.
  keys = normalizeKeys(keys);
  validateKeyring(keys);

  return {
    encrypt: message => encrypt(keys, options, message),
    decrypt: (message, keyringId) => decrypt(findKey(keys, keyringId), options, message),
    currentId: () => currentKey(keys).id
  }
}

/**
 * Encrypt all properties from the specified object.
 *
 * @private This function is used by keyring().
 *
 * @param  {Array}  keys     The array of encryption keys.
 * @param  {Object} options  The keyring options as described by keyring().
 * @param  {String} message  The string that will be encrypted.
 * @return {Array}           An array with three items representing the encrypted
 *                           value, the digest, and the keyring id, respectively.
 */
function encrypt(keys, {encryption}, message) {
  const key = currentKey(keys);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(encryption, key.value, iv);
  const encrypted = Buffer.concat([
    iv,
    cipher.update(Buffer.from(message)),
    cipher.final()
  ]).toString("base64");

  const digest = sha1(message);

  return [encrypted, key.id, digest];
}

/**
 * Decrypt all properties from the specified object.
 *
 * @private This function is used by keyring().
 *
 * @param  {Array}  keys     The array of encryption keys.
 * @param  {Object} options  The keyring options as described by keyring().
 * @param  {Object} source   The object that will have its properties decrypted.
 * @return {Object}          The object with decrypted properties.
 */
function decrypt(key, {encryption}, message) {
  const decoded = Buffer.from(message, "base64");
  const iv = decoded.slice(0, 16);
  const encrypted = decoded.slice(16);
  const decipher = crypto.createDecipheriv(encryption, key.value, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString();
}

/**
 * Generate digest suffix based on prop case.
 * Precedence is:
 *
 * - whatever is provided by the user.
 * - use `Digest` for property names that look like `camelCase`.
 * - defaults to `_digest`.
 *
 * @param  {[type]} prop   [description]
 * @param  {[type]} suffix [description]
 * @return {[type]}        [description]
 */
function resolveDigestSuffix(prop, suffix) {
  if (suffix) {
    return suffix;
  } else if (prop.match(/[a-z0-9]+[A-Z]/)) {
    return "Digest";
  }

  return "_digest";
}

/**
 * Generate a hash value for the given string in a hex-encoded form.
 * @param  {String} value
 * @return {String}        Hex-encoded string representing the SHA1 digest for the given string.
 */
function sha1(value) {
  if (!isString(value)) {
    throw new Error(`You can only generated SHA1 digests from strings (received "${typeof value}" instead).`);
  }

  const hash = crypto.createHash("sha1");
  hash.update(value);
  return hash.digest("hex");
}

/**
 * Validate whether encryption keys are valid or not.
 *
 * @private  This function is used by keyring().
 * @todo     Validate key size against chosen encryption algorithm.
 *
 * @param  {Array}  keys  The array of encryption keys.
 * @return {undefined}
 */
function validateKeyring(keys) {
  if (keys.length === 0) {
    throw new Error("You must initialize the keyring");
  }

  const invalidIds = keys.some(key => isNaN(key.id));

  if (invalidIds) {
    throw new Error("All keyring keys must be integer numbers");
  }
}

/**
 * Convert the encryptions keys JSON object into a normalized
 * array of objects representing keys.
 *
 * @private This function is used by keyring().
 *
 * @param  {Object} keys  The raw encryption keys object.
 * @return {Array}        List of key objects.
 */
function normalizeKeys(keys) {
  return Object.keys(keys).reduce((buffer, id) => {
    buffer.push({
      id: parseInt(id, 10),
      value: keyBuffer(keys[id])
    });

    return buffer;
  }, []);
}

/**
 * Return buffer for key. It assumes that all keys
 * are base64-encoded.
 *
 * @private This function is used by normalizeKeys().
 *
 * @param  {String} value  Base64-encoded string representing the key.
 * @return {Buffer}        Buffer representing the encryption key.
 */
function keyBuffer(value) {
  if (value instanceof Buffer) {
    return value;
  }

  return Buffer.from(value, "base64");
}

/**
 * Return the current key; i.e. the one that has the largest id.
 *
 * @private This function is used by encrypt() and decrypt().
 *
 * @param  {Array} keys  The array of encryption keys.
 * @return {Object}      Current encryption key from keyring.
 */
function currentKey(keys) {
  return keys.reduce((a, b) => {
    return (a.id > b.id) ? a : b;
  });
}

/**
 * Find a key by its id.
 * Throw an exception in case key is not available.
 *
 * @private This function is used by keyring().
 *
 * @param  {Array}  keys  The array of encryption keys.
 * @param  {Number} id    The keyring id. Must be an integer.
 * @return {Object}       The matching key object.
 */
function findKey(keys, id) {
  const key = keys.find(key => parseInt(key.id) === parseInt(id, 10));

  if (key) {
    return key;
  }

  throw new Error(`key=${id} is not available on keyring`);
}

/**
 * Check if `object` is string.
 * @param  {Object}   The object that will be checked.
 * @return {Boolean}
 */
function isString(object) {
  return typeof(object) === "string" || object instanceof String;
}

/**
 * The package's public interface.
 *
 * @type {Object}
 */
module.exports = {
  keyring,
  sha1,
  options: defaultKeyringOptions
};
