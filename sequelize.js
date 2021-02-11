const _ = require('lodash')
const isString = _.isString;
const omit = _.omit;

const KeyringNode = require("./keyring");

const Keyring = KeyringNode.keyring;

/**
 * Keep track of keyring options when we can't attach it to the model
 * eg. equelize-typescript
 */
const OptionsHack = {};

/**
 * Pull keyring options from model
 */
function getModelOptions(record) {
  if (OptionsHack[record.constructor.name]) {
    return OptionsHack[record.constructor.name];
  }
  // This handles the change introduced by sequelize@v6.
  return record._modelOptions || record.constructor.options;
}

/**
 * Encrypt records before saving
 */
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

/**
 * Decrypt records after saving
 */
function afterSave(record) {
  afterFind(record);
}

/**
 * Decrypt records after finding
 */
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

/**
 * Generate keyring options
 */
function genKeyring(name, {
  keys,
  columns,
  digestSalt,
  encryption = "aes-128-cbc",
  keyringIdColumns = {},
},
) {
  const keyring = {
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

  if (name) {
    OptionsHack[name] = {
      keyring
    }
  }
  return keyring;
}

/**
 * Attach keyring options to model
 */
function setup(
  model,
  args,
) {
  model.options.keyring = genKeyring(undefined, args)
  model.beforeSave(beforeSave);
  model.afterSave(afterSave);
  model.afterFind(afterFind);
}

/**
 * Exports
 */
const myModule = module.exports = setup;
myModule.encrypt = beforeSave;
myModule.decrypt = afterFind;
myModule.genKeyring = genKeyring;