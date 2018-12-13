const {assert} = require("chai");
const {keyring} = require("../keyring");

suite("keyring", () => {
  test("raises exception when trying to use empty keyring", () => {
    assert.throws(() => {
      keyring({}).encrypt("42");
    }, "You must initialize the keyring");
  });

  test("raises exception when using non-integer keys", () => {
    assert.throws(() => {
      keyring({a: "SECRET"}).encrypt("42");
    }, "All keyring keys must be integer numbers");
  });

  test("encrypts property using aes-128-cbc", () => {
    const keys = {"0": "XSzMZOONFkli/hiArK9dKg=="};
    const [encrypted, keyringId] = keyring(keys).encrypt("42");
    const decrypted = keyring(keys).decrypt(encrypted, keyringId);

    assert.notEqual(encrypted, undefined);
    assert.notEqual(encrypted, "42");
    assert.equal(decrypted, "42");
  });

  test("encrypts property using aes-192-cbc", () => {
    const keys = {"0": "zfttbrsNvHU89lNFuNRs0ajZugaxK5Wj"};
    const options = {encryption: "aes-192-cbc"};
    const [encrypted, keyringId] = keyring(keys, options).encrypt("42");
    const decrypted = keyring(keys, options).decrypt(encrypted, keyringId);

    assert.notEqual(encrypted, undefined);
    assert.notEqual(encrypted, "42");
    assert.equal(decrypted, "42");
  });

  test("encrypts property using aes-256-cbc", () => {
    const keys = {"0": "oOWEmzx5RGEgKlZ2ugbQ0kotliI2K3jAZ2gPfTvkRNU="};
    const options = {encryption: "aes-256-cbc"};
    const [encrypted, keyringId] = keyring(keys, options).encrypt("42");
    const decrypted = keyring(keys, options).decrypt(encrypted, keyringId);

    assert.notEqual(encrypted, undefined);
    assert.notEqual(encrypted, "42");
    assert.equal(decrypted, "42");
  });

  test("decrypts ruby's aes-128-cbc encryption", () => {
    const keys = {"0": "2EPEXzEVZqVbIbfZXfe3Ew=="};
    const encrypted = "WvjaRY1wjq2qdYKcmrUH9s1DxurKbtjo+AY14n5DTuo=";
    const decrypted = keyring(keys).decrypt(encrypted, 0);

    assert.notEqual(encrypted, undefined);
    assert.notEqual(encrypted, "hello from ruby");
    assert.equal(decrypted, "hello from ruby");
  });

  test("decrypts ruby's aes-192-cbc encryption", () => {
    const keys = {"0": "zfttbrsNvHU89lNFuNRs0ajZugaxK5Wj"};
    const encrypted = "EVgTQXs9R3sjNreTGXPdg5cRV9cV8xSPu1KNjXB9cuc=";
    const decrypted = keyring(keys, {encryption: "aes-192-cbc"}).decrypt(encrypted, 0);

    assert.notEqual(encrypted, undefined);
    assert.notEqual(encrypted, "hello from ruby");
    assert.equal(decrypted, "hello from ruby");
  });

  test("decrypts ruby's aes-256-cbc encryption", () => {
    const keys = {"0": "oOWEmzx5RGEgKlZ2ugbQ0kotliI2K3jAZ2gPfTvkRNU="};
    const encrypted = "ySma+vGKwly24V00VPqykbkFtgQoakiC+SOr3k6QV0A=";
    const decrypted = keyring(keys, {encryption: "aes-256-cbc"}).decrypt(encrypted, 0);

    assert.notEqual(encrypted, undefined);
    assert.notEqual(encrypted, "hello from ruby");
    assert.equal(decrypted, "hello from ruby");
  });

  test("sets keyring id", () => {
    let encrypted, keyringId;
    const key = "XSzMZOONFkli/hiArK9dKg==";

    [encrypted, keyringId] = keyring({"0": key}).encrypt("42");
    assert.equal(keyringId, 0);

    [encrypted, keyringId] = keyring({"1": key}).encrypt("42");
    assert.equal(keyringId, 1);
  });

  test("throws exception when trying to encrypt non-string", () => {
    const keys = {"0": "XSzMZOONFkli/hiArK9dKg=="};

    assert.throws(() => {
      keyring(keys).encrypt(1234);
    });
  });
});
