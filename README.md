# keyring

Simple encryption-at-rest with key rotation support for Node.js.

![keyring: Simple encryption-at-rest with key rotation support for Node.js.](https://raw.githubusercontent.com/fnando/keyring-node/main/keyring.png)

<p align="center">
  <a href="https://travis-ci.org/fnando/keyring-node"><img src="https://travis-ci.org/fnando/keyring-node.svg" alt="Travis-CI"></a>
</p>

N.B.: **keyring** is _not_ for encrypting passwords--for that, you should use
something like [bcrypt](https://www.npmjs.com/package/bcrypt). It's meant for
encrypting sensitive data you will need to access in plain text (e.g. storing
OAuth token from users). Passwords do not fall in that category.

This package is completely independent from any storage mechanisms; the goal is
providing a few functions that could be easily integrated with any ORM. With
that said, this package bundles a small plugin that works with
[Sequelize](https://sequelizejs.com).

## Installation

Add package to your `package.json` using Yarn.

```console
yarn add -E @fnando/keyring
```

## Usage

### Encryption

By default, AES-128-CBC is the algorithm used for encryption. This algorithm
uses 16 bytes keys, but you're required to use a key that's double the size
because half of that keys will be used to generate the HMAC. The first 16 bytes
will be used as the encryption key, and the last 16 bytes will be used to
generate the HMAC.

Using random data base64-encoded is the recommended way. You can easily generate
keys by using the following command:

```console
$ dd if=/dev/urandom bs=32 count=1 2>/dev/null | openssl base64 -A
qUjOJFgZsZbTICsN0TMkKqUvSgObYxnkHDsazTqE5tM=
```

Include the result of this command in the `value` section of the key description
in the keyring. Half this key is used for encryption, and half for the HMAC.

#### Key size

The key size depends on the algorithm being used. The key size should be double
the size as half of it is used for HMAC computation.

- `aes-128-cbc`: 16 bytes (encryption) + 16 bytes (HMAC).
- `aes-192-cbc`: 24 bytes (encryption) + 24 bytes (HMAC).
- `aes-256-cbc`: 32 bytes (encryption) + 32 bytes (HMAC).

#### About the encrypted message

Initialization vectors (IV) should be unpredictable and unique; ideally, they
will be cryptographically random. They do not have to be secret: IVs are
typically just added to ciphertext messages unencrypted. It may sound
contradictory that something has to be unpredictable and unique, but does not
have to be secret; it is important to remember that an attacker must not be able
to predict ahead of time what a given IV will be.

With that in mind, _keyring_ uses
`base64(hmac(unencrypted iv + encrypted message) + unencrypted iv + encrypted message)`
as the final message. If you're planning to migrate from other encryption
mechanisms or read encrypted values from the database without using _keyring_,
make sure you account for this. The HMAC is 32-bytes long and the IV is 16-bytes
long.

### Keyring

Keys are managed through a keyring--a short JSON document describing your
encryption keys. The keyring must be a JSON object mapping numeric ids of the
keys to the key values. A keyring must have at least one key. For example:

```json
{
  "1": "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=",
  "2": "VN8UXRVMNbIh9FWEFVde0q7GUA1SGOie1+FgAKlNYHc="
}
```

The `id` is used to track which key encrypted which piece of data; a key with a
larger id is assumed to be newer. The value is the actual bytes of the
encryption key.

### Key Rotation

With **keyring** you can have multiple encryption keys at once and key rotation
is fairly straightforward: if you add a key to the _keyring_ with a higher id
than any other key, that key will automatically be used for encryption when
objects are either created or updated. Any keys that are no longer in use can be
safely removed from the _keyring_.

It's extremely important that you save the keyring id returned by `encrypt()`;
otherwise, you may not be able to decrypt values (you can always decrypt values
if you still possess _all_ encryption keys).

If you're using **keyring** to encrypt database columns, it's recommended to use
a separated _keyring_ for each table you're planning to encrypt: this allows an
easier key rotation in case you need (e.g. key leaking).

N.B.: Keys are hardcoded on these examples, but you shouldn't do it on your code
base. You can retrieve _keyring_ from environment variables if you're deploying
to [Heroku](https://heroku.com) and alike, or deploy a JSON file with your
configuration management software (e.g. Ansible, Puppet, Chef, etc).

### Basic usage of keyring

```js
import { keyring } from "@fnando/keyring";

const keys = { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" };
const encryptor = keyring(keys, { digestSalt: "<custom salt>" });

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
```

#### Change encryption algorithm

You can choose between `AES-128-CBC`, `AES-192-CBC` and `AES-256-CBC`. By
default, `AES-128-CBC` will be used.

To specify the encryption algorithm, set the `encryption` option. The following
example uses `AES-256-CBC`.

```js
import { keyring } from "@fnando/keyring";

const keys = { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" };
const encryptor = keyring(keys, {
  encryption: "aes-256-cbc",
  digestSalt: "<custom salt>",
});
```

### Using with Sequelize

If you're using Sequelize, you probably don't want to manually handle the
encryption as above. With that in mind, `keyring` ships with a small plugin that
eases all the pain of manually handling encryption/decryption of properties, as
well as key rotation and digesting.

First, you have to load a different file that set ups models.

````js
const Sequelize = require("sequelize");
const sequelize = new Sequelize("postgres:///test", { logging: false });
const Keyring = require("@fnando/keyring/sequelize");

const User = await sequelize.define(
  "users",
  {
    id: {
      type: Sequelize.UUIDV4,
      primaryKey: true,
      allowNull: false,
      defaultValue: Sequelize.UUIDV4,
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
  },
  { timestamps: false },
);

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
const keys = { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" };

// This is the step you set up your model with hooks to encrypt/decrypt
// columns. You can specify the encryption keys, which columns are going
// to be encrypted, how the column will be encrypted and the name of the
// keyring id column. You can see below the default values for `encryption`
// and keyring id column.
Keyring(User, {
  keys, // [required]
  columns: ["email"], // [required]
  digestSalt: "<custom salt>", // [required]
  keyringIdColumn: "keyring_id", // [optional]
  encryption: "aes-128-cbc", // [optional]
});

(async () => {
  // Now you can create records, like you usually do.
  const user = await User.create({ email: "john@example.com" });

  console.log(JSON.stringify(user, null, 2));

  // Let's update the email address.
  await user.update({ email: "john.doe@example.com" });

  console.log(JSON.stringify(user, null, 2));

  // Now let's pretend that you set USER_KEYRING env var to a
  // {1: old_key, 2: new_key} or rollout a new JSON file via your
  // config management software, and restarted the app.
  keys[2] = "VN8UXRVMNbIh9FWEFVde0q7GUA1SGOie1+FgAKlNYHc=";

  // To simply roll out a new encryption, just call `.save()`.
  // This will trigger a `beforeSave` hook, which will re-encrypt
  // all properties again.
  await user.save();

  console.log(JSON.stringify(user, null, 2));

  // Attributes are also re-encrypted when you call `.update()`.
  await user.update({ email: "john@example.com" });

  console.log(JSON.stringify(user, null, 2));
})();
````

#### Lookup

One tricky aspect of encryption is looking up records by known secret. To solve
this problem, you can generate SHA1 digests for strings that are encrypted and
save them to the database.

`keyring` detects the presence of `<attribute>_digest` columns and update them
accordingly with a SHA1 digest that can be used for unique indexing or
searching. You don't have to use a hashing salt, but it's highly recommended;
this way you can avoid leaking your users' info via rainbow tables.

```js
// A utility function to generate SHA1s out of strings.
const { sha1 } = require("@fnando/keyring");

await User.create({ email: "john@example.com" });

const user = await User.findOne({
  where: {
    email_digest: sha1("john@example.com", { digestSalt: "<custom salt>" }),
  },
});
```

### Exchange data with Ruby

If you use Ruby, you may be interested in
<https://github.com/fnando/attr_keyring>, which is able to read and write
messages using the same format.

## Development

After checking out the repo, run `yarn install` to install dependencies. Then,
run `yarn test` to run the tests.

## Contributing

Bug reports and pull requests are welcome on GitHub at
<https://github.com/fnando/keyring-node>. This project is intended to be a safe,
welcoming space for collaboration, and contributors are expected to adhere to
the [Contributor Covenant](http://contributor-covenant.org) code of conduct.

## License

The gem is available as open source under the terms of the
[MIT License](https://opensource.org/licenses/MIT).

## Icon

Icon made by [Icongeek26](https://www.flaticon.com/authors/icongeek26) from
[Flaticon](https://www.flaticon.com/) is licensed by Creative Commons BY 3.0.

## Code of Conduct

Everyone interacting in the **keyring** project’s codebases, issue trackers,
chat rooms and mailing lists is expected to follow the
[code of conduct](https://github.com/fnando/keyring-node/blob/main/CODE_OF_CONDUCT.md).
