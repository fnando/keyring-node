const Sequelize = require("sequelize");
const Keyring = require("./keyring").keyring;

function isString(value) {
  return typeof(value) === "string" || value instanceof String;
}

function beforeSave(record, options) {
  const {
    keys,
    keyringIdColumn,
    encryption,
    columns
  } = record._modelOptions.keyring;

  const keyring = Keyring(keys, {encryption});

  columns.forEach(column => {
    const digestColumn = `${column}_digest`;
    const value = record[column];
    let encrypted = null;
    let digest = null;
    let keyringId = record[keyringIdColumn] || keyring.currentId();

    if (isString(value)) {
      [encrypted, keyringId, digest] = keyring.encrypt(value);
    }

    record[`encrypted_${column}`] = encrypted;
    record[keyringIdColumn] = keyringId;

    if (record.attributes.includes(digestColumn)) {
      record[digestColumn] = digest;
    }
  });
}

function afterFind(record) {
  if (!record) {
    return;
  } else if (record instanceof Array) {
    return record.map(afterFind);
  }

  const {
    keys,
    keyringIdColumn,
    encryption,
    columns
  } = record._modelOptions.keyring;

  const keyring = Keyring(keys, {encryption});
  const keyringId = record[keyringIdColumn];

  columns.forEach(column => {
    const keyringId = record[keyringIdColumn];
    const encrypted = record[`encrypted_${column}`];
    const value = isString(encrypted) ? keyring.decrypt(encrypted, keyringId) : null;
    record[column] = value;
  });
}

function setup(model, {keys, columns, encryption = "aes-128-cbc", keyringIdColumn = "keyring_id"}) {
  model.options.keyring = {keys, columns, encryption, keyringIdColumn};
  model.beforeSave(beforeSave);
  model.afterFind(afterFind);
};

module.exports = setup;
