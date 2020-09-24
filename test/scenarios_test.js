const { assert } = require("chai");
const fs = require("fs");
const data = JSON.parse(fs.readFileSync(`${__dirname}/data.json`));

const { keyring } = require("../keyring");

const scenarios = {
  update(encryption, scenario) {
    test("updates attribute", () => {
      const keys = {};
      keys[scenario.key.id] = scenario.key.value;
      const krng = keyring(keys, { encryption, digestSalt: "" });

      let [encrypted, keyringId, digest] = krng.encrypt(scenario.input);

      assert.equal(keyringId, scenario.encrypted.keyring_id);
      assert.equal(digest, scenario.encrypted.digest);
      assert.equal(krng.decrypt(encrypted, keyringId), scenario.input);

      [encrypted, keyringId, digest] = krng.encrypt(scenario.update.input);

      assert.equal(keyringId, scenario.update.encrypted.keyring_id);
      assert.equal(digest, scenario.update.encrypted.digest);
      assert.equal(krng.decrypt(encrypted, keyringId), scenario.update.input);
    });
  },

  encrypt(encryption, scenario) {
    test("encrypts value", () => {
      const keys = {};
      keys[scenario.key.id] = scenario.key.value;
      const krng = keyring(keys, { encryption, digestSalt: "" });

      const [encrypted, keyringId, digest] = krng.encrypt(scenario.input);

      assert.equal(keyringId, scenario.encrypted.keyring_id);
      assert.equal(digest, scenario.encrypted.digest);

      const decrypted = krng.decrypt(encrypted, keyringId);

      assert.equal(decrypted, scenario.input);
    });

    test("decrypts value", () => {
      const keys = {};
      keys[scenario.key.id] = scenario.key.value;
      const krng = keyring(keys, { encryption, digestSalt: "" });
      const decrypted = krng.decrypt(
        scenario.encrypted.value,
        scenario.encrypted.keyring_id,
      );

      assert.equal(decrypted, scenario.input);
    });
  },

  rotate(encryption, scenario) {
    test("rotates key", () => {
      const keys = {};
      keys[scenario.key.id] = scenario.key.value;
      let krng = keyring(keys, { encryption, digestSalt: "" });
      let [encrypted, keyringId, digest] = krng.encrypt(scenario.input);

      assert.equal(keyringId, scenario.encrypted.keyring_id);
      assert.equal(digest, scenario.encrypted.digest);
      assert.equal(krng.decrypt(encrypted, keyringId), scenario.input);

      keys[scenario.rotate.key.id] = scenario.rotate.key.value;
      krng = keyring(keys, { encryption, digestSalt: "" });
      [encrypted, keyringId, digest] = krng.encrypt(scenario.input);

      assert.equal(keyringId, scenario.rotate.encrypted.keyring_id);
      assert.equal(digest, scenario.rotate.encrypted.digest);
      assert.equal(krng.decrypt(encrypted, keyringId), scenario.input);
    });
  },
};

Object.keys(data).forEach((encryption) => {
  suite(`tests for ${encryption}`, () => {
    data[encryption].forEach((scenario) => {
      scenarios[scenario.action](encryption, scenario);
    });
  });
});
