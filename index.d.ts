// Mapping of numeric id -> secret
export type Keys = {[key: number]: string }

export type Options = {
  // The Encryption Algorithm, defaults to aes-128-cbc if unset
  encryption?: "aes-128-cbc" | "aes-192-cbc" | "aes-256-cbc",

  // Any random string that will append to the message when generating SHA1
  digestSalt: string
}

export type Encryptor = {
  encrypt: (data: string) => [encrypted: string, keyringId: string, digest: string];
  decrypt: (encrypted: string, keyringId: string) => string;
}

/**
 * Create a new keyring.
 * A keyring is a combination of keys and functions for encryption/decryption.
 *
 * @public
 * @param  {array}   keys                The encryption keys as described.
 * @param  {Object}  options             The keyring options.
 * @param  {String}  options.encryption  The encryption algorithm.
 *                                       Can be `aes-128-cbc`, `aes-192-cbc` or `aes-256-cbc`.
 * @param  {String}  options.digestSalt  Any random string that will be append to
 *                                       the message when generating SHA1.
 * @return {String}                      An object containing functions for encryption/decryption.
 */
export function keyring(keys: Keys, options?: Options): Encryptor;

/**
 * Generate a hash value for the given string in a hex-encoded form.
 * @param  {String} value
 * @return {String}        Hex-encoded string representing the SHA1 digest for the given string.
 */
export function sha1(value: string, options?: Options): string;
