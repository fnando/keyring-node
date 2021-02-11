const _ = require('lodash')
const isString = _.isString;
const omit = _.omit;

const KeyringNode = require("./keyring");

const Keyring = KeyringNode.keyring;

function getModelOptions(record) {
  // This handles the change introduced by sequelize@v6.
  return record._modelOptions || record.constructor.options;
}

function beforeSave(record) {
  const {
    keys,
    keyringIdColumns,
    encryption,
    columns,
    digestSalt,
  } = getModelOptions(record).keyring;
  columns.forEach((column) => {
    const key = keys[column];
    if (!key) {
      return;
    }
    const keyring = Keyring(key, { encryption, digestSalt });
    const keyringIdColumn = keyringIdColumns[column];

    const digestColumn = `${column}_digest`;
    const value = record[column];
    let encrypted = null;
    let digest = null;
    let keyringId = record[keyringIdColumn] || keyring.currentId();

    if (isString(value)) {
      [encrypted, keyringId, digest] = keyring.encrypt(value);
      record[column] = null;
    } else if (value) {
      console.warn(`Encryption requires string value: ${column}`)
    }

    record[`encrypted_${column}`] = encrypted;
    record[keyringIdColumn] = keyringId;

    // This handles the change introduced by sequelize@v5.
    const attributes =
      record.attributes || Object.keys(record.constructor.rawAttributes);

    if (attributes.includes(digestColumn)) {
      record[digestColumn] = digest;
    }
  });
}

function afterSave(record) {
  afterFind(record);
}

function afterFind(record) {
  if (!record) {
    return;
  } else if (record instanceof Array) {
    return record.map(afterFind);
  }

  const options = getModelOptions(record);
  if (!options) {
    return
  }
  const {
    keys,
    keyringIdColumns,
    encryption,
    columns,
    digestSalt,
  } = options.keyring;

  columns.forEach((column) => {
    const key = keys[column];
    if (!key) {
      return;
    }
    const keyring = Keyring(key, { encryption, digestSalt });
    const keyringIdColumn = keyringIdColumns[column];

    const keyringId = record[keyringIdColumn];
    const encrypted = record[`encrypted_${column}`];
    const value = isString(encrypted)
      ? keyring.decrypt(encrypted, keyringId)
      : null;

    if (value) {
      record.dataValues = omit(record.dataValues, column)
      record[column] = value;
    } else if (record[column] === undefined) {
      // Replace undefined with null
      record[column] = value;
    }
  });
}

function setup(
  model,
  {
    keys,
    columns,
    digestSalt,
    encryption = "aes-128-cbc",
    keyringIdColumns = {},
  },
) {
  model.options.keyring = {
    keys,
    columns,
    encryption,
    keyringIdColumns,
    digestSalt,
  };

  for (const column of columns) {
    if (!keyringIdColumns[column]) {
      throw new Error(`Missing keyring column for encrypted column ${column}`)
    }
  }

  model.beforeSave(beforeSave);
  model.afterSave(afterSave);
  model.afterFind(afterFind);
}

const myModule = module.exports = setup;
myModule.beforeSave = beforeSave;
myModule.afterFind = afterFind;
