const Sequelize = require("sequelize");
const sequelize = new Sequelize("sqlite://:memory:", { logging: false });
const { sha1 } = require("../keyring");
const Keyring = require("../sequelize");

(async () => {
  await sequelize.query(`
    create table users (
      id integer primary key,
      encrypted_email text not null,
      encrypted_secret text not null,
      email_digest text not null,
      keyring_id integer not null
    )
  `);

  const keys = { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" };

  let User = await sequelize.define(
    "users",
    {
      id: { type: Sequelize.INTEGER, primaryKey: true },
      email: Sequelize.VIRTUAL,
      email_digest: Sequelize.TEXT,
      encrypted_email: Sequelize.TEXT,

      secret: Sequelize.VIRTUAL,
      encrypted_secret: Sequelize.TEXT,

      keyring_id: Sequelize.INTEGER,
    },
    { timestamps: false },
  );

  const digestSalt = "salt-n-pepper";

  // This is how you initialize a model.
  Keyring(User, {
    keys, // [required] set the encryption keys
    columns: ["email", "secret"], // [required] set all encrypted columns
    digestSalt, // [required] set the digest salt
    encryption: "aes-128-cbc", // [optional] set encryption algorithm (defaults to aes-128-cbc)
    keyringIdColumn: "keyring_id", // [optional] set the keyring id column (defaults to keyring_id)
  });

  console.log("👱‍ create new user");
  let john = await User.create({
    id: 1234,
    email: "john@example.com",
    secret: "don't tell anyone!",
  });

  await john.reload();

  console.log(JSON.stringify(john.dataValues, null, 2));
  console.log();

  console.log("🔁 rotate key");
  keys[2] = "VN8UXRVMNbIh9FWEFVde0q7GUA1SGOie1+FgAKlNYHc=";

  john = await User.findOne();
  // A `beforeSave` hook is triggered whenever you call `save`.
  // This hook will migrate all attributes to the latest encryption key available.
  await john.save();
  await john.reload();

  console.log(JSON.stringify(john.dataValues, null, 2));
  console.log();

  console.log("👱‍ update email");
  await john.update({ email: "jdoe@example.com" });

  console.log(JSON.stringify(john.dataValues, null, 2));
  console.log();

  console.log("🔎 search by email digest");
  const user = await User.findOne({
    where: { email_digest: sha1(john.email, { digestSalt }) },
  });

  console.log(JSON.stringify(user.dataValues, null, 2));
  console.log();

  console.log("🔁 rotate key and update email");
  keys[3] = "VV3X9u91C5siPvYeFb0Ne43Twxi6NQXkAniVvnzAgrg=";

  john.email = "john.doe@example.com";
  await john.save();

  console.log(JSON.stringify(john.dataValues, null, 2));
  console.log();

  // ❌ N.B.: keys must be kept private at all times. You should never log them.
  console.log("🔑 keys in use");
  console.log(
    "  ",
    await User.count({ where: { keyring_id: 1 } }),
    "record(s) using [1]",
    keys[1],
  );
  console.log(
    "  ",
    await User.count({ where: { keyring_id: 2 } }),
    "record(s) using [2]",
    keys[2],
  );
  console.log(
    "  ",
    await User.count({ where: { keyring_id: 3 } }),
    "record(s) using [3]",
    keys[3],
  );
})();
