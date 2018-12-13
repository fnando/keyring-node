# keyring

Simple encryption-at-rest with key rotation support for Node.js.

![keyring: Simple encryption-at-rest with key rotation support for Node.js.](https://raw.githubusercontent.com/fnando/keyring-node/master/keyring.png)

<p align="center">
  <a href="https://travis-ci.org/fnando/keyring-node"><img src="https://travis-ci.org/fnando/keyring-node.svg" alt="Travis-CI"></a>
</p>

N.B.: **keyring** is *not* for encrypting passwords--for that, you should use something like [bcrypt](https://www.npmjs.com/package/bcrypt). It's meant for encrypting sensitive data you will need to access in plain text (e.g. storing OAuth token from users). Passwords do not fall in that category.

This package is completely independent from any storage mechanisms; the goal is providing a few functions that could be easily integrated with any ORM. With that said, this package bundles a small plugin that works with [Sequelize](https://sequelizejs.com).

## Installation

Add package to your `package.json` using Yarn.

```console
yarn add -E @fnando/keyring
```

## Usage

### Encryption

By default, AES-128-CBC is the algorithm used for encryption, which requires 16-bytes long keys. Using 16-bytes of random data base64-encoded is the recommended way. You can use the following command to generate keys:

```console
$ dd if=/dev/urandom bs=16 count=1 2>/dev/null | openssl base64
olod7u2bKOLWx1/tffppJQ==
```

Include the result of this command in the `value` section of the key description in the set of keys (aka keyring).

#### Key size

- `aes-128-cbc`: 16 bytes.
- `aes-192-cbc`: 24 bytes.
- `aes-256-cbc`: 32 bytes.

#### About the encrypted message

Initialization vectors (IV) should be unpredictable and unique; ideally, they will be cryptographically random. They do not have to be secret: IVs are typically just added to ciphertext messages unencrypted. It may sound contradictory that something has to be unpredictable and unique, but does not have to be secret; it is important to remember that an attacker must not be able to predict ahead of time what a given IV will be.

With that in mind, **keyring** uses `base64(unencrypted iv + encrypted message)` as the final message. If you're planning to migrate from other encryption mechanisms or read encrypted values from the database without using **keyring**, make sure you account for this. The IV length for AES is 16 bytes.

### Keyring

Keys are managed through a keyring--a short JSON document describing your encryption keys. This set of keys is called _keyring_. The _keyring_ must be a JSON object mapping numeric ids of the keys to the key values. A keyring must have at least one key. For example:

```json
{
  "1": "QSXyoiRDPoJmfkJUZ4hJeQ==",
  "2": "r6AfOeilPDJomFsiOXLdfQ=="
}
```

The `id` is used to track which key encrypted which piece of data; a key with a larger id is assumed to be newer. The value is the actual bytes of the encryption key.

### Key Rotation

With **keyring** you can have multiple encryption keys at once and key rotation is fairly straightforward: if you add a key to the _keyring_ with a higher id than any other key, that key will automatically be used for encryption when objects are either created or updated. Any keys that are no longer in use can be safely removed from the _keyring_.

It's extremely important that you save the keyring id returned by `encrypt()`; otherwise, you may not be able to decrypt values (you can always decrypt values if you still possess _all_ encryption keys).

If you're using **keyring** to encrypt database columns, it's recommended to use a separated _keyring_ for each table you're planning to encrypt: this allows an easier key rotation in case you need (e.g. key leaking).

N.B.: Keys are hardcoded on these examples, but you shouldn't do it on your code base. You can retrieve _keyring_ from environment variables if you're deploying to [Heroku](https://heroku.com) and alike, or deploy a JSON file with your configuration management software (e.g. Ansible, Puppet, Chef, etc).

### Basic usage of keyring

```js
import { keyring } from "@fnando/keyring";

const keys = {"1": "QSXyoiRDPoJmfkJUZ4hJeQ=="};
const encryptor = keyring(keys);

// STEP 1: Encrypt email using latest encryption key.
const [encryptedEmail, keyringId, digest] = encryptor.encrypt("john@example.com");

console.log({encryptedEmail, keyringId, digest});
/* {encryptedEmail: 'sI2a+DhiOuheWiIub8Rsmt0rMZ/qvMLZ5resTc503Vxhh4EmzQTKimnhNWamL1RG',
    keyringId: 1,
    digest: '5224cb6fdd5bbe463af1db8ee499e858fcb79f81'}
*/

// STEP 2: Decrypted email using encryption key defined by keyring id.
const decryptedEmail = encryptor.decrypt(encryptedEmail, keyringId);

console.log(decryptedEmail);
//=> john@example.com
```

### Using with Sequelize

If you're using Sequelize, you probably don't want to manually handle the encryption as above. With that in mind, `keyring` ships with a small plugin that eases all the pain of manually handling encryption/decryption of properties, as well as key rotation and digesting.

First, you have to load a different file that set ups models.

```js
const Sequelize = require("sequelize");
const sequelize = new Sequelize("postgres:///test", {logging: false});
const Keyring = require("@fnando/keyring/sequelize");

const User = await sequelize.define("users", {
  id: {
    type: Sequelize.UUIDV4,
    primaryKey: true,
    allowNull: false,
    defaultValue: Sequelize.UUIDV4
  },

  // This column is required and will store the
  // keyring id (which encryption key was used).
  keyring_id: Sequelize.INTEGER,

  // All encrypted columns must be prefixed with `encrypted_`.
  // Optionally, you may have a `<attribute>_digest` column,
  // will store a SHA1 digest from the value, making
  // unique indexing and searching easier.
  // Finally, notice that you're responsible for defining
  // a VIRTUAL property for all columns you're encrypting.
  encrypted_email: Sequelize.TEXT,
  email_digest: Sequelize.TEXT,
  email: Sequelize.VIRTUAL,
}, {timestamps: false});

// Retrieve encryption keys from `USER_KEYRING` environment variable.
// It's recommended that you use one keyring for each model, to make
// a rollout easier (e.g. an encryption key leaked).
//
// ```js
// const keys = JSON.parse(process.env.USER_KEYRING);
// ```
//
// Alternatively, you can load a JSON file deployed by some config management software like Ansible, Chef or Puppet.
//
// ```js
// const fs = require("fs");
// const keys = JSON.parse(fs.readFileSync("user_keyring.json"));
// ```
//
// For the purposes of this example, we're going to set keys manually.
// WARNING: DON'T EVER DO THAT FOR REAL APPS.
const keys = {1: "QSXyoiRDPoJmfkJUZ4hJeQ=="};

// This is the step you set up your model with hooks to encrypt/decrypt
// columns. You can specify the encryption keys, which columns are going
// to be encrypted, how the column will be encrypted and the name of the
// keyring id column. You can see below the default values for `encryption`
// and keyring id column.
Keyring(User, {
  keys,                      // [required]
  columns: ["email"],              // [required]
  keyringIdColumn: "keyring_id",   // [optional]
  encryption: "aes-128-cbc"        // [optional]
});

(async () => {
  // Now you can create records, like you usually do.
  const user = await User.create({email: "john@example.com"});

  console.log(JSON.stringify(user, null, 2));
  // {
  //   "id": "0d236060-ab3e-4b0e-a740-517a3fed84a4",
  //   "email": "john@example.com",
  //   "encrypted_email": "3eJrf1teqriot3shHozddrwaPeG6b/fzyQFzsXIPUxJ7GbgBjhOjkac5Q+d1pGG9",
  //   "keyring_id": "1",
  //   "email_digest": "5224cb6fdd5bbe463af1db8ee499e858fcb79f81"
  // }

  // Let's update the email address.
  await user.update({email: "john.doe@example.com"});

  console.log(JSON.stringify(user, null, 2));
  // {
  //   "id": "021001c8-417e-4c7f-8642-f9d66a9734d5",
  //   "email": "john.doe@example.com",
  //   "encrypted_email": "DGOvw41eMSDiV0toCOleQfi69QwE7ODs5lkIhuNblDB/tt44E79AqCNK+KrpwnVK",
  //   "keyring_id": 1,
  //   "email_digest": "73ec53c4ba1747d485ae2a0d7bfafa6cda80a5a9"
  // }

  // Now let's pretend that you set USER_KEYRING env var to a
  // {1: old_key, 2: new_key} or rollout a new JSON file via your
  // config management software, and restarted the app.
  keys[2] = "r6AfOeilPDJomFsiOXLdfQ==";

  // To simply roll out a new encryption, just call `.save()`.
  // This will trigger a `beforeSave` hook, which will re-encrypt
  // all properties again.
  await user.save();

  console.log(JSON.stringify(user, null, 2));
  // {
  //   "id": "f904d454-9295-4f3e-8a6f-51c0f125fe12",
  //   "email": "john.doe@example.com",
  //   "encrypted_email": "PSxSXY+fGxKwcU8QGTywXEMY8zm2cVt/lSg5R3ljvN2O2AIAV/kYgPCk6eEutwLz",
  //   "keyring_id": 2,
  //   "email_digest": "73ec53c4ba1747d485ae2a0d7bfafa6cda80a5a9"
  // }

  // Attributes are also re-encrypted when you call `.update()`.
  await user.update({email: "john@example.com"});

  console.log(JSON.stringify(user, null, 2));
  // {
  //   "id": "2a413a93-5f8b-494f-b01d-2edf1770a3d6",
  //   "email": "john@example.com",
  //   "encrypted_email": "0MZjAqjBn/FjFk7miaGsVllg2uckrymUDoL3kZL6g4PL/L44pVoz1L6uNmnY8bhW",
  //   "keyring_id": 2,
  //   "email_digest": "5224cb6fdd5bbe463af1db8ee499e858fcb79f81"
  // }
})();
```

#### Lookup

One tricky aspect of encryption is looking up records by known secret. To solve this problem, you can generate SHA1 digests for strings that are encrypted and save them to the database.

`keyring` detects the presence of `<attribute>_digest` columns and update them accordingly with a SHA1 digest that can be used for unique indexing or searching.

```js
// A utility function to generate SHA1s out of strings.
const {sha1} = require("@fnando/keyring");

await User.create({email: "john@example.com"});

const user = await User.findOne({where: {email_digest: sha1("john@example.com")}});
// {
//   "id": "faaa070b-9f86-4cbb-968c-fe01a5e550ba",
//   "email_digest": "5224cb6fdd5bbe463af1db8ee499e858fcb79f81",
//   "encrypted_email": "FZorDYhrA6YpCit9gnAjiuPUUwTzl8F9XOXU89H1mcfpWibfG4Azlhx/g/Ry9Ic0",
//   "keyring_id": "1",
//   "email": "john@example.com"
// }
```

### Exchange data with Ruby

If you use Ruby, you may be interested in <https://github.com/fnando/attr_keyring>, which is able to read and write messages using the same format.

## Development

After checking out the repo, run `yarn install` to install dependencies. Then, run `yarn test` to run the tests.

## Contributing

Bug reports and pull requests are welcome on GitHub at <https://github.com/fnando/keyring-node>. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](http://contributor-covenant.org) code of conduct.

## License

The gem is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).

## Icon

Icon made by [Icongeek26](https://www.flaticon.com/authors/icongeek26) from [Flaticon](https://www.flaticon.com/) is licensed by Creative Commons BY 3.0.

## Code of Conduct

Everyone interacting in the **keyring** project’s codebases, issue trackers, chat rooms and mailing lists is expected to follow the [code of conduct](https://github.com/fnando/keyring-node/blob/master/CODE_OF_CONDUCT.md).
