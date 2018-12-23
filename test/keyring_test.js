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
      keyring({a: "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M="}).encrypt("42");
    }, "All keyring keys must be integer numbers");
  });

  test("encrypts property using aes-128-cbc", () => {
    const keys = {"0": "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M="};
    const [encrypted, keyringId] = keyring(keys).encrypt("42");
    const decrypted = keyring(keys).decrypt(encrypted, keyringId);

    assert.notEqual(encrypted, undefined);
    assert.notEqual(encrypted, "42");
    assert.equal(decrypted, "42");
  });

  test("encrypts property using aes-192-cbc", () => {
    const keys = {"0": "wtnnoK+5an+FPtxnkdUDrNw6fAq8yMkvCvzWpriLL9TQTR2WC/k+XPahYFPvCemG"};
    const options = {encryption: "aes-192-cbc"};
    const [encrypted, keyringId] = keyring(keys, options).encrypt("42");
    const decrypted = keyring(keys, options).decrypt(encrypted, keyringId);

    assert.notEqual(encrypted, undefined);
    assert.notEqual(encrypted, "42");
    assert.equal(decrypted, "42");
  });

  test("encrypts property using aes-256-cbc", () => {
    const keys = {"0": "XZXC+c7VUVGpyAceSUCOBbrp2fjJeeHwoaMQefgSCfp0/HABY5yJ7zRiLZbDlDZ7HytCRsvP4CxXt5hUqtx9Uw=="};
    const options = {encryption: "aes-256-cbc"};
    const [encrypted, keyringId] = keyring(keys, options).encrypt("42");
    const decrypted = keyring(keys, options).decrypt(encrypted, keyringId);

    assert.notEqual(encrypted, undefined);
    assert.notEqual(encrypted, "42");
    assert.equal(decrypted, "42");
  });

  test("sets keyring id", () => {
    let encrypted, keyringId;
    const key = "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M=";

    [encrypted, keyringId] = keyring({"0": key}).encrypt("42");
    assert.equal(keyringId, 0);

    [encrypted, keyringId] = keyring({"1": key}).encrypt("42");
    assert.equal(keyringId, 1);
  });

  test("throws exception when trying to encrypt non-string", () => {
    const keys = {"0": "uDiMcWVNTuz//naQ88sOcN+E40CyBRGzGTT7OkoBS6M="};

    assert.throws(() => {
      keyring(keys).encrypt(1234);
    });
  });
});
