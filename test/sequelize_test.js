const { assert } = require("chai");

const { sha1 } = require("../keyring");
const Keyring = require("../sequelize");

const Sequelize = require("sequelize");
const sequelize = new Sequelize("postgres:///test", { logging: false });

async function defineModel({
  keys,
  columns = ["email", "secret"],
  encryption = "aes-128-cbc",
  keyringIdColumn = "keyring_id",
  digestSalt = "",
}) {
  const model = await sequelize.define(
    "users",
    {
      id: {
        type: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
        defaultValue: Sequelize.UUIDV4,
      },
      encrypted_email: Sequelize.TEXT,
      email_digest: Sequelize.TEXT,
      email: Sequelize.VIRTUAL,
      encrypted_secret: Sequelize.TEXT,
      secret: Sequelize.VIRTUAL,

      keyring_id: Sequelize.INTEGER,
      custom_keyring_id: Sequelize.INTEGER,
    },
    { timestamps: false },
  );

  Keyring(model, { keys, columns, encryption, keyringIdColumn, digestSalt });

  return model;
}

suite("sequelize", () => {
  setup(async () => {
    await sequelize.query("create extension if not exists pgcrypto;");
    await sequelize.query("create extension if not exists citext;");
    await sequelize.query("drop table if exists users;");

    await sequelize.query(`
      create table users (
        id citext primary key not null,
        encrypted_email text,
        encrypted_secret text,
        email_digest text,
        keyring_id integer,
        custom_keyring_id integer
      );
    `);

    await sequelize.query("delete from users;");
  });

  suiteTeardown(() => {
    sequelize.close();
  });

  test("returns unitialized values", async () => {
    const User = await defineModel({
      keys: { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" },
    });

    const user = new User();

    assert.equal(user.email, undefined);
    assert.equal(user.secret, undefined);
  });

  test("handles non-string values", async () => {
    const User = await defineModel({
      keys: { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" },
    });

    const user = new User({ email: null, secret: null });
    await user.save();
    await user.reload();

    assert.isNull(user.email);
    assert.isNull(user.secret);
  });

  test("encrypts multiple attributes", async () => {
    const User = await defineModel({
      keys: { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" },
    });

    const user = await User.create({ email: "EMAIL", secret: "SECRET" });
    await user.reload();

    assert.equal(user.email, "EMAIL");
    assert.equal(user.secret, "SECRET");

    assert.notEqual(user.encrypted_email, "EMAIL");
    assert.notEqual(user.encrypted_secret, "SECRET");
  });

  test("loads one record", async () => {
    const User = await defineModel({
      keys: { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" },
    });

    await User.create({ email: "EMAIL", secret: "SECRET" });
    const user = await User.findOne();

    assert.equal(user.email, "EMAIL");
    assert.equal(user.secret, "SECRET");
  });

  test("loads several records", async () => {
    const User = await defineModel({
      keys: { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" },
    });

    await User.create({ email: "EMAIL1", secret: "SECRET1" });
    await User.create({ email: "EMAIL2", secret: "SECRET2" });
    const users = await User.findAll();

    assert.equal(users[0].email, "EMAIL1");
    assert.equal(users[0].secret, "SECRET1");

    assert.equal(users[1].email, "EMAIL2");
    assert.equal(users[1].secret, "SECRET2");
  });

  test("updates record", async () => {
    const User = await defineModel({
      keys: { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" },
    });

    const user = await User.create({ email: "EMAIL", secret: "SECRET" });

    await user.update({ email: "NEW EMAIL", secret: "NEW SECRET" });
    await user.reload();

    assert.equal(user.email, "NEW EMAIL");
    assert.equal(user.email_digest, sha1("NEW EMAIL", { digestSalt: "" }));
    assert.equal(user.secret, "NEW SECRET");
  });

  test("saves keyring id", async () => {
    const User = await defineModel({
      keys: { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" },
    });

    const user = await User.create({ email: "EMAIL", secret: "SECRET" });
    await user.reload();

    assert.equal(user.keyring_id, 1);
  });

  test("rotates key", async () => {
    const keys = { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" };
    const User = await defineModel({ keys });
    const user = await User.create({ email: "EMAIL", secret: "SECRET" });

    keys[2] = "VN8UXRVMNbIh9FWEFVde0q7GUA1SGOie1+FgAKlNYHc=";

    await user.save();
    await user.reload();

    assert.equal(user.keyring_id, 2);
  });

  test("sets digest for existing columns", async () => {
    const keys = { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" };
    const User = await defineModel({ keys });
    const user = await User.create({ email: "EMAIL", secret: "SECRET" });

    await user.reload();

    assert.equal(user.email_digest, sha1("EMAIL", { digestSalt: "" }));
    assert.equal(user.secret_digest, undefined);
  });

  test("uses custom keyring id column", async () => {
    const keys = { 1: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=" };
    const keyringIdColumn = "custom_keyring_id";
    const User = await defineModel({ keys, keyringIdColumn });
    const user = await User.create({ email: "EMAIL", secret: "SECRET" });

    await user.reload();

    assert.equal(user.custom_keyring_id, 1);
    assert.isNull(user.keyring_id);
  });

  test("encrypts attributes using custom encryption", async () => {
    const keys = {
      1: "XZXC+c7VUVGpyAceSUCOBbrp2fjJeeHwoaMQefgSCfp0/HABY5yJ7zRiLZbDlDZ7HytCRsvP4CxXt5hUqtx9Uw==",
    };
    const User = await defineModel({ keys, encryption: "aes-256-cbc" });
    const user = await User.create({ email: "EMAIL", secret: "SECRET" });

    await user.reload();

    assert.equal(user.email, "EMAIL");
    assert.equal(user.secret, "SECRET");
  });
});
